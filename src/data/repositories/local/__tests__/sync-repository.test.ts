import { NodeSqliteStore } from '@/data/db/__fixtures__/node-sqlite-store';
import type { ProgressMutation, ProgressSnapshot, SyncResponse } from '@/schemas';

import { enqueueMutation } from '../outbox';
import { SqliteAchievementRepository } from '../sqlite-achievement-repository';
import { SqliteExamRepository } from '../sqlite-exam-repository';
import { SqliteProgressRepository } from '../sqlite-progress-repository';
import { SqliteSyncRepository } from '../sqlite-sync-repository';
import { SqliteUserRepository } from '../sqlite-user-repository';

/**
 * Applying the server's answer to an account's copy: acknowledged changes
 * leave the outbox, the confirmed part becomes exactly the server's, what
 * still waits stays — and what only this phone keeps (celebrations, quests in
 * progress, open attempts) is never touched.
 */

const OWNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const AT = '2026-09-01T10:00:00.000Z';
const LATER = '2026-09-01T12:00:00.000Z';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

let store: NodeSqliteStore;
let sync: SqliteSyncRepository;
let progress: SqliteProgressRepository;

beforeEach(() => {
  store = new NodeSqliteStore();
  sync = new SqliteSyncRepository(store, OWNER);
  progress = new SqliteProgressRepository(store, OWNER);
});
afterEach(() => store.close());

const quest = (questId: string, mutationId: string): ProgressMutation => ({
  id: mutationId,
  type: 'completeQuest',
  createdAt: AT,
  payload: { courseId: 'milo-english-90', courseVersion: 1, questId, answers: [], completedAt: AT },
});

const completion = (questId: string, day = 1) => ({
  questId,
  courseVersion: 1,
  day,
  questType: 'vocabulary' as const,
  score: 1,
  correctCount: 6,
  totalCount: 6,
  xpEarned: 30,
  source: 'user' as const,
  completedAt: AT,
});

const snapshot = (change: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  challenge: {
    courseId: 'milo-english-90',
    startDate: '2026-09-01',
    timeZone: 'UTC',
    startedAt: AT,
    currentDay: 1,
    streak: 0,
    totalXp: 0,
    completedDays: [],
    wordsLearned: 0,
  },
  questCompletions: [],
  dayCompletions: [],
  learnedWords: [],
  examAttempts: [],
  xpEvents: [],
  achievementUnlocks: [],
  challengeCompletion: null,
  ...change,
});

const response = (change: Partial<SyncResponse>): SyncResponse => ({
  revision: 1,
  results: [],
  progress: null,
  ...change,
});

const count = async (sql: string, params: (string | number)[] = []) =>
  (await (await store.read()).getFirstAsync<{ n: number }>(sql, params))?.n;

describe('the outbox', () => {
  it('is written with the progress it made — or not at all', async () => {
    const mutation = quest('d001-vocabulary', id(1));
    await progress.recordFirstCompletion(
      completion('d001-vocabulary'),
      [],
      { amount: 30, reason: 'quest', refId: 'd001-vocabulary', createdAt: AT },
      mutation,
    );
    expect((await sync.pending(10)).map((item) => item.id)).toEqual([id(1)]);
    // A replay changes nothing: no second mutation for the same quest.
    await progress.recordFirstCompletion(
      completion('d001-vocabulary'),
      [],
      null,
      quest('d001-vocabulary', id(2)),
    );
    expect((await sync.pending(10)).map((item) => item.id)).toEqual([id(1)]);
    // The progress waits on the mutation that made it.
    await expect(
      count('SELECT COUNT(*) AS n FROM xp_events WHERE owner_id = ? AND pending_mutation_id = ?', [
        OWNER,
        id(1),
      ]),
    ).resolves.toBe(1);
  });

  it('rolls back the progress when the outbox cannot take its mutation', async () => {
    const mutation = quest('d001-vocabulary', id(1));
    await store.write((db) =>
      db.withExclusiveTransactionAsync((txn) => enqueueMutation(txn, OWNER, mutation)),
    );
    // Same mutation id again: the outbox refuses it, and the completion goes with it.
    await expect(
      progress.recordFirstCompletion(completion('d001-grammar'), [], null, mutation),
    ).rejects.toThrow();
    await expect(progress.getCompletions()).resolves.toEqual([]);
  });

  it('marks what the server derives from waiting progress as waiting too', async () => {
    await progress.recordFirstCompletion(
      completion('d001-vocabulary'),
      [],
      null,
      quest('d001-vocabulary', id(1)),
    );
    await progress.recordDayCompletion({
      day: 1,
      completedAt: AT,
      questCount: 4,
      xpEarned: 105,
      streakBefore: 0,
      streakAfter: 1,
      isPerfect: true,
      celebratedAt: null,
    });
    await new SqliteAchievementRepository(store, OWNER).unlock(['firstDay'], AT);
    await expect(
      count('SELECT COUNT(*) AS n FROM day_completions WHERE pending_mutation_id = ?', [id(1)]),
    ).resolves.toBe(1);
    await expect(
      count('SELECT COUNT(*) AS n FROM achievement_unlocks WHERE pending_mutation_id = ?', [id(1)]),
    ).resolves.toBe(1);
  });
});

describe('applying the server’s answer', () => {
  it('takes the server’s progress, keeps what waits, and drops what the server refused', async () => {
    await progress.recordFirstCompletion(
      completion('d001-vocabulary'),
      [],
      null,
      quest('d001-vocabulary', id(1)),
    );
    await progress.recordFirstCompletion(
      completion('d001-grammar'),
      [],
      null,
      quest('d001-grammar', id(2)),
    );
    await progress.recordFirstCompletion(
      completion('d001-reading'),
      [],
      null,
      quest('d001-reading', id(3)),
    );

    const applied = await sync.apply(
      response({
        revision: 2,
        results: [
          { mutationId: id(1), status: 'accepted' },
          { mutationId: id(2), status: 'rejected', code: 'QUEST_LOCKED', message: 'locked' },
        ],
        progress: snapshot({
          questCompletions: [{ ...completion('d001-vocabulary'), xpEarned: 20, correctCount: 5 }],
          xpEvents: [{ amount: 20, reason: 'quest', refId: 'd001-vocabulary', createdAt: AT }],
        }),
      }),
      LATER,
    );

    expect(applied.changed).toBe(true);
    const quests = await progress.getCompletions();
    // Confirmed with the server's numbers; refused and gone; still waiting and kept.
    expect(quests.map((item) => [item.questId, item.xpEarned])).toEqual([
      ['d001-vocabulary', 20],
      ['d001-reading', 30],
    ]);
    expect(await sync.outbox()).toEqual([
      expect.objectContaining({ mutationId: id(2), status: 'rejected', errorCode: 'QUEST_LOCKED' }),
      expect.objectContaining({ mutationId: id(3), status: 'pending' }),
    ]);
    await expect(sync.state()).resolves.toEqual({ revision: 2, syncedAt: LATER });
  });

  it('drops confirmed rows the server no longer has, and anything this owner should not have', async () => {
    await (
      await store.read()
    ).execAsync(`
      INSERT INTO xp_events (owner_id, amount, reason, ref_id, created_at) VALUES ('${OWNER}', 250, 'dev', NULL, '${AT}');
      INSERT INTO quest_completions (owner_id, quest_id, course_version, day, quest_type, score, correct_count, total_count, xp_earned, source, completed_at)
        VALUES ('${OWNER}', 'd002-vocabulary', 1, 2, 'vocabulary', 1, 6, 6, 30, 'dev', '${AT}');
    `);
    await sync.apply(response({ revision: 3, progress: snapshot() }), LATER);
    await expect(progress.getTotalXp()).resolves.toBe(0);
    await expect(progress.getCompletions()).resolves.toEqual([]);
  });

  it('keeps celebrations: shown ones stay shown, and what was earned elsewhere does not pop up', async () => {
    await progress.recordFirstCompletion(
      completion('d001-vocabulary'),
      [],
      null,
      quest('d001-vocabulary', id(1)),
    );
    await progress.recordDayCompletion({
      day: 1,
      completedAt: AT,
      questCount: 1,
      xpEarned: 30,
      streakBefore: 0,
      streakAfter: 1,
      isPerfect: true,
      celebratedAt: null,
    });
    // The day's celebration is about to play on this phone.
    const day = {
      day: 1,
      completedAt: AT,
      questCount: 1,
      xpEarned: 30,
      streakBefore: 0,
      streakAfter: 1,
      isPerfect: true,
    };
    await sync.apply(
      response({
        results: [{ mutationId: id(1), status: 'accepted' }],
        progress: snapshot({
          questCompletions: [completion('d001-vocabulary')],
          dayCompletions: [day, { ...day, day: 2 }],
          achievementUnlocks: [{ achievementId: 'firstDay', unlockedAt: AT }],
        }),
      }),
      LATER,
    );
    // Its own moment still plays, once; what came from another device arrives as shown.
    await expect(progress.getDayCompletion(1)).resolves.toMatchObject({ celebratedAt: null });
    await expect(progress.getDayCompletion(2)).resolves.toMatchObject({ celebratedAt: LATER });
    const unlocks = await new SqliteAchievementRepository(store, OWNER).getUnlocks();
    expect(unlocks).toEqual([{ achievementId: 'firstDay', unlockedAt: AT, celebratedAt: LATER }]);
    await expect(progress.markDayCelebrated(1, LATER)).resolves.toBe(true);
    await expect(progress.markDayCelebrated(1, LATER)).resolves.toBe(false);
  });

  it('celebrates the team badge once on a phone that follows the account — history elsewhere', async () => {
    const achievements = new SqliteAchievementRepository(store, OWNER);
    const teamBadge = { achievementId: 'teamStreak' as const, unlockedAt: LATER };
    // The first answer this phone gets for the account: history, nothing pops up.
    await sync.apply(response({ progress: snapshot() }), AT);
    // A teammate's day made the team's seventh: the server grants it, the next sync brings it.
    await sync.apply(
      response({ revision: 2, progress: snapshot({ achievementUnlocks: [teamBadge] }) }),
      LATER,
    );
    await expect(achievements.getUnlocks()).resolves.toEqual([
      { achievementId: 'teamStreak', unlockedAt: LATER, celebratedAt: null },
    ]);
    await expect(achievements.markCelebrated(['teamStreak'], LATER)).resolves.toEqual([
      'teamStreak',
    ]);
    // Later answers never bring the celebration back.
    await sync.apply(
      response({ revision: 3, progress: snapshot({ achievementUnlocks: [teamBadge] }) }),
      LATER,
    );
    await expect(achievements.getUnlocks()).resolves.toEqual([
      { achievementId: 'teamStreak', unlockedAt: LATER, celebratedAt: LATER },
    ]);

    // Another phone signing in for the first time gets it as history.
    const other = new NodeSqliteStore();
    await new SqliteSyncRepository(other, OWNER).apply(
      response({ revision: 3, progress: snapshot({ achievementUnlocks: [teamBadge] }) }),
      LATER,
    );
    await expect(new SqliteAchievementRepository(other, OWNER).getUnlocks()).resolves.toEqual([
      { achievementId: 'teamStreak', unlockedAt: LATER, celebratedAt: LATER },
    ]);
    await other.close();
  });

  it('leaves what only this phone keeps: quests in progress and open exam attempts', async () => {
    await progress.saveQuestSession({
      questId: 'd001-grammar',
      startedAt: AT,
      updatedAt: AT,
      progress: 0.5,
      state: { phase: 'examples' },
    });
    const exams = new SqliteExamRepository(store, OWNER);
    await exams.openAttempt({
      id: 'week-01-1',
      examId: 'week-01',
      questId: 'd007-weeklyExam',
      courseVersion: 1,
      number: 1,
      startedAt: AT,
      updatedAt: AT,
      currentIndex: 2,
      answers: [],
      submittedAt: null,
      correctCount: null,
      totalCount: 9,
      score: null,
      passed: null,
    });
    await sync.apply(response({ revision: 4, progress: snapshot() }), LATER);
    await expect(progress.getQuestSessions()).resolves.toHaveLength(1);
    await expect(exams.getAllAttempts()).resolves.toEqual([
      expect.objectContaining({ id: 'week-01-1', submittedAt: null, currentIndex: 2 }),
    ]);
  });

  it('takes a refused start back: onboarding again, not a challenge the server never began', async () => {
    const user = new SqliteUserRepository(store, OWNER);
    const start: ProgressMutation = {
      id: id(9),
      type: 'startChallenge',
      createdAt: AT,
      payload: { courseId: 'milo-english-90', startDate: '2026-09-01', timeZone: 'UTC' },
    };
    await user.completeOnboarding(
      { displayName: 'Ada', goal: 'habit', challengeStartDate: '2026-09-01', onboardedAt: AT },
      start,
    );
    await expect(user.getUser()).resolves.toMatchObject({ onboardedAt: AT });
    await sync.apply(
      response({
        revision: 0,
        results: [{ mutationId: id(9), status: 'rejected', code: 'INVALID_START_DATE' }],
      }),
      LATER,
    );
    await expect(user.getUser()).resolves.toMatchObject({ onboardedAt: null, displayName: 'Ada' });
  });

  it('never touches another owner’s rows', async () => {
    const other = new SqliteProgressRepository(store, OTHER);
    await other.recordFirstCompletion(completion('d001-vocabulary'), [], {
      amount: 30,
      reason: 'quest',
      refId: 'd001-vocabulary',
      createdAt: AT,
    });
    await sync.apply(response({ revision: 5, progress: snapshot() }), LATER);
    await expect(other.getCompletions()).resolves.toHaveLength(1);
    await expect(other.getTotalXp()).resolves.toBe(30);
  });
});
