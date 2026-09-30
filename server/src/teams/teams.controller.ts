import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';

import {
  InviteCodeRequestSchema,
  InvitePreviewResponseSchema,
  MyTeamResponseSchema,
  TeamInviteResponseSchema,
  type InviteCodeRequest,
  type InvitePreviewResponse,
  type MyTeamResponse,
  type TeamInviteResponse,
} from '@/schemas';

import { AccessTokenGuard, CurrentAuth } from '../auth/access-token.guard';
import type { RequestAuth } from '../auth/token.service';
import { ApiErrors, ApiJsonBody, ApiJsonResponse } from '../common/openapi';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { TeamsService } from './teams.service';

const SIGNED_IN: [number, string] = [401, 'Missing, expired or revoked access token'];
const NOT_IN_TEAM: [number, string] = [404, 'TEAM_NOT_FOUND — not the caller’s team'];
const CODE_REFUSED: [number, string] = [
  404,
  'INVITE_INVALID — no invite has this code (410: INVITE_EXPIRED, INVITE_REVOKED)',
];
const RATE_LIMITED: [number, string] = [429, 'Too many tries from this account'];

/**
 * The user's challenge team: up to three friends. Only its members see it;
 * every change of its membership is decided here, never on a device.
 */
@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'The user’s team',
    description:
      'Members as summaries (day, today, streak, XP — never email, answers or history), the team streak derived now, and the open invite. `team: null` without one.',
  })
  @ApiJsonResponse(200, 'The team, or null.', MyTeamResponseSchema)
  @ApiErrors(SIGNED_IN)
  me(@CurrentAuth() auth: RequestAuth): Promise<MyTeamResponse> {
    return this.teams.myTeam(auth.userId);
  }

  @Post()
  @ApiOperation({
    summary: 'Make a team',
    description: 'The caller becomes its owner and first member.',
  })
  @ApiJsonResponse(201, 'The new team.', MyTeamResponseSchema)
  @ApiErrors(SIGNED_IN, [
    409,
    'ALREADY_IN_TEAM — leave the current team first; CHALLENGE_NOT_STARTED',
  ])
  create(@CurrentAuth() auth: RequestAuth): Promise<MyTeamResponse> {
    return this.teams.create(auth.userId);
  }

  @Post(':teamId/invites')
  @HttpCode(200)
  @ApiOperation({
    summary: 'The team’s invite',
    description: `The open invite, the same for every member while it has a day or more left; otherwise a new one (valid for 7 days, for as many people as the team has room for).`,
  })
  @ApiJsonResponse(200, 'The invite with its code.', TeamInviteResponseSchema)
  @ApiErrors(SIGNED_IN, NOT_IN_TEAM, [409, 'TEAM_FULL — nothing to invite to'])
  async invite(
    @CurrentAuth() auth: RequestAuth,
    @Param('teamId') teamId: string,
  ): Promise<TeamInviteResponse> {
    return { invite: await this.teams.invite(auth.userId, teamId) };
  }

  @Post(':teamId/leave')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Leave the team',
    description:
      'An owner hands the team to the member who joined earliest; the last member deletes it. Invites the leaver made stop working.',
  })
  @ApiJsonResponse(204, 'Left.')
  @ApiErrors(SIGNED_IN, NOT_IN_TEAM)
  leave(@CurrentAuth() auth: RequestAuth, @Param('teamId') teamId: string): Promise<void> {
    return this.teams.leave(auth.userId, teamId);
  }
}

/**
 * Invites, by code. The code travels in the body — never in a URL, where
 * request logs and proxies would keep it — and guessing is limited per account.
 */
@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('team-invites')
export class TeamInvitesController {
  constructor(private readonly teams: TeamsService) {}

  @Post('preview')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ default: true })
  @ApiOperation({
    summary: 'The team behind an invite code',
    description:
      'Its name, its owner’s name and how many are in it, and what joining would mean for the caller — nobody’s progress.',
  })
  @ApiJsonBody(InviteCodeRequestSchema)
  @ApiJsonResponse(200, 'The team, before joining it.', InvitePreviewResponseSchema)
  @ApiErrors([400, 'Not a code request'], SIGNED_IN, CODE_REFUSED, RATE_LIMITED)
  async preview(
    @CurrentAuth() auth: RequestAuth,
    @Body(new ZodValidationPipe(InviteCodeRequestSchema)) body: InviteCodeRequest,
  ): Promise<InvitePreviewResponse> {
    return { preview: await this.teams.preview(auth.userId, body.code) };
  }

  @Post('join')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @SkipThrottle({ default: true })
  @ApiOperation({
    summary: 'Join the team behind an invite code',
    description: 'Never automatic: the app asks the user first. The team is full at three.',
  })
  @ApiJsonBody(InviteCodeRequestSchema)
  @ApiJsonResponse(200, 'The team, with the caller in it.', MyTeamResponseSchema)
  @ApiErrors(
    [400, 'Not a code request'],
    SIGNED_IN,
    CODE_REFUSED,
    [409, 'TEAM_FULL, ALREADY_MEMBER, ALREADY_IN_TEAM, CHALLENGE_NOT_STARTED'],
    RATE_LIMITED,
  )
  join(
    @CurrentAuth() auth: RequestAuth,
    @Body(new ZodValidationPipe(InviteCodeRequestSchema)) body: InviteCodeRequest,
  ): Promise<MyTeamResponse> {
    return this.teams.join(auth.userId, body.code);
  }

  @Delete(':inviteId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Turn an invite off',
    description: 'By whoever made it, or the team’s owner. Turning it off again changes nothing.',
  })
  @ApiJsonResponse(204, 'Turned off.')
  @ApiErrors(SIGNED_IN, [403, 'FORBIDDEN — not its maker, not the owner'], [404, 'NOT_FOUND'])
  revoke(@CurrentAuth() auth: RequestAuth, @Param('inviteId') inviteId: string): Promise<void> {
    return this.teams.revoke(auth.userId, inviteId);
  }
}
