import { Inject, Injectable } from '@nestjs/common';

import type { AuthSession, LoginRequest, RegisterRequest } from '@/schemas';

import { ApiException } from '../common/api-exception';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { Prisma, type RefreshToken, type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toUserDto } from '../users/user-dto';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token.service';

type Tx = Prisma.TransactionClient;

type Issued = { user: User; sessionId: string; refreshToken: string; expiresAt: Date };
type Rotation = { kind: 'ok'; issued: Issued } | { kind: 'invalid' } | { kind: 'reused' };

const sessionEnded = (code: 'REFRESH_TOKEN_INVALID' | 'REFRESH_TOKEN_REUSED') =>
  new ApiException(401, code, 'Your session has ended. Sign in again.');

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Accounts and sessions. A session is one signed-in device; its refresh token
 * is single-use and rotates on every refresh.
 *
 * A token presented again after it was exchanged is a replay — someone else
 * has a copy — and ends the whole session. The one exception is a retry: the
 * same token again within a short grace window, while nothing issued for it
 * has been used yet (the response was lost on a bad network). The retry gets
 * a successor of its own; whichever successor is used first retires the rest.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(input: RegisterRequest, userAgent?: string): Promise<AuthSession> {
    const passwordHash = await this.hasher.hash(input.password);
    let user: User;
    try {
      user = await this.prisma.user.create({ data: { email: input.email, passwordHash } });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ApiException(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
      throw error;
    }
    return this.openSession(user, userAgent);
  }

  async login(input: LoginRequest, userAgent?: string): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Always verify — against a decoy when the email is unknown — so the
    // response time does not tell which emails have accounts.
    const valid = await this.hasher.verify(user?.passwordHash ?? null, input.password);
    if (!user || !valid)
      throw new ApiException(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    if (this.hasher.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await this.hasher.hash(input.password) },
      });
    }
    return this.openSession(user, userAgent);
  }

  async refresh(refreshToken: string, now = new Date()): Promise<AuthSession> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    // A revocation must commit, so the transaction returns an outcome and the
    // error is thrown only after it.
    const outcome = await this.prisma.$transaction((tx) => this.rotate(tx, tokenHash, now));
    if (outcome.kind === 'invalid') throw sessionEnded('REFRESH_TOKEN_INVALID');
    if (outcome.kind === 'reused') throw sessionEnded('REFRESH_TOKEN_REUSED');
    return this.sessionFor(outcome.issued, now);
  }

  /**
   * Ends the device's session — and its team notifications with it. Idempotent:
   * an unknown or ended session is already logged out.
   */
  async logout(refreshToken: string, now = new Date()): Promise<void> {
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.tokens.hashRefreshToken(refreshToken) },
      select: { sessionId: true },
    });
    if (!token) return;
    await this.prisma.$transaction([
      this.prisma.refreshSession.updateMany({
        where: { id: token.sessionId, revokedAt: null },
        data: { revokedAt: now, revokedReason: 'logout' },
      }),
      this.prisma.pushDevice.deleteMany({ where: { sessionId: token.sessionId } }),
    ]);
  }

  private async rotate(tx: Tx, tokenHash: string, now: Date): Promise<Rotation> {
    const found = await tx.refreshToken.findUnique({
      where: { tokenHash },
      select: { sessionId: true },
    });
    if (!found) return { kind: 'invalid' };
    // One refresh per session at a time: each decision below sees the
    // session exactly as the previous refresh left it.
    await tx.$queryRaw`SELECT 1 FROM "refresh_sessions" WHERE "id" = ${found.sessionId}::uuid FOR UPDATE`;

    const token = await tx.refreshToken.findUnique({
      where: { tokenHash },
      include: { session: { include: { user: true } } },
    });
    if (!token) return { kind: 'invalid' };
    const { session } = token;
    if (session.revokedAt !== null || session.expiresAt <= now || token.expiresAt <= now)
      return { kind: 'invalid' };
    if (token.supersededAt !== null) return this.revokeForReuse(tx, session.id, now);

    if (token.rotatedAt === null) {
      await tx.refreshToken.update({ where: { id: token.id }, data: { rotatedAt: now } });
      if (token.parentId !== null) {
        // Retire the siblings a retry left behind: this one won.
        await tx.refreshToken.updateMany({
          where: {
            parentId: token.parentId,
            id: { not: token.id },
            rotatedAt: null,
            supersededAt: null,
          },
          data: { supersededAt: now },
        });
      }
      return { kind: 'ok', issued: await this.issueSuccessor(tx, token, session.user, now) };
    }

    const withinGrace =
      now.getTime() - token.rotatedAt.getTime() <= this.config.refreshToken.reuseGraceMs;
    const usedSuccessors = await tx.refreshToken.count({
      where: { parentId: token.id, rotatedAt: { not: null } },
    });
    if (!withinGrace || usedSuccessors > 0) return this.revokeForReuse(tx, session.id, now);
    return { kind: 'ok', issued: await this.issueSuccessor(tx, token, session.user, now) };
  }

  private async revokeForReuse(tx: Tx, sessionId: string, now: Date): Promise<Rotation> {
    await tx.refreshSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: now, revokedReason: 'reuse' },
    });
    // Whoever holds the copy gets no team news either.
    await tx.pushDevice.deleteMany({ where: { sessionId } });
    return { kind: 'reused' };
  }

  private async issueSuccessor(
    tx: Tx,
    parent: RefreshToken,
    user: User,
    now: Date,
  ): Promise<Issued> {
    const refreshToken = this.tokens.newRefreshToken();
    const expiresAt = new Date(now.getTime() + this.config.refreshToken.ttlMs);
    await tx.refreshToken.create({
      data: {
        sessionId: parent.sessionId,
        parentId: parent.id,
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        createdAt: now,
        expiresAt,
      },
    });
    // An active session slides forward with each refresh.
    await tx.refreshSession.update({
      where: { id: parent.sessionId },
      data: { lastUsedAt: now, expiresAt },
    });
    return { user, sessionId: parent.sessionId, refreshToken, expiresAt };
  }

  private async openSession(user: User, userAgent?: string, now = new Date()) {
    const refreshToken = this.tokens.newRefreshToken();
    const expiresAt = new Date(now.getTime() + this.config.refreshToken.ttlMs);
    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        createdAt: now,
        lastUsedAt: now,
        expiresAt,
        userAgent: userAgent?.slice(0, 200) ?? null,
        tokens: {
          create: {
            tokenHash: this.tokens.hashRefreshToken(refreshToken),
            createdAt: now,
            expiresAt,
          },
        },
      },
    });
    return this.sessionFor({ user, sessionId: session.id, refreshToken, expiresAt }, now);
  }

  private async sessionFor(issued: Issued, now: Date): Promise<AuthSession> {
    const access = await this.tokens.signAccessToken(
      { userId: issued.user.id, sessionId: issued.sessionId },
      now,
    );
    return {
      user: toUserDto(issued.user),
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken: issued.refreshToken,
      refreshTokenExpiresAt: issued.expiresAt.toISOString(),
    };
  }
}
