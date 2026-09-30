import { Body, Controller, Delete, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';

import {
  RegisterPushDeviceRequestSchema,
  UnregisterPushTokenRequestSchema,
  type RegisterPushDeviceRequest,
  type UnregisterPushTokenRequest,
} from '@/schemas';

import { AccessTokenGuard, CurrentAuth } from '../auth/access-token.guard';
import type { RequestAuth } from '../auth/token.service';
import { ApiErrors, ApiJsonBody, ApiJsonResponse } from '../common/openapi';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PushDevices } from './push-devices.service';

const SIGNED_IN: [number, string] = [401, 'Missing, expired or revoked access token'];
const NOT_A_TOKEN: [number, string] = [400, 'Not an Expo push token'];

/**
 * Team notifications for this device: on (its Expo push token, for the
 * signed-in session) or off. What is sent, and when, the server decides.
 */
@ApiTags('push')
// Only the signed-out route below is limited, per address.
@SkipThrottle({ invites: true })
@Controller('push/devices')
export class PushController {
  constructor(private readonly devices: PushDevices) {}

  @Put('current')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Turn team notifications on for this device',
    description:
      'Registers the Expo push token for the signed-in session (one per session). Idempotent; a token registered by another session or account moves here.',
  })
  @ApiJsonBody(RegisterPushDeviceRequestSchema)
  @ApiJsonResponse(204, 'Registered.')
  @ApiErrors(SIGNED_IN, NOT_A_TOKEN)
  async register(
    @CurrentAuth() auth: RequestAuth,
    @Body(new ZodValidationPipe(RegisterPushDeviceRequestSchema)) body: RegisterPushDeviceRequest,
  ): Promise<void> {
    await this.devices.register(auth, body);
  }

  @Delete('current')
  @HttpCode(204)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Turn team notifications off for this device' })
  @ApiJsonResponse(204, 'Nothing is sent to this device any more.')
  @ApiErrors(SIGNED_IN)
  async unregister(@CurrentAuth() auth: RequestAuth): Promise<void> {
    await this.devices.unregister(auth);
  }

  @Post('unregister')
  @HttpCode(204)
  @UseGuards(ThrottlerGuard)
  @ApiOperation({
    summary: 'Forget a token after signing out',
    description:
      'For a device that signed out while offline: its session may still exist, or be gone. The same answer whether or not the token was known.',
  })
  @ApiJsonBody(UnregisterPushTokenRequestSchema)
  @ApiJsonResponse(204, 'Nothing is sent to this token any more.')
  @ApiErrors(NOT_A_TOKEN, [429, 'Too many requests from this address'])
  async forget(
    @Body(new ZodValidationPipe(UnregisterPushTokenRequestSchema))
    body: UnregisterPushTokenRequest,
  ): Promise<void> {
    await this.devices.forget(body.token);
  }
}
