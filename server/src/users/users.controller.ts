import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  UpdateProfileRequestSchema,
  UserDtoSchema,
  type UpdateProfileRequest,
  type UserDto,
} from '@/schemas';

import { AccessTokenGuard, CurrentAuth } from '../auth/access-token.guard';
import type { RequestAuth } from '../auth/token.service';
import { ApiErrors, ApiJsonBody, ApiJsonResponse } from '../common/openapi';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'The signed-in account' })
  @ApiJsonResponse(200, 'The account.', UserDtoSchema)
  @ApiErrors([401, 'Missing, expired or revoked access token'])
  getMe(@CurrentAuth() auth: RequestAuth): Promise<UserDto> {
    return this.users.getMe(auth.userId);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update the profile',
    description: 'Only `displayName` and `goal`; any other field is rejected.',
  })
  @ApiJsonBody(UpdateProfileRequestSchema)
  @ApiJsonResponse(200, 'The updated account.', UserDtoSchema)
  @ApiErrors(
    [400, 'Invalid value, unknown field or nothing to update'],
    [401, 'Missing, expired or revoked access token'],
  )
  updateMe(
    @CurrentAuth() auth: RequestAuth,
    @Body(new ZodValidationPipe(UpdateProfileRequestSchema)) body: UpdateProfileRequest,
  ): Promise<UserDto> {
    return this.users.updateMe(auth.userId, body);
  }
}
