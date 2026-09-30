import { Module } from '@nestjs/common';

import { AuthTokensModule } from '../auth/auth-tokens.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';

@Module({
  imports: [AuthTokensModule],
  controllers: [ProgressController],
  providers: [ProgressService],
})
export class ProgressModule {}
