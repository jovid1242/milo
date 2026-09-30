import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { AuthTokensModule } from './auth-tokens.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordHasher } from './password-hasher';

@Module({
  imports: [AuthTokensModule, UsersModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordHasher],
})
export class AuthModule {}
