import { Inject, Injectable, Logger } from '@nestjs/common';

import type { RegisterPushDeviceRequest } from '@/schemas';

import type { RequestAuth } from '../auth/token.service';
import { CLOCK, type Clock } from '../common/clock';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/** A person's devices with team notifications on, at most; the least recently seen go first. */
export const MAX_PUSH_DEVICES_PER_USER = 10;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Which devices get team notifications. A device is a signed-in session that
 * registered its Expo push token; the token is the session's alone. When the
 * same phone registers it for another session — the system gave the token to
 * a new sign-in, maybe another account — it moves there, so the previous
 * account never hears another word on that phone. Signing out ends it.
 */
@Injectable()
export class PushDevices {
  private readonly logger = new Logger('Push');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** `PUT /push/devices/current`: this session's device, with this token. Idempotent. */
  async register(auth: RequestAuth, request: RegisterPushDeviceRequest): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const { outcome, deviceId } = await this.prisma.$transaction((tx) =>
          this.upsert(tx, auth, request),
        );
        this.logger.log(
          { userId: auth.userId, deviceId, platform: request.platform, outcome },
          'Push device',
        );
        return;
      } catch (error) {
        // The same token registered at the same moment elsewhere: once more, after it.
        if (attempt < 3 && isUniqueViolation(error)) continue;
        throw error;
      }
    }
  }

  private async upsert(tx: Tx, auth: RequestAuth, { token, platform }: RegisterPushDeviceRequest) {
    const now = this.clock.now();
    const existing = await tx.pushDevice.findUnique({ where: { token } });
    if (existing?.sessionId === auth.sessionId && existing.userId === auth.userId) {
      await tx.pushDevice.update({
        where: { id: existing.id },
        data: { platform, updatedAt: now },
      });
      return { outcome: 'confirmed', deviceId: existing.id };
    }
    // The token leaves whichever session had it, and this session's previous
    // token (the system replaced it) goes: a new row, so nothing queued for
    // the old owner of the token can find its way here.
    const replaced = await tx.pushDevice.deleteMany({
      where: { OR: [{ token }, { sessionId: auth.sessionId }] },
    });
    const device = await tx.pushDevice.create({
      data: {
        userId: auth.userId,
        sessionId: auth.sessionId,
        token,
        platform,
        createdAt: now,
        updatedAt: now,
      },
      select: { id: true },
    });
    const extra = await tx.pushDevice.findMany({
      where: { userId: auth.userId },
      orderBy: { updatedAt: 'desc' },
      skip: MAX_PUSH_DEVICES_PER_USER,
      select: { id: true },
    });
    if (extra.length > 0)
      await tx.pushDevice.deleteMany({ where: { id: { in: extra.map((item) => item.id) } } });
    const outcome = !existing
      ? replaced.count > 0
        ? 'tokenChanged'
        : 'registered'
      : existing.userId === auth.userId
        ? 'movedSession'
        : 'movedAccount';
    return { outcome, deviceId: device.id };
  }

  /** `DELETE /push/devices/current`: this session's device turns team notifications off. */
  async unregister(auth: RequestAuth): Promise<void> {
    const { count } = await this.prisma.pushDevice.deleteMany({
      where: { sessionId: auth.sessionId, userId: auth.userId },
    });
    this.logger.log(
      { userId: auth.userId, outcome: count > 0 ? 'unregistered' : 'none' },
      'Push device',
    );
  }

  /**
   * `POST /push/devices/unregister`: a device that signed out forgets its
   * token, whether or not its session still exists (it signed out offline).
   * The token itself is the proof: only that device and this server have it.
   */
  async forget(token: string): Promise<void> {
    const { count } = await this.prisma.pushDevice.deleteMany({ where: { token } });
    this.logger.log({ outcome: count > 0 ? 'forgotten' : 'none' }, 'Push device');
  }
}
