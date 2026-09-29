import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AccessTokenGuard } from './access-token.guard';
import { TokenService } from './token.service';

/** What any module needs to protect its routes: issuing and checking tokens. */
@Module({
  // Secrets and lifetimes come from the validated config, per call.
  imports: [JwtModule.register({})],
  providers: [TokenService, AccessTokenGuard],
  exports: [TokenService, AccessTokenGuard],
})
export class AuthTokensModule {}
