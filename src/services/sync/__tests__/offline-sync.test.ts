import { enqueueMutation } from '@/data/repositories/local/outbox';
import { startChallenge } from '@/features/onboarding/use-cases';
import { loadProgressState } from '@/features/progress/use-cases';
import { ApiError } from '@/services/api/api-error';

import { FAKE_QUEST_XP, FakeProgressServer } from '../__fixtures__/fake-progress-server';
import { ACCOUNT_A, TestDevice, playQuest } from '../__fixtures__/test-device';
import { BACKOFF } from '../progress-sync-engine';

// Jest runs this in Node; the app's tsconfig has no Node types.
declare const require: (id: 'os' | 'path' | 'fs') => unknown;
const { tmpdir } = require('os') as { tmpdir: () => string };
const { join } = require('path') as { join: (...parts: string[]) => string };
const { mkdtempSync } = require('fs') as { mkdtempSync: (prefix: string) => string };

/**
 * The phone's side of offline-first progress: play without a connection, keep
 * everything across restarts, send it when the connection comes back — once,
 * in order — and take the server's word for what it earned.
 */

const VOCABULARY = 'd001-vocabulary';
const GRAMMAR = 'd001-grammar';

let server: FakeProgressServer;
let phone: TestDevice;

beforeEach(() => {
  server = new FakeProgressServer();
  phone = new TestDevice(server);
});
afterEach(() => phone.close());

async function onboard(session: Awaited<ReturnType<TestDevice['open']>>) {
  await startChallenge(session.repositories, { displayName: 'Ada', goal: 'habit' });
}

describe('storing a change', () => {
  it('wakes the sync up by itself', async () => {
    const session = await phone.open(ACCOUNT_A, { autoSync: true });
    await onboard(session);
    await playQuest(session.repositories, VOCABULARY);
    await session.engine!.requestSync('manual');
    expect(server.progressOf(ACCOUNT_A).progress.questCompletions).toHaveLength(1);
    expect(await session.repositories.sync!.repository.counts()).toEqual({
      pending: 0,
      rejected: 0,
    });
  });
});

describe('offline', () => {
  it('shows a quest played offline at once, and keeps it in the outbox', async () => {
    phone.online = false;
    const session = await phone.open(ACCOUNT_A);
    await onboard(session);
    const outcome = await playQuest(session.repositories, VOCABULARY);

    // The screens read the local projection: the quest, its XP, the day's progress.
    expect(outcome.isFirstCompletion).toBe(true);
    const state = await loadProgressState(session.repositories);
    expect(state.todayCompletedQuestIds).toEqual([VOCABULARY]);
    expect(state.totalXp).toBeGreaterThan(0);

    // What the server has to hear: the start and the quest — answers, not XP.
    const outbox = await session.repositories.sync!.repository.outbox();
    expect(outbox.map((entry) => [entry.type, entry.status])).toEqual([
      ['startChallenge', 'pending'],
      ['completeQuest', 'pending'],
    ]);
    const [, quest] = await session.repositories.sync!.repository.pending(10);
    expect(quest).toMatchObject({ type: 'completeQuest', payload: { questId: VOCABULARY } });
    expect(JSON.stringify(quest)).not.toMatch(/xp/i);

    // Offline, nothing was even tried.
    await session.engine!.requestSync('manual');
    expect(server.requests).toEqual([]);
    expect(session.engine!.current()).toMatchObject({ state: 'offline', pending: 2 });
  });

  it('keeps the progress and the outbox when the app restarts offline', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'milo-')), 'milo.db');
    const first = new TestDevice(server, path);
    first.online = false;
    const session = await first.open(ACCOUNT_A);
    await onboard(session);
    await playQuest(session.repositories, VOCABULARY);
    session.dispose();
    await first.close();

    const again = new TestDevice(server, path, 100);
    again.online = false;
    const reopened = await again.open(ACCOUNT_A);
    expect((await loadProgressState(reopened.repositories)).todayCompletedQuestIds).toEqual([
      VOCABULARY,
    ]);
    expect(await reopened.repositories.sync!.repository.counts()).toEqual({
      pending: 2,
      rejected: 0,
    });
    await again.close();
  });

  it('sends everything when the connection is back: in order, once, then the server’s word', async () => {
    phone.online = false;
    const session = await phone.open(ACCOUNT_A);
    await onboard(session);
    await playQuest(session.repositories, VOCABULARY);

    phone.online = true;
    await session.engine!.requestSync('online');

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0]?.request.mutations.map((mutation) => mutation.type)).toEqual([
      'startChallenge',
      'completeQuest',
    ]);
    const sync = session.repositories.sync!.repository;
    expect(await sync.counts()).toEqual({ pending: 0, rejected: 0 });
    expect(await sync.state()).toMatchObject({ revision: 2 });
    // The projection is the server's now: its XP, confirmed.
    const state = await loadProgressState(session.repositories);
    expect(state.todayCompletedQuestIds).toEqual([VOCABULARY]);
    expect(state.totalXp).toBe(FAKE_QUEST_XP);
    const unconfirmed = await (
      await phone.store.read()
    ).getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM quest_completions WHERE pending_mutation_id IS NOT NULL',
    );
    expect(unconfirmed).toEqual({ n: 0 });
    expect(session.engine!.current()).toMatchObject({ state: 'idle', pending: 0, revision: 2 });
  });

  it('keeps everything when the network fails, and tries again later — with backoff', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const session = await phone.open(ACCOUNT_A);
      await onboard(session);
      // Connected, but the server cannot be reached.
      server.offline = true;
      await session.engine!.requestSync('mutation');
      expect(session.engine!.current()).toMatchObject({ state: 'offline', pending: 1 });
      const [entry] = await session.repositories.sync!.repository.outbox();
      expect(entry).toMatchObject({ status: 'pending', attemptCount: 1 });

      // Not before the backoff: no tight loop.
      server.offline = false;
      await jest.advanceTimersByTimeAsync(BACKOFF.baseMs * 0.5);
      expect(server.requests).toHaveLength(1);
      await jest.advanceTimersByTimeAsync(BACKOFF.baseMs);
      expect(server.requests).toHaveLength(2);
      expect(await session.repositories.sync!.repository.counts()).toEqual({
        pending: 0,
        rejected: 0,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('sets a refused change aside for good, and takes back what it showed', async () => {
    const session = await phone.open(ACCOUNT_A);
    await onboard(session);
    await session.engine!.requestSync('mutation');
    server.refuse.set(VOCABULARY, 'QUEST_NOT_AVAILABLE');
    await playQuest(session.repositories, VOCABULARY);
    await session.engine!.requestSync('mutation');

    const sync = session.repositories.sync!.repository;
    expect(await sync.outbox()).toEqual([
      expect.objectContaining({
        type: 'completeQuest',
        status: 'rejected',
        errorCode: 'QUEST_NOT_AVAILABLE',
      }),
    ]);
    const state = await loadProgressState(session.repositories);
    expect(state.todayCompletedQuestIds).toEqual([]);
    expect(state.totalXp).toBe(0);
    // Never sent again.
    const sent = server.requests.length;
    await session.engine!.requestSync('manual');
    expect(server.requests.slice(sent).flatMap((item) => item.request.mutations)).toEqual([]);
  });

  it('runs one sync at a time, and one more for what came in meanwhile', async () => {
    const session = await phone.open(ACCOUNT_A);
    await onboard(session);
    server.hold();
    const first = session.engine!.requestSync('mutation');
    await playQuest(session.repositories, VOCABULARY);
    const second = session.engine!.requestSync('mutation');
    const third = session.engine!.requestSync('foreground');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(server.requests).toHaveLength(1);
    server.release();
    await Promise.all([first, second, third]);
    await new Promise((resolve) => setTimeout(resolve, 50));
    // The run after: the quest played while the first request was on its way.
    expect(server.requests.map((item) => item.request.mutations.length)).toEqual([1, 1]);
    expect(await session.repositories.sync!.repository.counts()).toEqual({
      pending: 0,
      rejected: 0,
    });
  });

  it('sends a long outbox in batches of 50, oldest first', async () => {
    const session = await phone.open(ACCOUNT_A);
    await onboard(session);
    const owner = session.owner;
    await phone.store.write((db) =>
      db.withExclusiveTransactionAsync(async (txn) => {
        for (let index = 0; index < 60; index++) {
          await enqueueMutation(txn, owner, {
            id: phone.services.newId(),
            type: 'completeQuest',
            createdAt: new Date(Date.UTC(2026, 8, 1, 9, 0, index)).toISOString(),
            payload: {
              courseId: 'milo-english-90',
              courseVersion: 1,
              questId: `d001-extra-${index}`,
              answers: [],
              completedAt: new Date(Date.UTC(2026, 8, 1, 9, 0, index)).toISOString(),
            },
          });
        }
      }),
    );
    await session.engine!.requestSync('manual');
    expect(server.requests.map((item) => item.request.mutations.length)).toEqual([50, 11]);
    const questIds = server.requests.flatMap((item) =>
      item.request.mutations.flatMap((mutation) =>
        mutation.type === 'completeQuest' ? [mutation.payload.questId] : [],
      ),
    );
    expect(questIds).toEqual(Array.from({ length: 60 }, (_, index) => `d001-extra-${index}`));
  });

  it('waits, whole, when the server cannot check the course version', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const session = await phone.open(ACCOUNT_A);
      await onboard(session);
      await session.engine!.requestSync('mutation');
      await playQuest(session.repositories, VOCABULARY);
      await playQuest(session.repositories, GRAMMAR);
      server.unsupportedVersion = 1;
      await session.engine!.requestSync('mutation');
      expect(session.engine!.current()).toMatchObject({ state: 'blocked', pending: 2 });
      // No retry loop: it waits for the next occasion.
      const sent = server.requests.length;
      await jest.advanceTimersByTimeAsync(BACKOFF.maxMs * 2);
      expect(server.requests).toHaveLength(sent);
      // Once the server can check it, everything goes, in order.
      server.unsupportedVersion = null;
      await session.engine!.requestSync('foreground');
      expect(await session.repositories.sync!.repository.counts()).toEqual({
        pending: 0,
        rejected: 0,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('sets aside a change the server cannot even read, and sends the rest', async () => {
    const session = await phone.open(ACCOUNT_A);
    await onboard(session);
    await session.engine!.requestSync('mutation');
    await playQuest(session.repositories, VOCABULARY);
    await playQuest(session.repositories, GRAMMAR);
    const [unreadable] = await session.repositories.sync!.repository.pending(1);
    // The server refuses the whole request while that change is in it.
    const api = phone.services.progressApi!;
    const sync = api.sync.bind(api);
    api.sync = async (request, signal) => {
      if (request.mutations.some((mutation) => mutation.id === unreadable?.id)) {
        throw new ApiError('VALIDATION_ERROR', 'Some fields are not valid.', 400);
      }
      return sync(request, signal);
    };
    await session.engine!.requestSync('mutation');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const outbox = await session.repositories.sync!.repository.outbox();
    expect(outbox).toEqual([
      expect.objectContaining({ mutationId: unreadable?.id, errorCode: 'INVALID_MUTATION' }),
    ]);
    expect(server.progressOf(ACCOUNT_A).progress.questCompletions.map((c) => c.questId)).toEqual([
      GRAMMAR,
    ]);
  });
});
