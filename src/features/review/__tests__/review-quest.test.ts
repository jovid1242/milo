import { questId } from '@/data/content/schedule';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { loadDaySummary } from '@/features/day-complete/use-cases';
import { claimDayCelebration, completeDay, loadProgressState } from '@/features/progress/use-cases';
import { finishQuestRun, loadQuestRun } from '@/features/quests/use-cases';
import { loadTodayJourney } from '@/features/today/use-cases';
import type { ChoiceAnswer, QuestCompletion } from '@/schemas';

const DAY = 89;
const AT = '2026-09-18T10:00:00.000Z';
const REVIEW_ID = questId(DAY, 'review');

type Repositories = ReturnType<typeof createMemoryRepositories>;

/** Day 89 with 88 days walked before it (streak 88). */
async function setup(): Promise<Repositories> {
  const repositories = createMemoryRepositories(getStartDateForDay(DAY, new Date()));
  const plans = await repositories.challenge.getDailyChallenges();
  const history: QuestCompletion[] = plans
    .filter((plan) => plan.day < DAY)
    .flatMap((plan) =>
      plan.quests.map((quest) => ({
        questId: quest.id,
        day: plan.day,
        questType: quest.type,
        score: 1,
        correctCount: 5,
        totalCount: 5,
        xpEarned: quest.xpReward,
        source: 'dev' as const,
        completedAt: AT,
      })),
    );
  await repositories.dev?.seedHistory(history, [], []);
  return repositories;
}

const answers = (count: number, wrong: number): ChoiceAnswer[] =>
  Array.from({ length: count }, (_, index) => ({
    exerciseId: `exercise-${index + 1}`,
    optionId: 'x',
    correct: index >= wrong,
    answeredAt: AT,
  }));

/** Vocabulary, Grammar and Reading — each with `wrong` misses. */
async function finishFirstThree(repositories: Repositories, wrong = 1) {
  for (const [type, count] of [
    ['vocabulary', 6],
    ['grammar', 6],
    ['reading', 4],
  ] as const) {
    await finishQuestRun(repositories, {
      questId: questId(DAY, type),
      answers: answers(count, wrong),
      exerciseCount: count,
    });
  }
}

const playReview = (repositories: Repositories, wrong = 1) =>
  finishQuestRun(repositories, {
    questId: REVIEW_ID,
    answers: answers(8, wrong),
    exerciseCount: 8,
  });

describe('review quest and the end of the day', () => {
  it('opens with its source material and knows it ends the day', async () => {
    const repositories = await setup();
    const run = await loadQuestRun(repositories, REVIEW_ID);
    expect(run.content?.type).toBe('review');
    expect(run.sources.map((content) => content.type).sort()).toEqual([
      'grammar',
      'reading',
      'vocabulary',
    ]);
    expect(run.isLastOfDay).toBe(true);
  });

  it('awards +10 XP once — a replay earns nothing', async () => {
    const repositories = await setup();
    await finishFirstThree(repositories);
    const before = await repositories.progress.getTotalXp();

    const first = await playReview(repositories);
    expect(first).toMatchObject({ isFirstCompletion: true, xpEarned: 10 });
    const replay = await playReview(repositories, 0);
    expect(replay).toMatchObject({ isFirstCompletion: false, xpEarned: 0 });

    expect((await repositories.progress.getTotalXp()) - before).toBe(10);
  });

  it('does not complete a day at 3 of 4', async () => {
    const repositories = await setup();
    await finishFirstThree(repositories);

    expect(await completeDay(repositories, DAY)).toBeNull();
    expect(await repositories.progress.getDayCompletion(DAY)).toBeNull();
    const journey = await loadTodayJourney(repositories);
    expect(journey).toMatchObject({ completedCount: 3, isComplete: false, dayCompletion: null });
    expect(journey.streak).toBe(88);
  });

  it('completes the day with the fourth quest: 65 XP, streak 88 → 89', async () => {
    const repositories = await setup();
    await finishFirstThree(repositories);
    const outcome = await playReview(repositories);

    expect(outcome.dayCompleted).toBe(true);
    expect(outcome.dayCompletion).toMatchObject({
      day: DAY,
      questCount: 4,
      xpEarned: 65,
      streakBefore: 88,
      streakAfter: 89,
      isPerfect: false,
      celebratedAt: null,
    });
    expect(outcome.streakAfter).toBe(89);
  });

  it('records the day once, whoever asks and however often', async () => {
    const repositories = await setup();
    await finishFirstThree(repositories);
    // A double tap on the last "Continue": two completions race.
    const outcomes = await Promise.all([playReview(repositories), playReview(repositories)]);
    expect(outcomes.filter((outcome) => outcome.dayCompleted)).toHaveLength(1);
    const xp = await repositories.progress.getTotalXp();

    // "Finish Day" tapped twice, and once more later.
    const results = await Promise.all([
      completeDay(repositories, DAY),
      completeDay(repositories, DAY),
    ]);
    const later = await completeDay(repositories, DAY);
    for (const result of [...results, later]) {
      expect(result).toMatchObject({ isFirstCompletion: false, record: { streakAfter: 89 } });
    }

    const records = await repositories.progress.getDayCompletions();
    expect(records.filter((record) => record.day === DAY)).toHaveLength(1);
    expect(await repositories.progress.getTotalXp()).toBe(xp);
    expect((await loadProgressState(repositories)).streak).toBe(89);
  });

  it('finishes a day on the first call only, even when calls race', async () => {
    const repositories = await setup();
    await finishFirstThree(repositories);
    await playReview(repositories);
    // Simulate a day whose quests were stored without its record (older data).
    repositories.store.days.delete(DAY);

    const results = await Promise.all([
      completeDay(repositories, DAY),
      completeDay(repositories, DAY),
    ]);
    expect(results.filter((result) => result?.isFirstCompletion)).toHaveLength(1);
    expect(results[0]?.record).toEqual(results[1]?.record);
  });

  it('calls it a perfect day only when every answer was right — mistakes never block it', async () => {
    const perfect = await setup();
    await finishFirstThree(perfect, 0);
    expect((await playReview(perfect, 0)).dayCompletion?.isPerfect).toBe(true);

    const withMistakes = await setup();
    await finishFirstThree(withMistakes, 2);
    const outcome = await playReview(withMistakes, 8);
    expect(outcome.dayCompletion).toMatchObject({ isPerfect: false, questCount: 4 });
  });

  it('celebrates the day once, ever', async () => {
    const repositories = await setup();
    await finishFirstThree(repositories);
    await playReview(repositories);

    expect(await claimDayCelebration(repositories, DAY)).toBe(true);
    expect(await claimDayCelebration(repositories, DAY)).toBe(false);
    expect((await repositories.progress.getDayCompletion(DAY))?.celebratedAt).not.toBeNull();
  });

  it('shows Home at 4 of 4 and the journey at 89 of 90 — also when read back later', async () => {
    const repositories = await setup();
    await finishFirstThree(repositories);
    await playReview(repositories);
    await claimDayCelebration(repositories, DAY);

    // Everything is read back from storage, as after a restart.
    const journey = await loadTodayJourney(repositories);
    expect(journey).toMatchObject({
      completedCount: 4,
      isComplete: true,
      streak: 89,
      completedDays: 89,
      daysToSummit: 1,
      xpEarnedToday: 65,
      tomorrow: { day: 90, kind: 'summit' },
    });
    expect(journey.steps.every((step) => step.status === 'completed')).toBe(true);
    expect(journey.dayCompletion?.celebratedAt).not.toBeNull();

    const summary = await loadDaySummary(repositories, DAY);
    expect(summary).toMatchObject({
      completedDays: 89,
      totalDays: 90,
      daysToSummit: 1,
      questCount: 4,
      tomorrow: { day: 90, kind: 'summit' },
    });
  });

  it('forgets the day when its quests are reset', async () => {
    const repositories = await setup();
    await finishFirstThree(repositories);
    await playReview(repositories);

    const plan = await repositories.challenge.getDailyChallenge(DAY);
    await repositories.progress.deleteCompletions(plan.quests.map((quest) => quest.id));
    expect(await repositories.progress.getDayCompletion(DAY)).toBeNull();
    expect((await loadProgressState(repositories)).streak).toBe(88);
  });
});
