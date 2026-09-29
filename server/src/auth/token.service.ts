import { createHmac, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { unauthorized } from '../common/api-exception';
import { APP_CONFIG, type AppConfig } from '../config/env';

/** Who is calling, from a verified access token. */
export type RequestAuth = { userId: string; sessionId: string };

const ISSUER = 'milo-api';
const AUDIENCE = 'milo-app';

/**
 * Access tokens are short-lived signed JWTs (HS256) naming the user and the
 * session. Refresh tokens are opaque random strings; the database keeps only
 * their HMAC, so a leaked table cannot be replayed.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async signAccessToken(auth: RequestAuth, now = new Date()) {
    const issuedAt = Math.floor(now.getTime() / 1_000);
    const lifetime = Math.floor(this.config.accessToken.ttlMs / 1_000);
    const token = await this.jwt.signAsync(
      // `exp` counts from `iat`, so both follow `now`.
      { sid: auth.sessionId, iat: issuedAt },
      {
        secret: this.config.accessToken.secret,
        algorithm: 'HS256',
        subject: auth.userId,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresIn: lifetime,
      },
    );
    return { token, expiresAt: new Date((issuedAt + lifetime) * 1_000) };
  }

  async verifyAccessToken(token: string): Promise<RequestAuth> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: unknown; sid?: unknown }>(token, {
        secret: this.config.accessToken.secret,
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') throw unauthorized();
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      throw unauthorized();
    }
  }

  /** 256 random bits, URL-safe. */
  newRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    return createHmac('sha256', this.config.refreshToken.secret).update(token).digest('hex');
  }
}
