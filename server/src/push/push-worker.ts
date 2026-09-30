import {
  Inject,
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from '@nestjs/common';

import { TEAM_UPDATES_CHANNEL_ID } from '@/schemas';

import { CLOCK, type Clock } from '../common/clock';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExpoPushError,
  PUSH_TRANSPORT,
  RECEIPTS_CHUNK,
  SEND_CHUNK,
  type ExpoPushMessage,
  type PushTransport,
} from './expo-push.transport';
import { redactPushTokens } from './push-token';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

/** How often an idle worker looks for due jobs. */
const POLL_MS = 3 * SECOND_MS;
/** Jobs claimed at once. */
const CLAIM_BATCH = 100;
/** How long a claim holds: a worker that dies mid-send lets its jobs go after this. */
const LEASE_MS = MINUTE_MS;
/** Tries before a job is given up. */
const MAX_ATTEMPTS = 6;
/** Retries back off: 10 s, 20 s, 40 s… up to 15 minutes. */
const BACKOFF_BASE_MS = 10 * SECOND_MS;
const BACKOFF_MAX_MS = 15 * MINUTE_MS;
/** Expo has a ticket's receipt ready within about 15 minutes, and keeps it for a day. */
const RECEIPT_DELAY_MS = 15 * MINUTE_MS;
const RECEIPT_KEPT_MS = 24 * HOUR_MS;
const RECEIPTS_EVERY_MS = MINUTE_MS;
/** Finished jobs are kept a week (for the dedupe keys and a look back), then deleted. */
const JOBS_KEPT_MS = 7 * 24 * HOUR_MS;
const PRUNE_EVERY_MS = HOUR_MS;
/** Ticket errors that say "later", not "never". */
const RETRYABLE_TICKET_ERRORS = new Set(['MessageRateExceeded']);

type ClaimedJob = {
  id: string;
  userId: string;
  teamId: string;
  title: string;
  body: string;
  data: Prisma.JsonValue;
  attempts: number;
  expiresAt: Date;
};

type Device = { id: string; userId: string; token: string };
type Delivery = { job: ClaimedJob; devices: Device[] };

/** A retry's wait: doubling with each attempt, spread a little by the job's id. */
export function backoffMs(attempt: number, jobId: string): number {
  const base = Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1), BACKOFF_MAX_MS);
  const spread = Number.parseInt(jobId.slice(0, 4), 16) / 0xffff || 0;
  return Math.round(base * (1 + spread / 4));
}

/** Whole jobs per request — every device of a job in the same one — at most `limit` messages. */
function chunkDeliveries(deliveries: Delivery[], limit: number): Delivery[][] {
  const chunks: Delivery[][] = [];
  let current: Delivery[] = [];
  let size = 0;
  for (const delivery of deliveries) {
    if (size + delivery.devices.length > limit && current.length > 0) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(delivery);
    size += delivery.devices.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size)
    result.push(items.slice(start, start + size));
  return result;
}

const tally = (codes: readonly string[]) =>
  codes.reduce<Record<string, number>>((counts, code) => {
    counts[code] = (counts[code] ?? 0) + 1;
    return counts;
  }, {});

/**
 * Sends the push outbox through Expo, after the transactions that queued it
 * committed. Safe to run anywhere and to restart:
 *
 * - A job is claimed in PostgreSQL (`FOR UPDATE SKIP LOCKED`, then `sending`
 *   with a lease), so two workers never take the same job; a worker that dies
 *   mid-send lets its jobs go when the lease passes.
 * - No answer, a 429 or a 5xx: the job waits and is tried again, backing off
 *   (Expo's `Retry-After` included), until it runs out of tries or goes stale.
 * - A ticket says Expo accepted a message, not that it arrived: its receipt is
 *   checked later, and a device that no longer exists (`DeviceNotRegistered`)
 *   is forgotten — from the ticket or from the receipt.
 * - Tokens are never logged: devices are named by id.
 */
@Injectable()
export class PushWorker implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger('Push');
  private timer: NodeJS.Timeout | null = null;
  private round: Promise<void> | null = null;
  private stopped = false;
  private lastReceipts = 0;
  private lastPrune = 0;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_TRANSPORT) private readonly transport: PushTransport,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.push.workerEnabled) this.schedule(0);
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.round;
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      this.round = this.tick().finally(() => {
        this.round = null;
        this.schedule(POLL_MS);
      });
    }, delayMs);
  }

  /** One round: what is due is sent; receipts every minute; old rows every hour. */
  async tick(): Promise<void> {
    try {
      await this.sendDue();
      const now = Date.now();
      if (now - this.lastReceipts >= RECEIPTS_EVERY_MS) {
        this.lastReceipts = now;
        await this.checkReceipts();
      }
      if (now - this.lastPrune >= PRUNE_EVERY_MS) {
        this.lastPrune = now;
        await this.prune();
      }
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.name : 'Error' },
        'Push worker round failed',
      );
    }
  }

  /** Sends every job that is due, a batch at a time; returns how many it handled. */
  async sendDue(): Promise<number> {
    let handled = 0;
    for (;;) {
      const jobs = await this.claim();
      if (jobs.length > 0) await this.deliver(jobs);
      handled += jobs.length;
      if (jobs.length < CLAIM_BATCH) return handled;
    }
  }

  /** Due jobs — waiting, or claimed by a worker whose lease ran out — taken by this one. */
  private claim(): Promise<ClaimedJob[]> {
    const now = this.clock.now();
    const leaseEnd = new Date(now.getTime() + LEASE_MS);
    return this.prisma.$queryRaw<ClaimedJob[]>`
      UPDATE "push_jobs"
      SET "status" = 'sending', "lockedUntil" = ${leaseEnd}::timestamptz, "attempts" = "attempts" + 1
      WHERE "id" IN (
        SELECT "id" FROM "push_jobs"
        WHERE ("status" = 'pending' AND "runAt" <= ${now}::timestamptz)
           OR ("status" = 'sending' AND "lockedUntil" <= ${now}::timestamptz)
        ORDER BY "runAt"
        LIMIT ${Prisma.raw(String(CLAIM_BATCH))}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "userId", "teamId", "title", "body", "data", "attempts", "expiresAt"`;
  }

  private async deliver(jobs: ClaimedJob[]): Promise<void> {
    const now = this.clock.now();
    const recipients = [...new Set(jobs.map((job) => job.userId))];
    const teams = new Map(
      (
        await this.prisma.teamMember.findMany({
          where: { userId: { in: recipients } },
          select: { userId: true, teamId: true },
        })
      ).map((member) => [member.userId, member.teamId]),
    );
    // Devices of live sessions only: a signed-out device gets nothing. (Sessions
    // live on the system clock, as everywhere in auth.)
    const devices = await this.prisma.pushDevice.findMany({
      where: {
        userId: { in: recipients },
        session: { revokedAt: null, expiresAt: { gt: new Date() } },
      },
      select: { id: true, userId: true, token: true },
    });

    const cancelled: Record<string, string[]> = {};
    const deliveries: Delivery[] = [];
    for (const job of jobs) {
      const own = devices.filter((device) => device.userId === job.userId);
      const reason =
        job.expiresAt <= now
          ? 'expired'
          : teams.get(job.userId) !== job.teamId
            ? 'notMember'
            : own.length === 0
              ? 'noDevice'
              : null;
      if (reason) (cancelled[reason] ??= []).push(job.id);
      else deliveries.push({ job, devices: own });
    }
    for (const [reason, ids] of Object.entries(cancelled)) {
      await this.prisma.pushJob.updateMany({
        where: { id: { in: ids } },
        data: { status: 'cancelled', reason, lockedUntil: null },
      });
    }
    for (const chunk of chunkDeliveries(deliveries, SEND_CHUNK)) await this.send(chunk, now);
  }

  private message(job: ClaimedJob, token: string, now: Date): ExpoPushMessage {
    return {
      to: token,
      title: job.title,
      body: job.body,
      data: job.data as Record<string, unknown>,
      channelId: TEAM_UPDATES_CHANNEL_ID,
      sound: 'default',
      priority: 'high',
      ttl: Math.max(60, Math.floor((job.expiresAt.getTime() - now.getTime()) / SECOND_MS)),
    };
  }

  /** One request to Expo, for whole jobs. */
  private async send(chunk: Delivery[], now: Date): Promise<void> {
    const messages = chunk.flatMap(({ job, devices }) =>
      devices.map((device) => ({ job, device, message: this.message(job, device.token, now) })),
    );
    let tickets;
    try {
      tickets = await this.transport.send(messages.map((entry) => entry.message));
    } catch (error) {
      await this.retryLater(
        chunk.map((delivery) => delivery.job),
        error,
        now,
      );
      return;
    }

    const accepted = new Set<string>();
    const errors = new Map<string, string[]>();
    const gone = new Set<string>();
    const kept: { id: string; deviceId: string; createdAt: Date }[] = [];
    tickets.forEach((ticket, index) => {
      const entry = messages[index];
      if (!entry) return;
      if (ticket.status === 'ok') {
        accepted.add(entry.job.id);
        kept.push({ id: ticket.id, deviceId: entry.device.id, createdAt: now });
        return;
      }
      const code = ticket.details?.error ?? 'UnknownError';
      errors.set(entry.job.id, [...(errors.get(entry.job.id) ?? []), code]);
      if (code === 'DeviceNotRegistered') gone.add(entry.device.id);
    });

    // Recorded at once: the smaller the gap after Expo's answer, the smaller
    // the chance a crash sends a job twice.
    const sent = chunk.filter(({ job }) => accepted.has(job.id)).map(({ job }) => job.id);
    if (sent.length > 0) {
      await this.prisma.pushJob.updateMany({
        where: { id: { in: sent } },
        data: { status: 'sent', sentAt: now, lockedUntil: null, reason: null },
      });
    }
    const unsent = chunk.filter(({ job }) => !accepted.has(job.id)).map(({ job }) => job);
    const later = unsent.filter((job) =>
      (errors.get(job.id) ?? []).every((code) => RETRYABLE_TICKET_ERRORS.has(code)),
    );
    const never = unsent.filter((job) => !later.includes(job));
    for (const job of never) {
      await this.prisma.pushJob.update({
        where: { id: job.id },
        data: { status: 'failed', lockedUntil: null, reason: errors.get(job.id)?.[0] ?? null },
      });
    }
    if (later.length > 0) {
      await this.retryLater(later, new ExpoPushError('MessageRateExceeded', true), now);
    }
    if (kept.length > 0) {
      await this.prisma.pushTicket.createMany({ data: kept, skipDuplicates: true });
    }
    if (gone.size > 0) await this.forgetDevices([...gone], 'DeviceNotRegistered');

    const codes = [...errors.values()].flat();
    this.logger.log(
      {
        jobs: chunk.length,
        messages: messages.length,
        accepted: kept.length,
        sent: sent.length,
        failed: never.length,
        ...(codes.length > 0 ? { errors: tally(codes) } : {}),
      },
      'Push sent',
    );
  }

  /** The request failed as a whole: its jobs wait and try again — or are given up. */
  private async retryLater(jobs: ClaimedJob[], error: unknown, now: Date): Promise<void> {
    const failure =
      error instanceof ExpoPushError
        ? error
        : new ExpoPushError(error instanceof Error ? error.name : 'Error', false);
    // Whatever went wrong, a token never reaches a log line or a row.
    const said = redactPushTokens(failure.message).slice(0, 200);
    const reason = failure.status ? `HTTP ${failure.status}` : said;
    let retried = 0;
    for (const job of jobs) {
      const stale = job.expiresAt <= now;
      if (!failure.retryable || job.attempts >= MAX_ATTEMPTS || stale) {
        await this.prisma.pushJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            lockedUntil: null,
            reason: stale ? 'expired' : reason,
          },
        });
        continue;
      }
      const wait = Math.max(backoffMs(job.attempts, job.id), failure.retryAfterMs ?? 0);
      await this.prisma.pushJob.update({
        where: { id: job.id },
        data: {
          status: 'pending',
          lockedUntil: null,
          runAt: new Date(now.getTime() + wait),
          reason,
        },
      });
      retried += 1;
    }
    this.logger.warn(
      {
        jobs: jobs.length,
        retried,
        failed: jobs.length - retried,
        status: failure.status,
        retryable: failure.retryable,
        reason: said,
      },
      'Push send failed',
    );
  }

  /**
   * Receipts for tickets old enough to have one. Only what they say about a
   * device matters here: one that is gone is forgotten. Checked tickets go.
   */
  async checkReceipts(): Promise<void> {
    const now = this.clock.now();
    const due = await this.prisma.pushTicket.findMany({
      where: { createdAt: { lte: new Date(now.getTime() - RECEIPT_DELAY_MS) } },
      orderBy: { createdAt: 'asc' },
      take: RECEIPTS_CHUNK * 10,
      select: { id: true, deviceId: true, createdAt: true },
    });
    for (const batch of chunks(due, RECEIPTS_CHUNK)) {
      let receipts;
      try {
        receipts = await this.transport.receipts(batch.map((ticket) => ticket.id));
      } catch (error) {
        // Next round.
        this.logger.warn(
          {
            tickets: batch.length,
            reason: redactPushTokens(error instanceof Error ? error.message : 'Error'),
          },
          'Push receipts unavailable',
        );
        return;
      }
      const checked: string[] = [];
      const gone = new Set<string>();
      const codes: string[] = [];
      for (const ticket of batch) {
        const receipt = receipts[ticket.id];
        if (!receipt) {
          // Not ready yet; after a day Expo no longer has it.
          if (ticket.createdAt.getTime() <= now.getTime() - RECEIPT_KEPT_MS)
            checked.push(ticket.id);
          continue;
        }
        checked.push(ticket.id);
        if (receipt.status === 'error') {
          const code = receipt.details?.error ?? 'UnknownError';
          codes.push(code);
          if (code === 'DeviceNotRegistered') gone.add(ticket.deviceId);
        }
      }
      if (checked.length > 0)
        await this.prisma.pushTicket.deleteMany({ where: { id: { in: checked } } });
      if (gone.size > 0) await this.forgetDevices([...gone], 'DeviceNotRegistered');
      this.logger.log(
        {
          tickets: batch.length,
          checked: checked.length,
          ...(codes.length > 0 ? { errors: tally(codes) } : {}),
        },
        'Push receipts',
      );
    }
  }

  /** Deletes what is no longer needed: finished jobs after a week, stale tickets, dead sessions' devices. */
  async prune(): Promise<void> {
    const now = this.clock.now().getTime();
    const jobs = await this.prisma.pushJob.deleteMany({
      where: {
        status: { in: ['sent', 'failed', 'cancelled'] },
        createdAt: { lt: new Date(now - JOBS_KEPT_MS) },
      },
    });
    const tickets = await this.prisma.pushTicket.deleteMany({
      where: { createdAt: { lt: new Date(now - RECEIPT_KEPT_MS) } },
    });
    // A session that ended without a logout (expired, or revoked for a replayed token).
    const devices = await this.prisma.pushDevice.deleteMany({
      where: {
        session: { OR: [{ revokedAt: { not: null } }, { expiresAt: { lte: new Date() } }] },
      },
    });
    if (jobs.count + tickets.count + devices.count > 0) {
      this.logger.log(
        { jobs: jobs.count, tickets: tickets.count, devices: devices.count },
        'Push pruned',
      );
    }
  }

  private async forgetDevices(ids: string[], reason: string): Promise<void> {
    const { count } = await this.prisma.pushDevice.deleteMany({ where: { id: { in: ids } } });
    this.logger.log({ deviceIds: ids, removed: count, reason }, 'Push device removed');
  }
}
