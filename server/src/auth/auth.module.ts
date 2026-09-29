import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { APP_CONFIG, type AppConfig } from '../config/env';
import { UsersModule } from '../users/users.module';
import { AuthTokensModule } from './auth-tokens.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';

@Module({
  imports: [
    AuthTokensModule,
    UsersModule,
    // Sign-up and sign-in, per client address and route (with a standard
    // Retry-After). Refresh and logout take an unguessable token: nothing to guess.
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: config.authRateLimitPerMinute }],
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher],
})
export class AuthModule {}
