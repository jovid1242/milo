import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';

import request from 'supertest';

import type { AuthSession, PushKind } from '@/schemas';

import {
  ExpoPushError,
  type ExpoPushMessage,
  type ExpoPushReceipt,
  type ExpoPushTicket,
  type PushTransport,
} from '../src/push/expo-push.transport';
import type { PrismaService } from '../src/prisma/prisma.service';
import { bearer } from './helpers';

/** A token as `getExpoPushTokenAsync` makes them. */
export const pushToken = () =>
  `ExponentPushToken[${randomBytes(16).toString('base64url').slice(0, 22)}]`;

/** Settings → Team notifications, on: this session's device registers its token. */
export async function registerDevice(
  http: Server,
  session: AuthSession,
  token: string,
  platform: 'android' | 'ios' = 'android',
) {
  await request(http)
    .put('/api/v1/push/devices/current')
    .set('Authorization', bearer(session))
    .send({ token, platform })
    .expect(204);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Expo's push service, played in the test: it records every request and
 * answers as it is told. Nothing leaves the process — a test never sends a
 * real push.
 */
export class FakeExpo implements PushTransport {
  readonly requests: ExpoPushMessage[][] = [];
  readonly receiptRequests: string[][] = [];
  /** Tokens whose tickets come back with this error. */
  readonly ticketErrors = new Map<string, string>();
  /** Tokens whose receipts come back with this error. */
  readonly receiptErrors = new Map<string, string>();
  /** How long each send takes (to make workers overlap). */
  delayMs = 0;
  private readonly failures: Error[] = [];
  private readonly tickets = new Map<string, string>();
  private next = 0;

  /** The next sends fail as a whole, one error each. */
  failNext(...errors: Error[]) {
    this.failures.push(...errors);
  }

  get messages(): ExpoPushMessage[] {
    return this.requests.flat();
  }

  async send(messages: readonly ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
    this.requests.push([...messages]);
    if (this.delayMs > 0) await sleep(this.delayMs);
    const failure = this.failures.shift();
    if (failure) throw failure;
    return messages.map((message): ExpoPushTicket => {
      const error = this.ticketErrors.get(message.to);
      if (error) {
        // As Expo words it: with the token in it.
        return {
          status: 'error',
          message: `"${message.to}" is not a registered push notification recipient`,
          details: { error },
        };
      }
      this.next += 1;
      const id = `ticket-${this.next}`;
      this.tickets.set(id, message.to);
      return { status: 'ok', id };
    });
  }

  receipts(ids: readonly string[]): Promise<Record<string, ExpoPushReceipt>> {
    this.receiptRequests.push([...ids]);
    return Promise.resolve(this.receiptsFor(ids));
  }

  private receiptsFor(ids: readonly string[]): Record<string, ExpoPushReceipt> {
    return Object.fromEntries(
      ids.flatMap((id): [string, ExpoPushReceipt][] => {
        const token = this.tickets.get(id);
        if (!token) return [];
        const error = this.receiptErrors.get(token);
        return [
          [
            id,
            error
              ? { status: 'error', message: `"${token}" is not registered`, details: { error } }
              : { status: 'ok' },
          ],
        ];
      }),
    );
  }
}

export const tooManyRequests = (retryAfterMs: number | null = null) =>
  new ExpoPushError("Expo's push service answered 429", true, 429, retryAfterMs);
export const serverError = () => new ExpoPushError("Expo's push service answered 503", true, 503);
export const unreachable = () =>
  new ExpoPushError("Expo's push service could not be reached (TypeError)", true);

/** Jobs as `TeamNews` queues them, put in place directly for the worker. */
export async function seedJobs(
  prisma: PrismaService,
  input: {
    userId: string;
    teamId: string;
    count: number;
    now: Date;
    kind?: PushKind;
    expiresAt?: Date;
    label?: string;
  },
) {
  const kind = input.kind ?? 'TEAM_MEMBER_COMPLETED_DAY';
  await prisma.pushJob.createMany({
    data: Array.from({ length: input.count }, (_, index) => ({
      dedupeKey: `test:${input.label ?? 'job'}:${input.userId}:${index}`,
      userId: input.userId,
      kind,
      priority: 1,
      teamId: input.teamId,
      eventDate: null,
      title: `${input.label ?? 'Job'} ${index + 1}`,
      body: 'Test news',
      data: { kind, teamId: input.teamId },
      runAt: input.now,
      expiresAt: input.expiresAt ?? new Date(input.now.getTime() + 6 * 3_600_000),
      createdAt: input.now,
    })),
  });
}
