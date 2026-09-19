import { FINAL_CHALLENGE } from '@/data/content/exams/final-challenge';
import { buildAllDailyChallenges, questId } from '@/data/content/schedule';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { syncAchievements } from '@/features/achievements/use-cases';
import { getChallengeDay, getStartDateForDay } from '@/features/challenge/logic/calendar';
import { passMark, scoreExam, withExamAnswer } from '@/features/exams/logic/exam';
import {
  loadExamRun,
  saveExamAttempt,
  startExamAttempt,
  submitExam,
} from '@/features/exams/use-cases';
import { loadJourney } from '@/features/journey/use-cases';
import { loadProgressState } from '@/features/progress/use-cases';
import { loadTodayJourney } from '@/features/today/use-cases';
import { FinalChallengeSchema, type Exam, type ExamAttempt, type QuestCompletion } from '@/schemas';

import { claimSummit, loadSummit } from '../use-cases';

type Repositories = ReturnType<typeof createMemoryRepositories>;
const FINAL = questId(90, 'finalBattle');
const AT = '2026-09-18T10:00:00.000Z';

/** Today is `day`, with every day before it finished (streak day − 1) and its badges settled. */
async function setup(day = 90): Promise<Repositories> {
  const repositories = createMemoryRepositories(getStartDateForDay(day, new Date()));
  const plans = await repositories.challenge.getDailyChallenges();
  const history: QuestCompletion[] = plans
    .filter((plan) => plan.day < day)
    .flatMap((plan) =>
      plan.quests.map((quest) => ({
        questId: quest.id,
        day: plan.day,
        questType: quest.type,
        score: 0.8,
        correctCount: 4,
        totalCount: 5,
        xpEarned: 0,
        source: 'dev' as const,
        completedAt: AT,
      })),
    );
  await repositories.dev?.seedHistory(history, [], [], []);
  // The badges earned on the way are unlocked already — only the summit's are new.
  await syncAchievements(repositories);
  const unlocked = await repositories.achievements.getUnlocks();
  await repositories.achievements.markCelebrated(
    unlocked.map((unlock) => unlock.achievementId),
    AT,
  );
  return repositories;
}

/** Answers the Final Battle in order: the first `skip` left open, the next `wrong` missed. */
async function answer(
  repositories: Repositories,
  attempt: ExamAttempt,
  { wrong = 0, skip = 0 } = {},
): Promise<ExamAttempt> {
  let current = attempt;
  FINAL_CHALLENGE.questions.forEach((question, index) => {
    if (index < skip) return;
    const missed = index < skip + wrong;
    const option = missed
      ? (question.options.find((item) => item.id !== question.correctOptionId)?.id ?? '')
      : question.correctOptionId;
    current = withExamAnswer(current, question, option, AT);
  });
  await saveExamAttempt(repositories, current);
  return current;
}

const take = async (repositories: Repositories, options: { wrong?: number; skip?: number }) =>
  submitExam(
    repositories,
    (await answer(repositories, await startExamAttempt(repositories, FINAL), options)).id,
  );

const finalXp = (repositories: Repositories) =>
  repositories.store.xpEvents
    .filter((event) => event.reason === 'examPass' && event.refId === FINAL_CHALLENGE.id)
    .reduce((sum, event) => sum + event.amount, 0);

describe('the Final Battle content', () => {
  it('mixes the whole challenge: 20 questions, 8 vocabulary, 7 grammar, 5 reading', () => {
    const exam = FinalChallengeSchema.parse(FINAL_CHALLENGE);
    const count = (section: string) => exam.questions.filter((q) => q.section === section).length;
    expect(exam.questions).toHaveLength(20);
    expect([count('vocabulary'), count('grammar'), count('reading')]).toEqual([8, 7, 5]);
    // Not only Day 89: material from the first month to the last one.
    expect(Math.min(...exam.coveredDays)).toBeLessThanOrEqual(10);
    expect(Math.max(...exam.coveredDays)).toBe(89);
    // The daily quests' exercise kinds — no new mechanic for the finale.
    expect(new Set(exam.questions.map((q) => q.kind)).size).toBeGreaterThanOrEqual(6);
    expect(exam.passingScore).toBe(0.7);
    expect(passMark(exam)).toBe(14);
  });

  it('rejects a final that covers only the last days', () => {
    const narrow = { ...FINAL_CHALLENGE, coveredDays: [80, 81, 86, 89] };
    expect(FinalChallengeSchema.safeParse(narrow).success).toBe(false);
  });
});

describe('scoring', () => {
  const synthetic = (count: number): Exam => ({
    ...FINAL_CHALLENGE,
    questions: Array.from({ length: count }, (_, index) => ({
      id: `q${index}`,
      section: 'grammar' as const,
      sourceDay: 2,
      prompt: 'Q',
      options: [
        { id: 'a', text: 'right' },
        { id: 'b', text: 'wrong' },
      ],
      correctOptionId: 'a',
      explanation: 'Because.',
    })),
  });
  const right = (exam: Exam, n: number) =>
    exam.questions.map((question, index) => ({
      questionId: question.id,
      optionId: index < n ? 'a' : 'b',
    }));

  it('passes at 70% and not at 69%', () => {
    const hundred = synthetic(100);
    expect(scoreExam(hundred, right(hundred, 69)).passed).toBe(false);
    expect(scoreExam(hundred, right(hundred, 70)).passed).toBe(true);
    const twenty = synthetic(20);
    expect(scoreExam(twenty, right(twenty, 13))).toMatchObject({ score: 0.65, passed: false });
    expect(scoreExam(twenty, right(twenty, 14))).toMatchObject({ score: 0.7, passed: true });
  });

  it('counts unanswered questions as not right, and knows a perfect run', () => {
    const exam = synthetic(20);
    expect(scoreExam(exam, right(exam, 20).slice(0, 18))).toMatchObject({
      correctCount: 18,
      unansweredCount: 2,
    });
    expect(scoreExam(exam, right(exam, 20)).isPerfect).toBe(true);
  });
});

describe('Day 90', () => {
  it('is locked until the day after Day 89, then open', async () => {
    const day89 = await setup(89);
    expect((await loadExamRun(day89, FINAL)).status).toBe('locked');
    expect((await loadJourney(day89)).days[89]).toMatchObject({ state: 'locked' });

    const day90 = await setup(90);
    expect((await loadExamRun(day90, FINAL)).status).toBe('available');
    expect((await loadJourney(day90)).days[89]).toMatchObject({
      state: 'available',
      exam: { status: 'available' },
    });
  });

  it('resumes an attempt where it was left', async () => {
    const repositories = await setup();
    const attempt = await startExamAttempt(repositories, FINAL);
    let current = attempt;
    for (const question of FINAL_CHALLENGE.questions.slice(0, 12)) {
      current = withExamAnswer(current, question, question.correctOptionId, AT);
    }
    await saveExamAttempt(repositories, { ...current, currentIndex: 12 });

    const run = await loadExamRun(repositories, FINAL);
    expect(run).toMatchObject({ status: 'inProgress', open: { id: attempt.id, currentIndex: 12 } });
    expect(run.open?.answers).toHaveLength(12);
    expect((await startExamAttempt(repositories, FINAL)).id).toBe(attempt.id);
  });

  it('a failed attempt finishes nothing: not the day, not the challenge', async () => {
    const repositories = await setup();
    const before = await loadProgressState(repositories);
    const failed = await take(repositories, { wrong: 7 });

    expect(failed.result).toMatchObject({ correctCount: 13, passed: false });
    expect(failed).toMatchObject({
      rewardGranted: false,
      dayCompleted: false,
      challengeCompleted: false,
    });
    expect(failed.newAchievements.map((a) => a.id)).not.toContain('days90');
    const after = await loadProgressState(repositories);
    expect(after.completedDays).toHaveLength(89);
    expect(after.challengeCompletion).toBeNull();
    expect(after.streak).toBe(before.streak);
    expect(after.totalXp).toBe(before.totalXp);
    expect((await loadJourney(repositories)).days[89]).toMatchObject({
      state: 'available',
      exam: { status: 'notPassed', bestScore: 0.65 },
    });
    // Home keeps the Final Battle open, with another try.
    const today = await loadTodayJourney(repositories);
    expect(today.challengeCompletion).toBeNull();
    expect(today.steps[0]).toMatchObject({ status: 'available', examResult: 'notPassed' });
  });

  it('a pass completes Day 90 and the challenge, in one go', async () => {
    const repositories = await setup();
    const before = await loadProgressState(repositories);
    await take(repositories, { wrong: 7 }); // one try first
    const passed = await take(repositories, { wrong: 3 });

    expect(passed).toMatchObject({
      isFirstSubmission: true,
      rewardGranted: true,
      xpEarned: 250,
      dayCompleted: true,
      challengeCompleted: true,
    });
    const after = await loadProgressState(repositories);
    expect(after.completedDays).toHaveLength(90);
    expect(after.streak).toBe(90);
    expect(after.challengeCompletion).toMatchObject({
      finalAttemptId: passed.attempt.id,
      correctCount: 17,
      totalCount: 20,
      isPerfect: false,
      xpEarned: 250,
      celebratedAt: null,
    });
    // The 90-day badge comes from the engine, because the challenge state changed.
    expect(passed.newAchievements.map((a) => a.id)).toContain('days90');
    expect(after.unlockedAchievementIds).toContain('days90');
    const badgeXp = passed.newAchievements.reduce((sum, a) => sum + a.xpReward, 0);
    expect(after.totalXp).toBe(before.totalXp + 250 + badgeXp);
    expect(finalXp(repositories)).toBe(250);

    const journey = await loadJourney(repositories);
    expect(journey).toMatchObject({ completedDays: 90, isComplete: true, summitReached: true });
    expect(journey.days[89]).toMatchObject({ state: 'completed', exam: { status: 'passed' } });
    expect(repositories.store.days.get(90)).toMatchObject({ streakAfter: 90 });
  });

  it('pays the Final Battle once: a double submit, a reload and a retake change nothing', async () => {
    const repositories = await setup();
    const attempt = await answer(repositories, await startExamAttempt(repositories, FINAL), {
      wrong: 2,
    });
    const both = await Promise.all([
      submitExam(repositories, attempt.id),
      submitExam(repositories, attempt.id),
    ]);
    expect(both.filter((s) => s.isFirstSubmission)).toHaveLength(1);
    expect(both.filter((s) => s.challengeCompleted)).toHaveLength(1);
    const completed = await loadProgressState(repositories);

    const again = await submitExam(repositories, attempt.id);
    expect(again).toMatchObject({ isFirstSubmission: false, challengeCompleted: false });

    const retake = await take(repositories, { wrong: 0 });
    expect(retake.result.isPerfect).toBe(true);
    expect(retake).toMatchObject({ rewardGranted: false, xpEarned: 0, challengeCompleted: false });

    const after = await loadProgressState(repositories);
    expect(finalXp(repositories)).toBe(250);
    expect(after.totalXp).toBe(completed.totalXp);
    expect(after.streak).toBe(90);
    expect(after.challengeCompletion).toEqual(completed.challengeCompletion);
    expect(repositories.store.days.size).toBe(1); // only the one written by the pass
  });

  it('knows a perfect Final Battle', async () => {
    const repositories = await setup();
    const perfect = await take(repositories, { wrong: 0 });
    expect(perfect.result.isPerfect).toBe(true);
    expect((await loadProgressState(repositories)).challengeCompletion?.isPerfect).toBe(true);
  });
});

describe('after the summit', () => {
  it('plays the victory once; reloading shows the summit at rest', async () => {
    const repositories = await setup();
    await take(repositories, { wrong: 3 });

    const view = await loadSummit(repositories);
    expect(view).toMatchObject({ completedDays: 90, totalDays: 90, streak: 90 });
    expect(view?.badges.map((badge) => badge.id)).toContain('days90');

    expect(await claimSummit(repositories)).toBe(true);
    expect(await claimSummit(repositories)).toBe(false);
    // The badges and Day 90 were told by the summit: no popups, no day summary later.
    expect(await repositories.achievements.getUnlocks()).not.toContainEqual(
      expect.objectContaining({ celebratedAt: null }),
    );
    expect(repositories.store.days.get(90)?.celebratedAt).not.toBeNull();

    const later = await loadProgressState(repositories);
    expect(later.challengeCompletion?.celebratedAt).not.toBeNull();
    expect((await loadSummit(repositories))?.badges.map((badge) => badge.id)).toEqual(['days90']);
  });

  it('never makes a Day 91', async () => {
    expect(buildAllDailyChallenges()).toHaveLength(90);
    const start = getStartDateForDay(90, new Date(2026, 8, 19));
    expect(getChallengeDay(start, new Date(2026, 9, 30))).toBe(90);

    const repositories = await setup();
    await take(repositories, { wrong: 0 });
    const later = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    const today = await loadTodayJourney(repositories, later);
    expect(today.day).toBe(90);
    expect(today.challengeCompletion).not.toBeNull();
  });
});
