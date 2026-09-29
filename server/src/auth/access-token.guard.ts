import {
  createParamDecorator,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

import { unauthorized } from '../common/api-exception';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService, type RequestAuth } from './token.service';

type AuthedRequest = Request & { auth?: RequestAuth };

/**
 * Requires `Authorization: Bearer <access token>`. The token must verify and
 * its session must still be active, so logging out (or a detected token
 * replay) cuts access at once rather than when the token expires.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) throw unauthorized();
    const auth = await this.tokens.verifyAccessToken(token);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: auth.sessionId },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (
      !session ||
      session.userId !== auth.userId ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date()
    )
      throw unauthorized();
    request.auth = auth;
    return true;
  }
}

/** The caller, as verified by `AccessTokenGuard`. */
export const CurrentAuth = createParamDecorator((_: unknown, context: ExecutionContext) => {
  const auth = context.switchToHttp().getRequest<AuthedRequest>().auth;
  if (!auth) throw unauthorized();
  return auth;
});
