import { Writable } from 'node:stream';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthSessionSchema, MyTeamResponseSchema, type AuthSession } from '@/schemas';

import {
  ExpoHttpTransport,
  ExpoPushError,
  PUSH_TRANSPORT,
  refusingTransport,
} from '../src/push/expo-push.transport';
import { backoffMs, PushWorker } from '../src/push/push-worker';
import {
  bearer,
  PASSWORD,
  register,
  resetDatabase,
  startApp,
  TestClock,
  type TestApp,
} from './helpers';
import { startChallenge, sync } from './progress-fixtures';
import {
  FakeExpo,
  pushToken,
  registerDevice,
  seedJobs,
  serverError,
  tooManyRequests,
  unreachable,
} from './push-fixtures';

/**
 * The push worker: the outbox sent through Expo — batched, retried with
 * backoff, receipts checked, never twice by two workers, never a token in a log.
 */

const NOW = '2026-09-01T10:00:00.000Z';
const clock = new TestClock(new Date(NOW));
const expo = new FakeExpo();
const logged: string[] = [];
let t: TestApp;
let worker: PushWorker;

beforeAll(async () => {
  // nestjs-pino keeps the first app's logger for the whole file: this one's.
  t = await startApp({
    clock,
    pushTransport: expo,
    env: { LOG_LEVEL: 'info' },
    logDestination: new Writable({
      write(chunk: Buffer, _encoding, done) {
        logged.push(chunk.toString());
        done();
      },
    }),
  });
  worker = t.app.get(PushWorker);
});
afterAll(() => t.close());

beforeEach(async () => {
  await resetDatabase(t.prisma);
  clock.set(NOW);
  expo.requests.length = 0;
  expo.receiptRequests.length = 0;
  expo.ticketErrors.clear();
  expo.receiptErrors.clear();
  expo.delayMs = 0;
});

type Member = { session: AuthSession; id: string; teamId: string; tokens: string[] };

async function login(email: string): Promise<AuthSession> {
  const response = await request(t.http)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return AuthSessionSchema.parse(response.body);
}

/** Someone in a team of their own, with notifications on on `devices` devices. */
async function member(name: string, devices = 1): Promise<Member> {
  const email = `${name}@example.com`;
  const session = await register(t.http, email);
  await sync(t.http, session, [startChallenge('2026-09-01')]);
  const created = await request(t.http)
    .post('/api/v1/teams')
    .set('Authorization', bearer(session))
    .expect(201);
  const teamId = MyTeamResponseSchema.parse(created.body).team?.id ?? '';
  const tokens: string[] = [];
  for (let index = 0; index < devices; index += 1) {
    const device = index === 0 ? session : await login(email);
    const token = pushToken();
    await registerDevice(t.http, device, token);
    tokens.push(token);
  }
  return { session, id: session.user.id, teamId, tokens };
}

const jobs = () => t.prisma.pushJob.findMany({ orderBy: { title: 'asc' } });
const statuses = async () => (await jobs()).map((job) => job.status);

describe('sending', () => {
  it('sends a due job to every device of its recipient, with only the typed payload', async () => {
    const ada = await member('ada', 2);
    await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 1, now: clock.now() });

    expect(await worker.sendDue()).toBe(1);
    expect(expo.requests).toHaveLength(1);
    expect(expo.messages.map((message) => message.to).sort()).toEqual([...ada.tokens].sort());
    expect(expo.messages[0]).toEqual({
      to: expect.any(String),
      title: 'Job 1',
      body: 'Test news',
      data: { kind: 'TEAM_MEMBER_COMPLETED_DAY', teamId: ada.teamId },
      channelId: 'team-updates',
      sound: 'default',
      priority: 'high',
      ttl: 6 * 3600,
    });
    const [job] = await jobs();
    expect(job).toMatchObject({ status: 'sent', attempts: 1, sentAt: new Date(NOW) });
    // Accepted is not delivered: each ticket waits for its receipt.
    expect(await t.prisma.pushTicket.count()).toBe(2);

    // Nothing is due any more.
    expect(await worker.sendDue()).toBe(0);
    expect(expo.requests).toHaveLength(1);
  });

  it('batches whole jobs, never more than 100 messages in a request', async () => {
    const ada = await member('ada', 3);
    await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 150, now: clock.now() });

    expect(await worker.sendDue()).toBe(150);
    expect(expo.requests.map((messages) => messages.length)).toEqual([99, 99, 99, 3, 99, 51]);
    for (const messages of expo.requests) expect(messages.length % 3).toBe(0);
    expect(new Set(expo.messages.map((message) => `${message.title}/${message.to}`)).size).toBe(
      450,
    );
    expect(new Set(await statuses())).toEqual(new Set(['sent']));
  });

  it('does not send old news, news about a team they are not in, or to someone signed out', async () => {
    const [ada, bea, cy] = [await member('ada'), await member('bea'), await member('cy')];
    const now = clock.now();
    await seedJobs(t.prisma, {
      userId: ada.id,
      teamId: ada.teamId,
      count: 1,
      now,
      expiresAt: new Date(now.getTime() - 1),
      label: 'Old',
    });
    // News about Ada's team, for Bea — who is not in it (any more).
    await seedJobs(t.prisma, { userId: bea.id, teamId: ada.teamId, count: 1, now, label: 'Left' });
    await seedJobs(t.prisma, { userId: cy.id, teamId: cy.teamId, count: 1, now, label: 'Out' });
    await request(t.http)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: cy.session.refreshToken })
      .expect(204);

    await worker.sendDue();
    expect(expo.requests).toEqual([]);
    expect((await jobs()).map((job) => [job.title, job.status, job.reason])).toEqual([
      ['Left 1', 'cancelled', 'notMember'],
      ['Old 1', 'cancelled', 'expired'],
      ['Out 1', 'cancelled', 'noDevice'],
    ]);
  });

  it('a team that is gone takes its waiting news with it', async () => {
    const ada = await member('ada');
    await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 1, now: clock.now() });
    // The last member leaves: the team is deleted.
    await request(t.http)
      .post(`/api/v1/teams/${ada.teamId}/leave`)
      .set('Authorization', bearer(ada.session))
      .expect(204);
    expect(await t.prisma.pushJob.count()).toBe(0);
  });
});

describe('when Expo fails', () => {
  it('tries again after a 429, a 5xx or no answer — backing off — until it gets through', async () => {
    const ada = await member('ada');
    await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 1, now: clock.now() });
    const [seeded] = await jobs();
    const id = seeded?.id ?? '';

    // 429 with Retry-After: the job waits at least that long.
    expo.failNext(tooManyRequests(60_000), serverError(), unreachable());
    await worker.sendDue();
    expect(await jobs()).toEqual([
      expect.objectContaining({
        status: 'pending',
        attempts: 1,
        reason: 'HTTP 429',
        runAt: new Date(Date.parse(NOW) + Math.max(60_000, backoffMs(1, id))),
      }),
    ]);
    expect(await worker.sendDue()).toBe(0);

    clock.advanceMinutes(1);
    await worker.sendDue();
    expect(await jobs()).toEqual([
      expect.objectContaining({ status: 'pending', attempts: 2, reason: 'HTTP 503' }),
    ]);
    const second = (await jobs())[0]?.runAt.getTime() ?? 0;
    expect(second - clock.now().getTime()).toBe(backoffMs(2, id));
    expect(backoffMs(2, id)).toBeGreaterThan(backoffMs(1, id));

    clock.set(new Date(second).toISOString());
    await worker.sendDue();
    expect(await jobs()).toEqual([expect.objectContaining({ status: 'pending', attempts: 3 })]);

    clock.set(new Date((await jobs())[0]?.runAt.getTime() ?? 0).toISOString());
    await worker.sendDue();
    expect(await jobs()).toEqual([
      expect.objectContaining({ status: 'sent', attempts: 4, reason: null }),
    ]);
    expect(expo.requests).toHaveLength(4);
  });

  it('gives up after six tries, and at once on a request Expo refuses', async () => {
    const ada = await member('ada');
    await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 1, now: clock.now() });
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      expo.failNext(serverError());
      await worker.sendDue();
      clock.advanceMinutes(16);
    }
    expect(await jobs()).toEqual([
      expect.objectContaining({ status: 'failed', attempts: 6, reason: 'HTTP 503' }),
    ]);

    await seedJobs(t.prisma, {
      userId: ada.id,
      teamId: ada.teamId,
      count: 1,
      now: clock.now(),
      label: 'Refused',
    });
    expo.failNext(new ExpoPushError('refused (400: VALIDATION_ERROR)', false, 400));
    await worker.sendDue();
    expect((await jobs()).find((job) => job.title === 'Refused 1')).toMatchObject({
      status: 'failed',
      attempts: 1,
      reason: 'HTTP 400',
    });
  });

  it('a worker that died mid-send lets its jobs go when the lease passes', async () => {
    const ada = await member('ada');
    await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 2, now: clock.now() });
    const [first, second] = await jobs();
    // One claimed by a worker that is gone, one by a worker still at it.
    await t.prisma.pushJob.update({
      where: { id: first?.id },
      data: { status: 'sending', attempts: 1, lockedUntil: new Date(Date.parse(NOW) - 1) },
    });
    await t.prisma.pushJob.update({
      where: { id: second?.id },
      data: { status: 'sending', attempts: 1, lockedUntil: new Date(Date.parse(NOW) + 30_000) },
    });

    expect(await worker.sendDue()).toBe(1);
    expect((await jobs()).map((job) => [job.title, job.status, job.attempts])).toEqual([
      ['Job 1', 'sent', 2],
      ['Job 2', 'sending', 1],
    ]);
  });
});

describe('devices that are gone', () => {
  it('are forgotten when a ticket says so — the job still reaches the others', async () => {
    const ada = await member('ada', 2);
    const [gone, live] = ada.tokens;
    expo.ticketErrors.set(gone ?? '', 'DeviceNotRegistered');
    await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 1, now: clock.now() });

    await worker.sendDue();
    expect(await statuses()).toEqual(['sent']);
    expect((await t.prisma.pushDevice.findMany()).map((device) => device.token)).toEqual([live]);
  });

  it('are forgotten when a receipt says so, once it is ready; checked tickets go', async () => {
    const [ada, bea] = [await member('ada'), await member('bea')];
    await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 1, now: clock.now() });
    await seedJobs(t.prisma, { userId: bea.id, teamId: bea.teamId, count: 1, now: clock.now() });
    await worker.sendDue();
    expect(await t.prisma.pushTicket.count()).toBe(2);
    expo.receiptErrors.set(bea.tokens[0] ?? '', 'DeviceNotRegistered');

    // Not before about 15 minutes.
    clock.advanceMinutes(10);
    await worker.checkReceipts();
    expect(expo.receiptRequests).toEqual([]);

    clock.advanceMinutes(6);
    await worker.checkReceipts();
    expect(expo.receiptRequests).toHaveLength(1);
    expect(await t.prisma.pushTicket.count()).toBe(0);
    expect((await t.prisma.pushDevice.findMany()).map((device) => device.userId)).toEqual([ada.id]);
  });

  it('a receipt that never comes is given up after a day', async () => {
    const ada = await member('ada');
    await t.prisma.pushTicket.create({
      data: {
        id: 'ticket-unknown',
        deviceId: (await t.prisma.pushDevice.findFirstOrThrow()).id,
        createdAt: clock.now(),
      },
    });
    clock.advanceMinutes(20);
    await worker.checkReceipts();
    expect(await t.prisma.pushTicket.count()).toBe(1);
    clock.advanceDays(1);
    await worker.checkReceipts();
    expect(await t.prisma.pushTicket.count()).toBe(0);
    expect(await t.prisma.pushDevice.count({ where: { userId: ada.id } })).toBe(1);
  });
});

describe('two workers', () => {
  it('never send the same job twice', async () => {
    const other = new FakeExpo();
    const second = await startApp({ clock, pushTransport: other });
    try {
      const ada = await member('ada');
      await seedJobs(t.prisma, {
        userId: ada.id,
        teamId: ada.teamId,
        count: 250,
        now: clock.now(),
      });
      expo.delayMs = 15;
      other.delayMs = 15;
      const secondWorker = second.app.get(PushWorker);
      await Promise.all([
        worker.sendDue(),
        secondWorker.sendDue(),
        worker.sendDue(),
        secondWorker.sendDue(),
      ]);

      const titles = [...expo.messages, ...other.messages].map((message) => message.title);
      expect(titles).toHaveLength(250);
      expect(new Set(titles).size).toBe(250);
      expect(expo.messages.length).toBeGreaterThan(0);
      expect(other.messages.length).toBeGreaterThan(0);
      expect(new Set(await statuses())).toEqual(new Set(['sent']));
    } finally {
      await second.close();
    }
  });
});

describe('the worker process', () => {
  it('runs by itself when enabled, and stops with the app', async () => {
    const own = new FakeExpo();
    const running = await startApp({
      clock,
      pushTransport: own,
      env: { PUSH_WORKER_ENABLED: 'true' },
    });
    try {
      const ada = await member('ada');
      await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 1, now: clock.now() });
      for (let waited = 0; own.messages.length === 0 && waited < 10_000; waited += 50)
        await new Promise((resolve) => setTimeout(resolve, 50));
      expect(own.messages).toHaveLength(1);
    } finally {
      await running.close();
    }
  });

  it('never reaches Expo from a test: without a fake, sending fails', async () => {
    const bare = await startApp({ clock });
    try {
      expect(bare.app.get(PUSH_TRANSPORT)).toBe(refusingTransport);
    } finally {
      await bare.close();
    }
  });
});

describe('pruning', () => {
  it('deletes finished jobs after a week, stale tickets, and devices of ended sessions', async () => {
    const [ada, bea] = [await member('ada'), await member('bea')];
    await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 2, now: clock.now() });
    await worker.sendDue();
    await seedJobs(t.prisma, {
      userId: ada.id,
      teamId: ada.teamId,
      count: 1,
      now: clock.now(),
      label: 'Waiting',
    });
    // Bea's session ends without a logout (revoked for a replayed token, say).
    await t.prisma.refreshSession.updateMany({
      where: { userId: bea.id },
      data: { revokedAt: new Date(), revokedReason: 'reuse' },
    });

    clock.advanceDays(8);
    await worker.prune();
    expect((await jobs()).map((job) => job.title)).toEqual(['Waiting 1']);
    expect(await t.prisma.pushTicket.count()).toBe(0);
    expect((await t.prisma.pushDevice.findMany()).map((device) => device.userId)).toEqual([ada.id]);
  });
});

describe('Expo over HTTP', () => {
  type Call = { url: string; init: RequestInit };
  const answer = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    const calls: Call[] = [];
    const fetchImpl = ((url: string, init?: RequestInit) => {
      calls.push({ url, init: init ?? {} });
      return Promise.resolve(
        new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers }),
      );
    }) as unknown as typeof fetch;
    return { calls, fetchImpl };
  };
  const message = {
    to: 'ExponentPushToken[abcdefghijklmnopqrstuv]',
    title: 'T',
    body: 'B',
    data: {},
    channelId: 'team-updates',
    sound: 'default' as const,
    priority: 'high' as const,
    ttl: 60,
  };

  it('posts the messages to Expo, with the access token when there is one', async () => {
    const { calls, fetchImpl } = answer(200, { data: [{ status: 'ok', id: 'r-1' }] });
    const tickets = await new ExpoHttpTransport('secret-access', fetchImpl).send([message]);
    expect(tickets).toEqual([{ status: 'ok', id: 'r-1' }]);
    expect(calls[0]?.url).toBe('https://exp.host/--/api/v2/push/send');
    expect(calls[0]?.init.headers).toMatchObject({
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: 'Bearer secret-access',
    });
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual([message]);

    const anonymous = answer(200, { data: [{ status: 'ok', id: 'r-2' }] });
    await new ExpoHttpTransport(null, anonymous.fetchImpl).send([message]);
    expect(anonymous.calls[0]?.init.headers).not.toHaveProperty('authorization');
  });

  it('calls 429, 5xx and no answer worth a retry — with Retry-After — and a 4xx not', async () => {
    const send = (fetchImpl: typeof fetch) =>
      new ExpoHttpTransport(null, fetchImpl).send([message]);
    await expect(send(answer(429, '', { 'retry-after': '7' }).fetchImpl)).rejects.toMatchObject({
      retryable: true,
      status: 429,
      retryAfterMs: 7_000,
    });
    await expect(send(answer(502, 'Bad gateway').fetchImpl)).rejects.toMatchObject({
      retryable: true,
      status: 502,
    });
    const offline = (() => Promise.reject(new TypeError('fetch failed'))) as typeof fetch;
    await expect(send(offline)).rejects.toMatchObject({ retryable: true, status: null });

    const refused = send(
      answer(400, {
        errors: [{ code: 'VALIDATION_ERROR', message: `"${message.to}" is not a valid token` }],
      }).fetchImpl,
    );
    await expect(refused).rejects.toMatchObject({ retryable: false, status: 400 });
    await expect(refused).rejects.toThrow('VALIDATION_ERROR');
    await expect(refused).rejects.not.toThrow('abcdefghijklmnopqrstuv');
    // Not a ticket for every message: nothing can be matched up.
    await expect(send(answer(200, { data: [] }).fetchImpl)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it('reads receipts', async () => {
    const { calls, fetchImpl } = answer(200, {
      data: {
        'r-1': { status: 'ok' },
        'r-2': { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
      },
    });
    const receipts = await new ExpoHttpTransport(null, fetchImpl).receipts(['r-1', 'r-2']);
    expect(receipts['r-2']).toMatchObject({ details: { error: 'DeviceNotRegistered' } });
    expect(calls[0]?.url).toBe('https://exp.host/--/api/v2/push/getReceipts');
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({ ids: ['r-1', 'r-2'] });
  });
});

describe('logs', () => {
  it('never show a token — whatever happens to it', async () => {
    logged.length = 0;
    const ada = await member('ada', 2);
    const [gone, live] = ada.tokens;
    expo.ticketErrors.set(gone ?? '', 'DeviceNotRegistered');
    await seedJobs(t.prisma, { userId: ada.id, teamId: ada.teamId, count: 2, now: clock.now() });
    // A failure whose words quote a token, then a send with a ticket that does.
    expo.failNext(new ExpoPushError(`Expo refused "${live ?? ''}"`, true));
    await worker.sendDue();
    clock.advanceMinutes(5);
    await worker.sendDue();
    expo.receiptErrors.set(live ?? '', 'MessageTooBig');
    clock.advanceMinutes(20);
    await worker.checkReceipts();
    await request(t.http).post('/api/v1/push/devices/unregister').send({ token: live }).expect(204);

    const text = logged.join('');
    for (const token of ada.tokens) {
      expect(text).not.toContain(token);
      expect(text).not.toContain(token.slice('ExponentPushToken['.length, -1));
    }
    const messages = logged.map((line) => (JSON.parse(line) as { msg?: string }).msg);
    expect(messages).toEqual(
      expect.arrayContaining([
        'Push device',
        'Push send failed',
        'Push sent',
        'Push device removed',
        'Push receipts',
      ]),
    );
  });
});
