import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

import {
  ProgressResponseSchema,
  SyncRequestSchema,
  SyncResponseSchema,
  type ProgressResponse,
  type SyncRequest,
  type SyncResponse,
} from '@/schemas';

import { AccessTokenGuard, CurrentAuth } from '../auth/access-token.guard';
import type { RequestAuth } from '../auth/token.service';
import { ApiErrors, ApiJsonBody, ApiJsonResponse } from '../common/openapi';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ProgressService } from './progress.service';

const SIGNED_IN: [number, string] = [401, 'Missing, expired or revoked access token'];

/**
 * The account's progress. The server owns it: a device sends what the user
 * did and gets back what that earned — never the other way round.
 */
@ApiTags('progress')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('progress')
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Get()
  @ApiOperation({
    summary: 'The progress, as it stands',
    description:
      'Everything the account has in the course: records, and what the server derives from them now (current day, streak, total XP, completed days).',
  })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiJsonResponse(200, 'The progress and its revision.', ProgressResponseSchema)
  @ApiErrors(SIGNED_IN, [409, 'COURSE_MISMATCH — another course'])
  get(
    @CurrentAuth() auth: RequestAuth,
    @Query('courseId') courseId?: string,
  ): Promise<ProgressResponse> {
    return this.progress.progress(auth.userId, courseId);
  }

  @Post('sync')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Send offline actions, receive the progress',
    description:
      'Mutations are applied in order, each once: a retried id is a `duplicate`, a refused one is `rejected` with a code — for good. The progress comes back when the revision moved past `knownRevision`.',
  })
  @ApiJsonBody(SyncRequestSchema)
  @ApiJsonResponse(
    200,
    'One result per mutation, and the progress when it changed.',
    SyncResponseSchema,
  )
  @ApiErrors(
    [400, 'Not a valid sync request'],
    SIGNED_IN,
    [
      409,
      'ACCOUNT_MISMATCH — the outbox is another account’s; COURSE_MISMATCH; COURSE_VERSION_UNSUPPORTED — nothing applied, retry after the course is supported',
    ],
    [413, 'The request is too large'],
  )
  sync(
    @CurrentAuth() auth: RequestAuth,
    @Body(new ZodValidationPipe(SyncRequestSchema)) body: SyncRequest,
  ): Promise<SyncResponse> {
    return this.progress.sync(auth.userId, body);
  }
}
