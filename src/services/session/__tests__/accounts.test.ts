import { SqliteSyncRepository } from '@/data/repositories/local/sqlite-sync-repository';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { startChallenge } from '@/features/onboarding/use-cases';
import { loadProgressState } from '@/features/progress/use-cases';
import type { ProgressSnapshot } from '@/schemas';

import { FakeProgressServer, emptyProgress } from '../../sync/__fixtures__/fake-progress-server';
import { ACCOUNT_A, ACCOUNT_B, TestDevice, playQuest } from '../../sync/__fixtures__/test-device';
import { prepareAccount, settleLegacyProgress } from '../owner-session';

/**
 * Accounts on one phone. Every account sees its own progress and nothing
 * else — not for a frame — and what one account did offline is only ever
 * sent as that account.
 */

let server: FakeProgressServer;
let phone: TestDevice;

beforeEach(() => {
  server = new FakeProgressServer();
  phone = new TestDevice(server);
});
afterEach(() => phone.close());

/** Signing in, as the app does: open the account's progress, hear from the server first. */
const signIn = async (account: string) => prepareAccount(await phone.open(account));

const signOut = (session: { dispose(): void }) => {
  session.dispose();
  phone.signedIn = null;
};

/** Account A as the server knows it: Day 10 of the challenge, 500 XP. */
function accountAtDayTen(): ProgressSnapshot {
  const startDate = getStartDateForDay(10, new Date());
  const at = new Date(Date.now() - 9 * 86_400_000).toISOString();
  return {
    ...emptyProgress(),
    challenge: {
      courseId: 'milo-english-90',
      startDate,
      timeZone: 'UTC',
      startedAt: at,
      currentDay: 10,
      streak: 0,
      totalXp: 500,
      completedDays: [],
      wordsLearned: 0,
    },
    questCompletions: ['d001-vocabulary', 'd001-grammar'].map((questId) => ({
      questId,
      courseVersion: 1,
      day: 1,
      questType: questId.endsWith('vocabulary') ? 'vocabulary' : 'grammar',
      score: 1,
      correctCount: 4,
      totalCount: 4,
      xpEarned: 250,
      completedAt: at,
    })),
    xpEvents: [
      { amount: 250, reason: 'quest', refId: 'd001-vocabulary', createdAt: at },
      { amount: 250, reason: 'quest', refId: 'd001-grammar', createdAt: at },
    ],
  };
}

describe('two accounts on one phone', () => {
  it('A (Day 10, 500 XP) → B fresh (Day 1, 0 XP) → A again (Day 10, 500 XP)', async () => {
    server.seed(ACCOUNT_A, accountAtDayTen(), 7);

    const a = await signIn(ACCOUNT_A);
    expect(a.initialUser.onboardedAt).not.toBeNull();
    const first = await loadProgressState(a.repositories);
    expect({ day: first.currentDay, xp: first.totalXp }).toEqual({ day: 10, xp: 500 });
    signOut(a);
    // A's screens' cache went with A's session.
    expect(a.queryClient.cleared).toBe(1);

    const b = await signIn(ACCOUNT_B);
    // B starts with a cache of its own and a profile of its own: onboarding, Day 1, nothing earned.
    expect(b.queryClient).not.toBe(a.queryClient);
    expect(b.initialUser.onboardedAt).toBeNull();
    const fresh = await loadProgressState(b.repositories);
    expect({ day: fresh.currentDay, xp: fresh.totalXp }).toEqual({ day: 1, xp: 0 });
    expect(fresh.completedDays).toEqual([]);
    await expect(b.repositories.progress.getCompletions()).resolves.toEqual([]);
    signOut(b);

    // A comes back — even offline, A's progress is on the phone.
    phone.online = false;
    const again = await signIn(ACCOUNT_A);
    const back = await loadProgressState(again.repositories);
    expect({ day: back.currentDay, xp: back.totalXp }).toEqual({ day: 10, xp: 500 });
  });

  it('shows B nothing of what A has — in any table', async () => {
    const a = await signIn(ACCOUNT_A);
    await startChallenge(a.repositories, { displayName: 'Ada', goal: 'habit' });
    await playQuest(a.repositories, 'd001-vocabulary');
    await a.repositories.progress.saveQuestSession({
      questId: 'd001-grammar',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 0.5,
      state: { phase: 'examples' },
    });
    await a.repositories.friends.createInvite(new Date().toISOString());
    signOut(a);

    const b = await signIn(ACCOUNT_B);
    const r = b.repositories;
    await expect(r.progress.getCompletions()).resolves.toEqual([]);
    await expect(r.progress.getTotalXp()).resolves.toBe(0);
    await expect(r.progress.countLearnedWords()).resolves.toBe(0);
    await expect(r.progress.getQuestSessions()).resolves.toEqual([]);
    await expect(r.progress.getDayCompletions()).resolves.toEqual([]);
    await expect(r.achievements.getUnlocks()).resolves.toEqual([]);
    await expect(r.exams.getAllAttempts()).resolves.toEqual([]);
    await expect(r.friends.getMyTeam()).resolves.toBeNull();
    await expect(r.user.getUser()).resolves.toMatchObject({ displayName: 'Explorer', goal: null });
    await expect(r.sync!.repository.outbox()).resolves.toEqual([]);
  });

  it('never sends A’s offline changes as B — and sends them as A later', async () => {
    const a = await signIn(ACCOUNT_A);
    await startChallenge(a.repositories, { displayName: 'Ada', goal: 'habit' });
    await a.engine!.requestSync('manual');
    phone.online = false;
    await playQuest(a.repositories, 'd001-vocabulary');
    const pendingA = await a.repositories.sync!.repository.pending(10);
    expect(pendingA).toHaveLength(1);
    signOut(a);

    phone.online = true;
    const before = server.requests.length;
    const b = await signIn(ACCOUNT_B);
    await startChallenge(b.repositories, { displayName: 'Bea', goal: 'vocabulary' });
    await b.engine!.requestSync('manual');
    const asB = server.requests.slice(before);
    expect(asB.length).toBeGreaterThan(0);
    for (const { signedInAs, request } of asB) {
      expect(signedInAs).toBe(ACCOUNT_B);
      expect(request.userId).toBe(ACCOUNT_B);
      expect(request.mutations.map((mutation) => mutation.id)).not.toContain(pendingA[0]?.id);
    }
    expect(server.progressOf(ACCOUNT_B).progress.questCompletions).toEqual([]);
    // A's engine is stopped for good: asking it to sync sends nothing.
    await a.engine!.requestSync('manual');
    expect(server.requests.slice(before).every((item) => item.signedInAs === ACCOUNT_B)).toBe(true);
    // Still waiting, on the phone, as A's.
    const outboxA = new SqliteSyncRepository(phone.store, ACCOUNT_A);
    await expect(outboxA.counts()).resolves.toEqual({ pending: 1, rejected: 0 });
    signOut(b);

    const back = await signIn(ACCOUNT_A);
    expect(server.progressOf(ACCOUNT_A).progress.questCompletions.map((c) => c.questId)).toEqual([
      'd001-vocabulary',
    ]);
    await expect(back.repositories.sync!.repository.counts()).resolves.toEqual({
      pending: 0,
      rejected: 0,
    });
  });

  it('stops an account’s sync the moment someone else is signed in', async () => {
    const a = await signIn(ACCOUNT_A);
    await startChallenge(a.repositories, { displayName: 'Ada', goal: 'habit' });
    // A's engine is still there (a bug elsewhere could leave it) but B is signed in now.
    phone.signedIn = ACCOUNT_B;
    const before = server.requests.length;
    await a.engine!.requestSync('manual');
    expect(server.requests).toHaveLength(before);
    expect(a.engine!.current().state).toBe('stopped');
    await expect(a.repositories.sync!.repository.counts()).resolves.toEqual({
      pending: 1,
      rejected: 0,
    });
  });
});

describe('progress from before accounts', () => {
  /** The phone's own progress, from before this app had accounts. */
  async function playLocally() {
    const local = await phone.open(null);
    await startChallenge(local.repositories, { displayName: 'Ada', goal: 'habit' });
    await playQuest(local.repositories, 'd001-vocabulary');
    await playQuest(local.repositories, 'd001-grammar', { wrong: 1 });
    local.dispose();
    return local;
  }

  it('goes, once, to the first account that has no progress anywhere', async () => {
    await playLocally();
    const a = await signIn(ACCOUNT_A);
    // The account opens on it right away — onboarding is not asked again.
    expect(a.initialUser).toMatchObject({ displayName: 'Ada', goal: 'habit' });
    expect(a.initialUser.onboardedAt).not.toBeNull();
    const state = await loadProgressState(a.repositories);
    expect(state.todayCompletedQuestIds).toEqual(['d001-vocabulary', 'd001-grammar']);
    // The server got it — the answers — and its word is the copy now.
    const onServer = server.progressOf(ACCOUNT_A).progress;
    expect(onServer.questCompletions.map((c) => c.questId)).toEqual([
      'd001-vocabulary',
      'd001-grammar',
    ]);
    await expect(a.repositories.sync!.repository.counts()).resolves.toEqual({
      pending: 0,
      rejected: 0,
    });
    await expect(a.repositories.sync!.repository.legacyClaim()).resolves.toMatchObject({
      status: 'claimed',
      ownerId: ACCOUNT_A,
    });
    signOut(a);

    // Nobody else ever gets it.
    const b = await signIn(ACCOUNT_B);
    await expect(b.repositories.progress.getCompletions()).resolves.toEqual([]);
    expect(b.initialUser.onboardedAt).toBeNull();
    // And it was copied, never destroyed: the phone still has its own.
    const local = await phone.open(null);
    await expect(local.repositories.progress.getCompletions()).resolves.toHaveLength(2);
  });

  it('is never merged into an account that already has progress', async () => {
    await playLocally();
    server.seed(ACCOUNT_A, accountAtDayTen(), 7);
    const a = await signIn(ACCOUNT_A);
    const state = await loadProgressState(a.repositories);
    expect({ day: state.currentDay, xp: state.totalXp }).toEqual({ day: 10, xp: 500 });
    expect(server.requests.flatMap((item) => item.request.mutations)).toEqual([]);
    await expect(a.repositories.sync!.repository.legacyClaim()).resolves.toMatchObject({
      status: 'skipped',
    });
    signOut(a);

    // Decided once: a fresh account after it does not get it either.
    const b = await signIn(ACCOUNT_B);
    await expect(b.repositories.progress.getCompletions()).resolves.toEqual([]);
  });

  it('waits for the server’s word: offline, nothing is decided', async () => {
    await playLocally();
    phone.online = false;
    const a = await signIn(ACCOUNT_A);
    await expect(a.repositories.sync!.repository.legacyClaim()).resolves.toBeNull();
    await expect(a.repositories.progress.getCompletions()).resolves.toEqual([]);

    phone.online = true;
    await a.engine!.requestSync('online');
    await settleLegacyProgress(a);
    await expect(a.repositories.sync!.repository.legacyClaim()).resolves.toMatchObject({
      status: 'claimed',
    });
    await expect(a.repositories.progress.getCompletions()).resolves.toHaveLength(2);
  });
});
