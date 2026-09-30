import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import type { RequestAuth } from '../auth/token.service';
import { APP_CONFIG, type AppConfig } from '../config/env';

/**
 * Where guessing is possible, a limit per minute — applied by `ThrottlerGuard`
 * on the routes that ask for it, with a standard `Retry-After`:
 *
 * - `default`: sign-up and sign-in, per client address and route. Refresh and
 *   logout take an unguessable token: nothing to guess.
 * - `invites`: invite previews and joins, per account (the routes are signed
 *   in, and accounts themselves are limited above).
 *
 * A route takes every limit it does not skip (`@SkipThrottle({ name: true })`).
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          { name: 'default', ttl: 60_000, limit: config.authRateLimitPerMinute },
          {
            name: 'invites',
            ttl: 60_000,
            limit: config.inviteRateLimitPerMinute,
            getTracker: (request: { auth?: RequestAuth; ip?: string }) =>
              request.auth?.userId ?? request.ip ?? 'unknown',
          },
        ],
      }),
    }),
  ],
})
export class RateLimitModule {}
