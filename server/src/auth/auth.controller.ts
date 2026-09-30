import { Body, Controller, Get, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';

import {
  AuthSessionSchema,
  LoginRequestSchema,
  RefreshRequestSchema,
  RegisterRequestSchema,
  UserDtoSchema,
  type AuthSession,
  type LoginRequest,
  type RefreshRequest,
  type RegisterRequest,
  type UserDto,
} from '@/schemas';

import { ApiErrors, ApiJsonBody, ApiJsonResponse } from '../common/openapi';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from '../users/users.service';
import { AccessTokenGuard, CurrentAuth } from './access-token.guard';
import { AuthService } from './auth.service';
import type { RequestAuth } from './token.service';

const RATE_LIMITED: [number, string] = [429, 'Too many attempts from this address'];
const SESSION_ENDED: [number, string] = [
  401,
  'REFRESH_TOKEN_INVALID (unknown, expired or logged out) or REFRESH_TOKEN_REUSED (a replayed token: the session is revoked)',
];

@ApiTags('auth')
// Its own limit per address (see RateLimitModule), not the invites' one.
@SkipThrottle({ invites: true })
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: 'Create an account and sign in',
    description: 'Credentials only: the name and the goal come later, from onboarding.',
  })
  @ApiJsonBody(RegisterRequestSchema)
  @ApiJsonResponse(201, 'Signed in: the account and a token pair.', AuthSessionSchema)
  @ApiErrors([400, 'Invalid email or password'], [409, 'EMAIL_TAKEN'], RATE_LIMITED)
  register(
    @Body(new ZodValidationPipe(RegisterRequestSchema)) body: RegisterRequest,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthSession> {
    return this.auth.register(body, userAgent);
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiJsonBody(LoginRequestSchema)
  @ApiJsonResponse(200, 'Signed in: the account and a token pair.', AuthSessionSchema)
  @ApiErrors(
    [400, 'Malformed request'],
    [401, 'INVALID_CREDENTIALS — the same answer for an unknown email and a wrong password'],
    RATE_LIMITED,
  )
  login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthSession> {
    return this.auth.login(body, userAgent);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new token pair',
    description:
      'Refresh tokens are single-use: the response carries the next one. Presenting a used token again ends the session.',
  })
  @ApiJsonBody(RefreshRequestSchema)
  @ApiJsonResponse(200, 'A new token pair.', AuthSessionSchema)
  @ApiErrors([400, 'Malformed request'], SESSION_ENDED)
  refresh(
    @Body(new ZodValidationPipe(RefreshRequestSchema)) body: RefreshRequest,
  ): Promise<AuthSession> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({
    summary: 'End this device’s session',
    description: 'Revokes the session the refresh token belongs to. Idempotent.',
  })
  @ApiJsonBody(RefreshRequestSchema)
  @ApiJsonResponse(204, 'Logged out.')
  @ApiErrors([400, 'Malformed request'])
  logout(@Body(new ZodValidationPipe(RefreshRequestSchema)) body: RefreshRequest): Promise<void> {
    return this.auth.logout(body.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Who the access token belongs to' })
  @ApiJsonResponse(200, 'The account.', UserDtoSchema)
  @ApiErrors([401, 'Missing, expired or revoked access token'])
  me(@CurrentAuth() auth: RequestAuth): Promise<UserDto> {
    return this.users.getMe(auth.userId);
  }
}
