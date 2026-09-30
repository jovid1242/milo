import { Module } from '@nestjs/common';

import { AuthTokensModule } from '../auth/auth-tokens.module';
import { InviteCodes } from './invite-codes';
import { TeamInvitesController, TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [AuthTokensModule],
  controllers: [TeamsController, TeamInvitesController],
  providers: [TeamsService, InviteCodes],
})
export class TeamsModule {}
