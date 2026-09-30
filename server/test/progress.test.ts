import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgressResponseSchema, type AuthSession, type SyncResponse } from '@/schemas';

import { ProgressService } from '../src/progress/progress.service';
import { bearer, register, resetDatabase, startApp, TestClock, type TestApp } from './helpers';
import {
  COURSE_ID,
  COURSE_VERSION,
  completeQuest,
  examOf,
  mutation,
  passMarkOf,
  playDay,
  questAnswers,
  questsOf,
  startChallenge,
  submitExam,
  sync,
} from './progress-fixtures';

/**
 * Progress on the server: every rule decided here, from the course — never
 * taken from a device. Played on the real course (days 1, 2, 7, 89 and 90
 * have their content) against a clock the tests move.
 */

const DAY_ONE = '2026-09-01';
const clock = new TestClock(new Date(`${DAY_ONE}T10:00:00.000Z`));
const lines: string[] = [];
let t: TestApp;
let ada: AuthSession;

beforeAll(async () => {
  t = await startApp({
    clock,
    env: { LOG_LEVEL: 'info' },
    logDestination: new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    }),
  });
});
afterAll(() => t.close());

beforeEach(async () => {
  await resetDatabase(t.prisma);
  clock.set(`${DAY_ONE}T10:00:00.000Z`);
  lines.length = 0;
  ada = await register(t.http);
});

const progressOf = async (session: AuthSession) =>
  ProgressResponseSchema.parse(
    (
      await request(t.http)
        .get('/api/v1/progress')
        .set('Authorization', bearer(session))
        .expect(200)
    ).body,
  );

const statuses = (response: SyncResponse) =>
  response.results.map((result) => result.code ?? result.status);

const [VOCABULARY = '', GRAMMAR = '', READING = '', REVIEW = ''] = questsOf(1);
const vocabularyReward = 20;
const perfectBonus = 10;

describe('a new account', () => {
  it('has no progress: revision 0, no challenge', async () => {
    await expect(progressOf(ada)).resolves.toEqual({
      revision: 0,
      progress: {
        challenge: null,
        questCompletions: [],
        dayCompletions: [],
        learnedWords: [],
        examAttempts: [],
        xpEvents: [],
        achievementUnlocks: [],
        challengeCompletion: null,
      },
    });
  });

  it('needs to be signed in', async () => {
    await request(t.http).get('/api/v1/progress').expect(401);
    await request(t.http).post('/api/v1/progress/sync').send({}).expect(401);
  });

  it('cannot finish a quest before the challenge starts', async () => {
    const response = await sync(t.http, ada, [completeQuest(VOCABULARY)]);
    expect(statuses(response)).toEqual(['CHALLENGE_NOT_STARTED']);
    expect(response.revision).toBe(0);
  });
});

describe('starting the challenge', () => {
  it('starts it once, on the device’s date, in its time zone', async () => {
    const response = await sync(t.http, ada, [startChallenge(DAY_ONE, 'Asia/Tashkent')]);
    expect(statuses(response)).toEqual(['accepted']);
    expect(response.revision).toBe(1);
    expect(response.progress?.challenge).toEqual({
      courseId: COURSE_ID,
      startDate: DAY_ONE,
      timeZone: 'Asia/Tashkent',
      startedAt: `${DAY_ONE}T10:00:00.000Z`,
      currentDay: 1,
      streak: 0,
      totalXp: 0,
      completedDays: [],
      wordsLearned: 0,
    });

    // Another device started it too, offline, a day later: the first start stands.
    const again = await sync(t.http, ada, [startChallenge('2026-09-02')], 1);
    expect(statuses(again)).toEqual(['accepted']);
    expect(again.revision).toBe(1);
    expect(again.progress).toBeNull();
    expect((await progressOf(ada)).progress.challenge?.startDate).toBe(DAY_ONE);
  });

  it('refuses a start date in the future, too long ago, or an unknown time zone', async () => {
    const response = await sync(t.http, ada, [
      startChallenge('2026-09-03'),
      startChallenge('2026-08-20'),
      startChallenge(DAY_ONE, 'Mars/Olympus'),
    ]);
    expect(statuses(response)).toEqual([
      'INVALID_START_DATE',
      'INVALID_START_DATE',
      'INVALID_TIME_ZONE',
    ]);
    expect(response.revision).toBe(0);
  });
});

describe('finishing a quest', () => {
  beforeEach(async () => {
    await sync(t.http, ada, [startChallenge(DAY_ONE)]);
  });

  it('scores the answers itself and pays the reward and the perfect bonus', async () => {
    const response = await sync(t.http, ada, [completeQuest(VOCABULARY)], 1);
    expect(statuses(response)).toEqual(['accepted']);
    expect(response.revision).toBe(2);
    const progress = response.progress;
    expect(progress?.questCompletions).toEqual([
      expect.objectContaining({
        questId: VOCABULARY,
        day: 1,
        questType: 'vocabulary',
        courseVersion: COURSE_VERSION,
        correctCount: 6,
        totalCount: 6,
        score: 1,
        xpEarned: vocabularyReward + perfectBonus,
      }),
    ]);
    expect(progress?.xpEvents).toHaveLength(2);
    expect(progress?.xpEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'quest', refId: VOCABULARY, amount: 30 }),
        // A quest without a mistake: the Perfect Quiz badge, with its own reward.
        expect.objectContaining({ reason: 'achievement', refId: 'perfectQuiz' }),
      ]),
    );
    expect(progress?.achievementUnlocks.map((unlock) => unlock.achievementId)).toEqual([
      'perfectQuiz',
    ]);
    // Its words are learned, once each, by their course ids.
    expect(progress?.learnedWords).toHaveLength(6);
    expect(progress?.challenge?.wordsLearned).toBe(6);
  });

  it('pays no perfect bonus with a mistake — whatever the device thinks it earned', async () => {
    const response = await sync(t.http, ada, [completeQuest(VOCABULARY, { wrong: 2 })], 1);
    expect(response.progress?.questCompletions[0]).toMatchObject({
      correctCount: 4,
      totalCount: 6,
      xpEarned: vocabularyReward,
    });
    expect(response.progress?.challenge?.totalXp).toBe(vocabularyReward);
    expect(response.progress?.achievementUnlocks).toEqual([]);
  });

  it('answers a retried mutation as a duplicate and changes nothing', async () => {
    const quest = completeQuest(VOCABULARY);
    const first = await sync(t.http, ada, [quest], 1);
    const retry = await sync(t.http, ada, [quest], 1);
    expect(statuses(retry)).toEqual(['duplicate']);
    expect(retry.revision).toBe(first.revision);
    // The device never saw the first answer: it gets the progress now.
    expect(retry.progress).toEqual(first.progress);
    expect(await t.prisma.questCompletion.count()).toBe(1);
    expect(await t.prisma.xpLedgerEntry.count({ where: { reason: 'quest' } })).toBe(1);
  });

  it('finishes a quest once, whatever other mutations try again', async () => {
    const first = await sync(t.http, ada, [completeQuest(VOCABULARY)], 1);
    // The same quest from a second device — another mutation, played worse.
    const second = await sync(
      t.http,
      ada,
      [completeQuest(VOCABULARY, { wrong: 3 })],
      first.revision,
    );
    expect(statuses(second)).toEqual(['accepted']);
    expect(second.revision).toBe(first.revision);
    expect(second.progress).toBeNull();
    const { progress } = await progressOf(ada);
    expect(progress.questCompletions).toHaveLength(1);
    expect(progress.questCompletions[0]).toMatchObject({ correctCount: 6 });
    expect(progress.challenge?.totalXp).toBe(first.progress?.challenge?.totalXp);
  });

  it('refuses a mutation id reused for something else', async () => {
    const id = randomUUID();
    await sync(
      t.http,
      ada,
      [completeQuest(VOCABULARY)].map((m) => ({ ...m, id })),
      1,
    );
    const reused = await sync(t.http, ada, [{ ...completeQuest(GRAMMAR), id }], 2);
    expect(reused.results[0]).toMatchObject({ status: 'rejected', code: 'MUTATION_ID_REUSED' });
    expect((await progressOf(ada)).progress.questCompletions).toHaveLength(1);
  });

  it('refuses unknown quests, exams sent as quests, and quests out of order', async () => {
    const response = await sync(
      t.http,
      ada,
      [
        completeQuest('d001-nothing', { answers: [] }),
        completeQuest('d007-weeklyExam', { answers: [] }),
        completeQuest(GRAMMAR),
      ],
      1,
    );
    expect(statuses(response)).toEqual(['UNKNOWN_QUEST', 'UNKNOWN_QUEST', 'QUEST_LOCKED']);
    expect(response.revision).toBe(1);
  });

  it('refuses a quest whose content is not written yet', async () => {
    const response = await sync(
      t.http,
      ada,
      [completeQuest('d003-vocabulary', { answers: [] })],
      1,
    );
    // Day 3 is two days ahead as well: whichever rule sees it first, it is refused.
    expect(response.results[0]?.status).toBe('rejected');
  });

  it('refuses answers that are not one per exercise, with the exercise’s options', async () => {
    const answers = questAnswers(VOCABULARY);
    const [first, ...rest] = answers;
    if (!first) throw new Error('no answers');
    const response = await sync(
      t.http,
      ada,
      [
        completeQuest(VOCABULARY, { answers: rest }),
        completeQuest(VOCABULARY, { answers: [first, first, ...rest.slice(1)] }),
        completeQuest(VOCABULARY, { answers: [{ ...first, optionId: 'not-an-option' }, ...rest] }),
      ],
      1,
    );
    expect(statuses(response)).toEqual(['INVALID_ANSWERS', 'INVALID_ANSWERS', 'INVALID_ANSWERS']);
    expect(await t.prisma.questCompletion.count()).toBe(0);
  });

  it('opens a day on its day — a day early at most, a week late at most', async () => {
    // Day 2 is tomorrow: a device a time zone ahead is already there.
    clock.advanceMinutes(60);
    const early = await sync(
      t.http,
      ada,
      questsOf(2)
        .slice(0, 1)
        .map((id) => completeQuest(id)),
      1,
    );
    expect(statuses(early)).toEqual(['accepted']);
    // Day 7 is six days away.
    const ahead = await sync(t.http, ada, [completeQuest('d007-vocabulary')], early.revision);
    expect(statuses(ahead)).toEqual(['QUEST_NOT_AVAILABLE']);

    // Day 1 played offline, synced six days later: still counts.
    clock.advanceDays(6);
    const late = await sync(t.http, ada, [completeQuest(VOCABULARY)], early.revision);
    expect(statuses(late)).toEqual(['accepted']);
    // Two more days: Day 1 is now more than a week ago.
    clock.advanceDays(2);
    const tooLate = await sync(t.http, ada, [completeQuest(GRAMMAR)], late.revision);
    expect(statuses(tooLate)).toEqual(['QUEST_NOT_AVAILABLE']);
  });

  it('counts days in the challenge’s time zone', async () => {
    const other = await register(t.http, 'kiri@example.com');
    // 10:00 UTC on Sep 1 is already Sep 2 in Kiritimati (UTC+14).
    await sync(t.http, other, [startChallenge('2026-09-02', 'Pacific/Kiritimati')]);
    const { progress } = await progressOf(other);
    expect(progress.challenge?.currentDay).toBe(1);
    // The same start date in UTC would be a day that has not come.
    const utc = await register(t.http, 'utc@example.com');
    const refused = await sync(t.http, utc, [startChallenge('2026-09-03')]);
    expect(statuses(refused)).toEqual(['INVALID_START_DATE']);
  });
});

describe('a finished day', () => {
  beforeEach(async () => {
    await sync(t.http, ada, [startChallenge(DAY_ONE)]);
  });

  it('is recorded by the server with its last quest — once, with its streak and badge', async () => {
    const response = await sync(t.http, ada, playDay(1), 1);
    expect(statuses(response)).toEqual(['accepted', 'accepted', 'accepted', 'accepted']);
    const progress = response.progress;
    expect(progress?.dayCompletions).toEqual([
      expect.objectContaining({
        day: 1,
        questCount: 4,
        streakBefore: 0,
        streakAfter: 1,
        isPerfect: true,
        xpEarned: 20 + 15 + 20 + 10 + 4 * perfectBonus,
      }),
    ]);
    expect(progress?.challenge).toMatchObject({ completedDays: [1], streak: 1 });
    expect(progress?.achievementUnlocks.map((unlock) => unlock.achievementId).sort()).toEqual([
      'firstDay',
      'perfectQuiz',
    ]);
    const achievementXp = progress?.xpEvents.filter((event) => event.reason === 'achievement');
    expect(achievementXp?.map((event) => event.refId).sort()).toEqual(['firstDay', 'perfectQuiz']);
    // Four quests, one revision each.
    expect(response.revision).toBe(5);

    // The whole day again, from another device: nothing more.
    const again = await sync(t.http, ada, playDay(1), response.revision);
    expect(statuses(again)).toEqual(['accepted', 'accepted', 'accepted', 'accepted']);
    expect(again.revision).toBe(response.revision);
    expect(await t.prisma.dayCompletion.count()).toBe(1);
    expect(await t.prisma.achievementUnlock.count()).toBe(2);
  });

  it('is not finished while a quest is missing', async () => {
    const response = await sync(
      t.http,
      ada,
      [VOCABULARY, GRAMMAR, READING].map((id) => completeQuest(id)),
      1,
    );
    expect(response.progress?.dayCompletions).toEqual([]);
    expect(response.progress?.challenge?.completedDays).toEqual([]);
    const last = await sync(t.http, ada, [completeQuest(REVIEW)], response.revision);
    expect(last.progress?.challenge?.completedDays).toEqual([1]);
  });

  it('makes a streak day by day, and loses it after a missed day', async () => {
    const day1 = await sync(t.http, ada, playDay(1), 1);
    clock.advanceDays(1);
    const day2 = await sync(t.http, ada, playDay(2), day1.revision);
    expect(day2.progress?.challenge).toMatchObject({
      currentDay: 2,
      streak: 2,
      completedDays: [1, 2],
    });
    expect(day2.progress?.dayCompletions.at(-1)).toMatchObject({
      day: 2,
      streakBefore: 1,
      streakAfter: 2,
    });
    // Day 3 passes without its quests: on Day 4 the streak is gone.
    clock.advanceDays(2);
    expect((await progressOf(ada)).progress.challenge).toMatchObject({ currentDay: 4, streak: 0 });
  });
});

describe('exams', () => {
  const EXAM = 'd007-weeklyExam';
  const FINAL = 'd090-finalBattle';

  it('scores a weekly exam here and pays its reward once, for the first pass', async () => {
    // Day 7: the challenge started six days ago.
    await sync(t.http, ada, [startChallenge('2026-08-26')]);
    const warmUp = await sync(
      t.http,
      ada,
      questsOf(7)
        .slice(0, -1)
        .map((id) => completeQuest(id)),
      1,
    );
    const exam = examOf(EXAM);

    const failed = await sync(
      t.http,
      ada,
      [submitExam(EXAM, passMarkOf(EXAM) - 1)],
      warmUp.revision,
    );
    expect(statuses(failed)).toEqual(['accepted']);
    expect(failed.progress?.examAttempts).toEqual([
      expect.objectContaining({ examId: exam.id, number: 1, passed: false }),
    ]);
    // Handed in, a weekly exam is finished — the day with it — without its reward.
    expect(failed.progress?.questCompletions.find((c) => c.questId === EXAM)?.xpEarned).toBe(0);
    expect(failed.progress?.challenge?.completedDays).toEqual([7]);

    const passed = await sync(t.http, ada, [submitExam(EXAM, passMarkOf(EXAM))], failed.revision);
    const reward = passed.progress?.xpEvents.filter((event) => event.reason === 'examPass');
    expect(reward).toEqual([expect.objectContaining({ refId: exam.id, amount: exam.xpReward })]);
    expect(passed.progress?.questCompletions.find((c) => c.questId === EXAM)?.xpEarned).toBe(
      exam.xpReward,
    );

    const again = await sync(
      t.http,
      ada,
      [submitExam(EXAM, exam.questions.length)],
      passed.revision,
    );
    expect(again.progress?.examAttempts.map((attempt) => attempt.number)).toEqual([1, 2, 3]);
    expect(again.progress?.xpEvents.filter((event) => event.reason === 'examPass')).toHaveLength(1);
  });

  it('opens an exam only after its warm-up, and never trusts a claimed score', async () => {
    await sync(t.http, ada, [startChallenge('2026-08-26')]);
    const locked = await sync(t.http, ada, [submitExam(EXAM, 9)], 1);
    expect(statuses(locked)).toEqual(['QUEST_LOCKED']);
    const unknown = await sync(
      t.http,
      ada,
      [
        mutation('submitExam', {
          courseId: COURSE_ID,
          courseVersion: COURSE_VERSION,
          questId: EXAM,
          attemptId: 'a-1',
          answers: [{ questionId: 'not-a-question', optionId: 'a' }],
          submittedAt: new Date().toISOString(),
        }),
      ],
      1,
    );
    expect(statuses(unknown)).toEqual(['QUEST_LOCKED']);
  });

  it('finishes the challenge with the Final Battle’s first pass — once', async () => {
    await sync(t.http, ada, [startChallenge(DAY_ONE)]);
    clock.advanceDays(89);
    const failed = await sync(t.http, ada, [submitExam(FINAL, passMarkOf(FINAL) - 1)], 1);
    // Not passed: the Final Battle stays open — no completion, no summit.
    expect(failed.progress?.questCompletions).toEqual([]);
    expect(failed.progress?.challengeCompletion).toBeNull();

    const final = examOf(FINAL);
    const attemptId = 'final-2';
    const passed = await sync(
      t.http,
      ada,
      [submitExam(FINAL, final.questions.length, { attemptId })],
      failed.revision,
    );
    expect(passed.progress?.challengeCompletion).toEqual(
      expect.objectContaining({
        finalAttemptId: attemptId,
        correctCount: final.questions.length,
        isPerfect: true,
        xpEarned: final.xpReward,
      }),
    );
    expect(passed.progress?.challenge?.completedDays).toEqual([90]);

    const again = await sync(
      t.http,
      ada,
      [submitExam(FINAL, final.questions.length)],
      passed.revision,
    );
    expect(again.progress?.challengeCompletion?.finalAttemptId).toBe(attemptId);
    expect(again.progress?.xpEvents.filter((event) => event.reason === 'examPass')).toHaveLength(1);
  });
});

describe('the sync request', () => {
  beforeEach(async () => {
    await sync(t.http, ada, [startChallenge(DAY_ONE)]);
  });

  it('applies a batch in order and answers each mutation', async () => {
    const batch = playDay(1);
    const response = await sync(t.http, ada, batch, 1);
    expect(response.results.map((result) => result.mutationId)).toEqual(batch.map((m) => m.id));
    // Partly sent before: those are duplicates, the rest is new.
    const next = completeQuest(questsOf(2)[0] ?? '');
    clock.advanceDays(1);
    const retry = await sync(t.http, ada, [...batch.slice(2), next], 1);
    expect(statuses(retry)).toEqual(['duplicate', 'duplicate', 'accepted']);
    expect(retry.revision).toBe(response.revision + 1);
  });

  it('moves the revision up with every change, and only then', async () => {
    const seen = [1];
    for (const questId of questsOf(1)) {
      const response = await sync(t.http, ada, [completeQuest(questId)], seen.at(-1));
      seen.push(response.revision);
    }
    expect(seen).toEqual([1, 2, 3, 4, 5]);
    const idle = await sync(t.http, ada, [], 5);
    expect(idle).toEqual({ revision: 5, results: [], progress: null });
    // A device that is behind gets the progress.
    expect((await sync(t.http, ada, [], 3)).progress?.questCompletions).toHaveLength(4);
  });

  it('refuses a request that is not valid as a whole', async () => {
    const send = (body: object) =>
      request(t.http).post('/api/v1/progress/sync').set('Authorization', bearer(ada)).send(body);
    const base = { userId: ada.user.id, courseId: COURSE_ID, courseVersion: 1, knownRevision: 0 };
    await send({ ...base, mutations: [{ id: 'not-a-uuid', type: 'completeQuest' }] }).expect(400);
    await send({ ...base, mutations: [{ ...completeQuest(VOCABULARY), xp: 500 }] }).expect(400);
    const tooMany = Array.from({ length: 51 }, () => completeQuest(VOCABULARY));
    await send({ ...base, mutations: tooMany }).expect(400);
    // Every one of them was refused before anything was applied.
    expect(await t.prisma.questCompletion.count()).toBe(0);
  });

  it('never lets one account’s outbox land on another', async () => {
    const other = await register(t.http, 'grace@example.com');
    const response = await request(t.http)
      .post('/api/v1/progress/sync')
      .set('Authorization', bearer(other))
      .send({
        userId: ada.user.id,
        courseId: COURSE_ID,
        courseVersion: COURSE_VERSION,
        knownRevision: 0,
        mutations: [startChallenge(DAY_ONE)],
      })
      .expect(409);
    expect(response.body).toMatchObject({ code: 'ACCOUNT_MISMATCH' });
    expect(await t.prisma.userChallenge.count({ where: { userId: other.user.id } })).toBe(0);
  });

  it('keeps a whole batch waiting when a course version is not supported', async () => {
    const outdated = {
      ...completeQuest(GRAMMAR),
      payload: { ...completeQuest(GRAMMAR).payload, courseVersion: 99 },
    };
    const response = await request(t.http)
      .post('/api/v1/progress/sync')
      .set('Authorization', bearer(ada))
      .send({
        userId: ada.user.id,
        courseId: COURSE_ID,
        courseVersion: COURSE_VERSION,
        knownRevision: 1,
        mutations: [completeQuest(VOCABULARY), outdated],
      })
      .expect(409);
    expect(response.body).toEqual({
      code: 'COURSE_VERSION_UNSUPPORTED',
      message: expect.any(String),
      details: { supportedVersion: COURSE_VERSION },
    });
    // Not even the valid one before it: the outbox's order is kept.
    expect(await t.prisma.questCompletion.count()).toBe(0);

    const otherCourse = await request(t.http)
      .post('/api/v1/progress/sync')
      .set('Authorization', bearer(ada))
      .send({
        userId: ada.user.id,
        courseId: 'another-course',
        courseVersion: 1,
        knownRevision: 0,
        mutations: [],
      })
      .expect(409);
    expect(otherCourse.body).toMatchObject({ code: 'COURSE_MISMATCH' });
  });

  it('rolls a mutation back whole when writing it fails', async () => {
    const service = t.app.get(ProgressService);
    const quest = completeQuest(VOCABULARY);
    const spy = vi
      .spyOn(service, 'writeRecords')
      .mockImplementationOnce(async (tx, challengeId, writes, mutationId) => {
        // Half written, then the database goes away.
        await tx.questCompletion.createMany({
          data: writes.completions.map(({ answers: _answers, ...completion }) => ({
            ...completion,
            challengeId,
            mutationId,
          })),
        });
        throw new Error('connection lost');
      });
    await request(t.http)
      .post('/api/v1/progress/sync')
      .set('Authorization', bearer(ada))
      .send({
        userId: ada.user.id,
        courseId: COURSE_ID,
        courseVersion: COURSE_VERSION,
        knownRevision: 1,
        mutations: [quest],
      })
      .expect(500);
    spy.mockRestore();
    // Nothing of it stayed: no completion, no XP, no revision, not even the record of it.
    expect(await t.prisma.questCompletion.count()).toBe(0);
    expect(await t.prisma.xpLedgerEntry.count()).toBe(0);
    expect(await t.prisma.processedMutation.count({ where: { mutationId: quest.id } })).toBe(0);
    expect((await progressOf(ada)).revision).toBe(1);
    // So the retry is simply applied.
    expect(statuses(await sync(t.http, ada, [quest], 1))).toEqual(['accepted']);
  });

  it('logs what it did — counts and revisions, never the answers', async () => {
    await sync(
      t.http,
      ada,
      [completeQuest(VOCABULARY), completeQuest('d001-nothing', { answers: [] })],
      1,
    );
    const log = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .findLast((line) => line['msg'] === 'Progress sync');
    expect(log).toMatchObject({
      userId: ada.user.id,
      mutations: 2,
      accepted: 1,
      duplicate: 0,
      rejected: 1,
      rejections: ['UNKNOWN_QUEST'],
      revisionBefore: 1,
      revisionAfter: 2,
      durationMs: expect.any(Number),
      req: expect.objectContaining({ id: expect.any(String) }),
    });
    const all = lines.join('\n');
    expect(all).not.toContain('optionId');
    expect(all).not.toContain('exerciseId');
    expect(all).not.toContain(ada.accessToken);
  });

  it('refuses a body over its limit', async () => {
    const response = await request(t.http)
      .post('/api/v1/progress/sync')
      .set('Authorization', bearer(ada))
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(1_100_000) }))
      .expect(413);
    expect(response.body).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });
});

describe('the database', () => {
  it('holds each record once, whatever the code above it does', async () => {
    await sync(t.http, ada, [startChallenge(DAY_ONE), completeQuest(VOCABULARY)]);
    const challenge = await t.prisma.userChallenge.findFirstOrThrow();
    const duplicate = (promise: Promise<unknown>) =>
      expect(promise).rejects.toMatchObject({ code: 'P2002' });
    const base = { challengeId: challenge.id, mutationId: randomUUID() };
    await duplicate(
      t.prisma.xpLedgerEntry.create({
        data: { ...base, reason: 'quest', refId: VOCABULARY, amount: 30, createdAt: new Date() },
      }),
    );
    const word = await t.prisma.learnedWord.findFirstOrThrow();
    await duplicate(
      t.prisma.learnedWord.create({
        data: {
          challengeId: challenge.id,
          wordId: word.wordId,
          questId: 'd089-vocabulary',
          learnedAt: new Date(),
        },
      }),
    );
    await duplicate(
      t.prisma.questCompletion.create({
        data: {
          ...base,
          questId: VOCABULARY,
          day: 1,
          questType: 'vocabulary',
          courseVersion: 1,
          correctCount: 0,
          totalCount: 6,
          xpEarned: 0,
          completedAt: new Date(),
        },
      }),
    );
    // And refuses nonsense outright.
    await expect(
      t.prisma.xpLedgerEntry.create({
        data: {
          ...base,
          reason: 'achievement',
          refId: 'days3',
          amount: -500,
          createdAt: new Date(),
        },
      }),
    ).rejects.toThrow();
  });
});

describe('two devices', () => {
  it('end with the same progress, whatever order they sync in — XP paid once', async () => {
    await sync(t.http, ada, [startChallenge(DAY_ONE)]);
    // Both offline: the phone plays the first two quests, the tablet the first three.
    const phone = [VOCABULARY, GRAMMAR].map((id) => completeQuest(id));
    const tablet = [VOCABULARY, GRAMMAR, READING].map((id) => completeQuest(id, { wrong: 1 }));

    const tabletFirst = await sync(t.http, ada, tablet, 1);
    const phoneSecond = await sync(t.http, ada, phone, 1);
    expect(statuses(phoneSecond)).toEqual(['accepted', 'accepted']);
    // The phone was behind: it receives what the tablet did.
    expect(phoneSecond.progress).toEqual(tabletFirst.progress);
    expect(tabletFirst.progress?.questCompletions.map((c) => c.questId).sort()).toEqual(
      [VOCABULARY, GRAMMAR, READING].sort(),
    );
    expect(await t.prisma.xpLedgerEntry.count({ where: { reason: 'quest' } })).toBe(3);
  });

  it('take turns when they sync at the same moment', async () => {
    await sync(t.http, ada, [startChallenge(DAY_ONE)]);
    const results = await Promise.all(
      Array.from({ length: 5 }, () => sync(t.http, ada, [completeQuest(VOCABULARY)], 1)),
    );
    expect(results.flatMap(statuses)).toEqual(Array(5).fill('accepted'));
    expect(await t.prisma.questCompletion.count()).toBe(1);
    expect(await t.prisma.xpLedgerEntry.count({ where: { reason: 'quest' } })).toBe(1);
    expect((await progressOf(ada)).revision).toBe(2);
  });
});

describe('progress from before accounts', () => {
  const history = () =>
    mutation('importLegacyProgress', {
      courseId: COURSE_ID,
      courseVersion: COURSE_VERSION,
      startDate: '2026-08-01',
      timeZone: 'Europe/Berlin',
      quests: [...questsOf(1), ...questsOf(2)].map((questId) => ({
        questId,
        answers: questAnswers(questId),
        completedAt: '2026-08-01T12:00:00.000Z',
      })),
      exams: [],
    });

  it('is imported once into an account without a challenge — scored and derived here', async () => {
    const response = await sync(t.http, ada, [history()]);
    expect(statuses(response)).toEqual(['accepted']);
    expect(response.revision).toBe(1);
    expect(response.progress?.challenge).toMatchObject({
      startDate: '2026-08-01',
      timeZone: 'Europe/Berlin',
      completedDays: [1, 2],
      currentDay: 32,
      // Days 1 and 2 were a month ago: no streak today.
      streak: 0,
    });
    expect(response.progress?.questCompletions).toHaveLength(8);
    expect(response.progress?.dayCompletions.map((day) => day.day)).toEqual([1, 2]);

    const twice = await sync(t.http, ada, [history()], 1);
    expect(statuses(twice)).toEqual(['LEGACY_IMPORT_NOT_ALLOWED']);
  });

  it('is never merged into a challenge the account already has', async () => {
    await sync(t.http, ada, [startChallenge(DAY_ONE)]);
    const response = await sync(t.http, ada, [history()], 1);
    expect(statuses(response)).toEqual(['LEGACY_IMPORT_NOT_ALLOWED']);
    expect((await progressOf(ada)).progress.questCompletions).toEqual([]);
  });

  it('leaves out what does not pass the rules, and keeps the rest', async () => {
    const legacy = history();
    legacy.payload.quests.splice(1, 1); // Day 1's grammar is missing: the rest of Day 1 is locked.
    legacy.payload.quests.push({
      questId: 'd050-vocabulary',
      answers: [],
      completedAt: '2026-08-02T12:00:00.000Z',
    });
    const response = await sync(t.http, ada, [legacy]);
    expect(statuses(response)).toEqual(['accepted']);
    expect(response.progress?.questCompletions.map((c) => c.questId).sort()).toEqual(
      [VOCABULARY, ...questsOf(2)].sort(),
    );
    expect(response.progress?.challenge?.completedDays).toEqual([2]);
  });
});
