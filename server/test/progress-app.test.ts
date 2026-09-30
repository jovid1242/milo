import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SqliteSyncRepository } from '@/data/repositories/local/sqlite-sync-repository';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { startChallenge } from '@/features/onboarding/use-cases';
import { loadProgressState } from '@/features/progress/use-cases';
import type { OwnerSession } from '@/services/session/owner-session';
import { playQuest } from '@/services/sync/__fixtures__/test-device';

import { PASSWORD, resetDatabase, startApp, type TestApp } from './helpers';
import { Phone } from './phone';

/**
 * The app's own progress code — its SQLite schema and repositories, its
 * sessions, its sync engine, over real HTTP — against this server and its
 * PostgreSQL: what the phone runs is what these tests run. Only the phone's
 * SQLite is Node's here instead of iOS's.
 */

let t: TestApp;
beforeAll(async () => {
  t = await startApp({ listen: true });
});
afterAll(() => t.close());

const phones: Phone[] = [];
const phone = (path?: string) => {
  const created = new Phone(t.baseUrl, path);
  phones.push(created);
  return created;
};

beforeEach(async () => {
  await resetDatabase(t.prisma);
});
afterEach(async () => {
  for (const item of phones.splice(0)) await item.close();
});

const register = async (email: string) => {
  const setup = phone();
  const session = await setup.signUp(email);
  await setup.signOut(session);
  return session.owner;
};

const view = async (session: OwnerSession) => {
  const state = await loadProgressState(session.repositories);
  return { day: state.currentDay, xp: state.totalXp, quests: state.todayCompletedQuestIds };
};

describe('the account switch', () => {
  it('A (Day 10, 500 XP) → logout → B fresh (Day 1, 0 XP) → logout → A (Day 10, 500 XP)', async () => {
    const a = await register('ada@example.com');
    // Account A as the server holds it: on Day 10, with 500 XP earned.
    const challenge = await t.prisma.userChallenge.create({
      data: {
        userId: a,
        courseId: 'milo-english-90',
        startDate: new Date(`${getStartDateForDay(10, new Date())}T00:00:00.000Z`),
        timeZone: 'UTC',
        revision: 3,
      },
    });
    await t.prisma.xpLedgerEntry.createMany({
      data: [
        { amount: 300, reason: 'quest' as const, refId: 'd001-vocabulary' },
        { amount: 200, reason: 'achievement' as const, refId: 'firstDay' },
      ].map((entry) => ({
        ...entry,
        challengeId: challenge.id,
        createdAt: new Date(),
        mutationId: randomUUID(),
      })),
    });

    const device = phone();
    const first = await device.signIn('ada@example.com');
    expect(await view(first)).toMatchObject({ day: 10, xp: 500 });
    await device.signOut(first);

    const b = await device.signUp('bea@example.com');
    // Onboarding for B — and nothing of A's anywhere.
    expect(b.initialUser.onboardedAt).toBeNull();
    expect(await view(b)).toEqual({ day: 1, xp: 0, quests: [] });
    await expect(b.repositories.progress.getCompletions()).resolves.toEqual([]);
    await device.signOut(b);

    const again = await device.signIn('ada@example.com');
    expect(await view(again)).toMatchObject({ day: 10, xp: 500 });
  });

  it('sends A’s offline progress as A — never as B', async () => {
    const device = phone();
    const a = await device.signUp('ada@example.com');
    await startChallenge(a.repositories, { displayName: 'Ada', goal: 'habit' });
    await a.engine!.requestSync('manual');
    device.online = false;
    await playQuest(a.repositories, 'd001-vocabulary');
    device.online = true;
    // Out before it could sync: A's change waits on the phone.
    await device.signOut(a);

    const b = await device.signUp('bea@example.com');
    await startChallenge(b.repositories, { displayName: 'Bea', goal: 'vocabulary' });
    await b.engine!.requestSync('manual');
    await device.signOut(b);
    expect(await t.prisma.questCompletion.count()).toBe(0);
    await expect(new SqliteSyncRepository(device.store, a.owner).counts()).resolves.toEqual({
      pending: 1,
      rejected: 0,
    });

    const back = await device.signIn('ada@example.com');
    await back.engine!.requestSync('manual');
    const saved = await t.prisma.questCompletion.findMany({ include: { challenge: true } });
    expect(saved.map((row) => [row.challenge.userId, row.questId])).toEqual([
      [a.owner, 'd001-vocabulary'],
    ]);
  });

  it('refuses an outbox sent under another account’s session', async () => {
    const device = phone();
    const a = await device.signUp('ada@example.com');
    await startChallenge(a.repositories, { displayName: 'Ada', goal: 'habit' });
    // B signs in while A's session object still exists (a bug elsewhere could leave it).
    const b = await register('bea@example.com');
    await device.auth.login({ email: 'bea@example.com', password: PASSWORD });
    // Even asked directly, A's outbox never leaves as B.
    const api = device.services.progressApi!;
    const [mutation] = await a.repositories.sync!.repository.pending(1);
    await expect(
      api.sync({
        userId: a.owner,
        courseId: 'milo-english-90',
        courseVersion: 1,
        knownRevision: 0,
        mutations: mutation ? [mutation] : [],
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    await a.engine!.requestSync('manual');
    expect(a.engine!.current().state).toBe('stopped');
    expect(await t.prisma.userChallenge.count({ where: { userId: b } })).toBe(0);
    expect(await t.prisma.userChallenge.count({ where: { userId: a.owner } })).toBe(0);
  });
});

describe('offline and back', () => {
  it('plays offline, survives a restart offline, syncs when the server is back — and a new phone sees it', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'milo-')), 'milo.db');
    const first = phone(path);
    const session = await first.signUp('ada@example.com');
    await startChallenge(session.repositories, { displayName: 'Ada', goal: 'habit' });
    await session.engine!.requestSync('manual');

    // The API is out of reach: the quest still counts at once.
    first.online = false;
    await playQuest(session.repositories, 'd001-vocabulary');
    await session.engine!.requestSync('manual');
    expect(session.engine!.current()).toMatchObject({ pending: 1 });
    expect(await view(session)).toMatchObject({ quests: ['d001-vocabulary'] });
    await first.close();

    // The app is restarted — still offline, restored from its saved session.
    const restarted = phone(path);
    restarted.online = false;
    await restarted.auth
      .login({ email: 'ada@example.com', password: PASSWORD })
      .catch(() => undefined);
    const reopened = await restarted.restore(session.owner);
    expect(await view(reopened)).toMatchObject({ quests: ['d001-vocabulary'] });
    await expect(reopened.repositories.sync!.repository.counts()).resolves.toEqual({
      pending: 1,
      rejected: 0,
    });

    // Back online: one sync, and the server has it — scored by the server.
    restarted.online = true;
    await restarted.auth.login({ email: 'ada@example.com', password: PASSWORD });
    await reopened.engine!.requestSync('online');
    await expect(reopened.repositories.sync!.repository.counts()).resolves.toEqual({
      pending: 0,
      rejected: 0,
    });
    const stored = await t.prisma.questCompletion.findFirstOrThrow();
    expect(stored).toMatchObject({ questId: 'd001-vocabulary', correctCount: 6, xpEarned: 30 });

    // Signing in on another phone: the same progress.
    const other = phone();
    const there = await other.signIn('ada@example.com');
    expect(await view(there)).toEqual(await view(reopened));
  });
});

describe('two phones, one account', () => {
  it('end with the same progress, whichever syncs first — the XP paid once', async () => {
    const setup = phone();
    const start = await setup.signUp('ada@example.com');
    await startChallenge(start.repositories, { displayName: 'Ada', goal: 'habit' });
    await start.engine!.requestSync('manual');
    await setup.signOut(start);

    const phoneOne = phone();
    const phoneTwo = phone();
    const one = await phoneOne.signIn('ada@example.com');
    const two = await phoneTwo.signIn('ada@example.com');
    phoneOne.online = false;
    phoneTwo.online = false;
    // Offline, both play: the same quests, and one more on the second.
    await playQuest(one.repositories, 'd001-vocabulary');
    await playQuest(one.repositories, 'd001-grammar');
    await playQuest(two.repositories, 'd001-vocabulary', { wrong: 1 });
    await playQuest(two.repositories, 'd001-grammar');
    await playQuest(two.repositories, 'd001-reading');

    phoneOne.online = true;
    phoneTwo.online = true;
    await two.engine!.requestSync('online');
    await one.engine!.requestSync('online');
    await two.engine!.requestSync('foreground');

    const [first, second] = [await view(one), await view(two)];
    expect(first).toEqual(second);
    expect(first.quests).toEqual(['d001-vocabulary', 'd001-grammar', 'd001-reading']);
    // The quest both played counts once: the first result the server received.
    expect(
      await t.prisma.xpLedgerEntry.count({ where: { reason: 'quest', refId: 'd001-vocabulary' } }),
    ).toBe(1);
    const vocabulary = await t.prisma.questCompletion.findFirstOrThrow({
      where: { questId: 'd001-vocabulary' },
    });
    expect(vocabulary.correctCount).toBe(5);
    const total = await t.prisma.xpLedgerEntry.aggregate({ _sum: { amount: true } });
    expect(first.xp).toBe(total._sum.amount);
  });
});

describe('progress from before accounts', () => {
  it('goes to the first account that has none, scored by the server', async () => {
    const device = phone();
    const local = await device.local();
    await startChallenge(local.repositories, { displayName: 'Ada', goal: 'habit' });
    await playQuest(local.repositories, 'd001-vocabulary');
    await playQuest(local.repositories, 'd001-grammar', { wrong: 1 });

    const account = await device.signUp('ada@example.com');
    expect(account.initialUser).toMatchObject({ displayName: 'Ada', goal: 'habit' });
    expect((await view(account)).quests).toEqual(['d001-vocabulary', 'd001-grammar']);
    const stored = await t.prisma.questCompletion.findMany({ orderBy: { questId: 'desc' } });
    expect(stored.map((row) => [row.questId, row.correctCount, row.totalCount])).toEqual([
      ['d001-vocabulary', 6, 6],
      ['d001-grammar', 3, 4],
    ]);
    await expect(account.repositories.sync!.repository.counts()).resolves.toEqual({
      pending: 0,
      rejected: 0,
    });
    await device.signOut(account);

    const other = await device.signUp('bea@example.com');
    expect((await view(other)).quests).toEqual([]);
  });
});
