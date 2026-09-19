import { questId } from '@/data/content/schedule';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { completeQuest } from '@/features/progress/use-cases';
import type { QuestCompletion } from '@/schemas';

import { planCelebration } from '../logic/evaluate-achievements';
import {
  loadAchievements,
  loadPendingCelebrations,
  markCelebrated,
  syncAchievements,
} from '../use-cases';

type Repositories = ReturnType<typeof createMemoryRepositories>;
const AT = '2026-09-18T10:00:00.000Z';

async function setup(currentDay: number): Promise<Repositories> {
  return createMemoryRepositories(getStartDateForDay(currentDay, new Date()));
}

/** Earlier days as stored history (the badges they earn are left for the test to sync). */
async function seedDays(repositories: Repositories, days: readonly number[], perfect = false) {
  const plans = await repositories.challenge.getDailyChallenges();
  const completions: QuestCompletion[] = plans
    .filter((plan) => days.includes(plan.day))
    .flatMap((plan) =>
      plan.quests.map((quest) => ({
        questId: quest.id,
        day: plan.day,
        questType: quest.type,
        score: perfect ? 1 : 5 / 6,
        correctCount: perfect ? 6 : 5,
        totalCount: 6,
        xpEarned: quest.xpReward,
        source: 'user' as const,
        completedAt: AT,
      })),
    );
  await repositories.dev?.seedHistory(completions, [], [], []);
}

/** A whole day, played through the real completion use case. */
async function playDay(repositories: Repositories, day: number, perfect = false) {
  const plan = await repositories.challenge.getDailyChallenge(day);
  const outcomes = [];
  for (const quest of plan.quests) {
    outcomes.push(
      await completeQuest(repositories, {
        questId: quest.id,
        correctCount: perfect ? 6 : 5,
        totalCount: 6,
      }),
    );
  }
  return outcomes;
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

const statusOf = async (repositories: Repositories, id: string) =>
  (await loadAchievements(repositories)).find((status) => status.achievement.id === id);

const words = (count: number, questIdForWords = 'seed') =>
  Array.from({ length: count }, (_, index) => ({
    wordId: `word-${index + 1}`,
    questId: questIdForWords,
    learnedAt: AT,
  }));

describe('achievements over real progress', () => {
  it('unlocks First Day once, with its XP once', async () => {
    const repositories = await setup(1);
    const outcomes = await playDay(repositories, 1);
    const unlocked = outcomes.flatMap((outcome) => outcome.newAchievements.map((a) => a.id));
    expect(unlocked).toEqual(['firstDay']);

    expect(await syncAchievements(repositories)).toEqual([]);
    const achievementXp = repositories.store.xpEvents.filter(
      (event) => event.reason === 'achievement',
    );
    expect(achievementXp).toEqual([expect.objectContaining({ refId: 'firstDay', amount: 25 })]);
  });

  it('unlocks the 3- and 7-day streaks on consecutive days only', async () => {
    const gap = await setup(4);
    await seedDays(gap, [1, 2, 4]); // Day 3 missed
    expect((await syncAchievements(gap)).map((a) => a.id)).toEqual(['firstDay']);

    const row = await setup(7);
    await seedDays(row, range(1, 6));
    expect((await syncAchievements(row)).map((a) => a.id)).toEqual(['firstDay', 'days3']);
    const day7 = await playDay(row, 7);
    expect(day7.flatMap((outcome) => outcome.newAchievements.map((a) => a.id))).toEqual(['days7']);
  });

  it('shows 30-day progress from the running streak', async () => {
    const repositories = await setup(19);
    await seedDays(repositories, range(1, 18));
    expect(await statusOf(repositories, 'days30')).toMatchObject({
      state: 'locked',
      progress: { current: 18, target: 30 },
    });
  });

  it('keeps an unlocked streak badge after the streak is lost', async () => {
    const repositories = await setup(8);
    await seedDays(repositories, range(1, 7));
    await syncAchievements(repositories);
    // Days pass without quests: the streak is gone…
    await repositories.user.updateChallengeStartDate(getStartDateForDay(20, new Date()));
    expect(await statusOf(repositories, 'days7')).toMatchObject({ state: 'unlocked' });
    // …and the 14-day badge counts the new (empty) run.
    expect(await statusOf(repositories, 'days14')).toMatchObject({
      state: 'locked',
      progress: { current: 0, target: 14 },
    });
  });

  it('counts learned words once each — duplicates and replays add nothing', async () => {
    const repositories = await setup(1);
    await repositories.progress.recordLearnedWords(words(94));
    await repositories.progress.recordLearnedWords(words(94, 'another-lesson')); // same words again
    expect(await repositories.progress.countLearnedWords()).toBe(94);

    // Day 1's vocabulary lesson teaches 6 new words: 100.
    const vocabulary = questId(1, 'vocabulary');
    const first = await completeQuest(repositories, {
      questId: vocabulary,
      correctCount: 5,
      totalCount: 6,
    });
    expect(first.newAchievements.map((a) => a.id)).toEqual(['words100']);
    // A replay teaches nothing new.
    await completeQuest(repositories, { questId: vocabulary, correctCount: 6, totalCount: 6 });
    expect(await repositories.progress.countLearnedWords()).toBe(100);
  });

  it('unlocks 500 words at exactly 500 different words', async () => {
    const repositories = await setup(1);
    await repositories.progress.recordLearnedWords(words(499));
    expect((await syncAchievements(repositories)).map((a) => a.id)).toEqual(['words100']);
    expect(await statusOf(repositories, 'words500')).toMatchObject({
      progress: { current: 499, target: 500 },
    });
    await repositories.progress.recordLearnedWords(words(500));
    expect((await syncAchievements(repositories)).map((a) => a.id)).toEqual(['words500']);
  });

  it('gives Perfect Quiz for a perfect scored quest only — never for 5/6', async () => {
    const repositories = await setup(1);
    const fiveOfSix = await completeQuest(repositories, {
      questId: questId(1, 'grammar'),
      correctCount: 5,
      totalCount: 6,
    });
    expect(fiveOfSix.newAchievements).toEqual([]);
    const perfect = await completeQuest(repositories, {
      questId: questId(1, 'reading'),
      correctCount: 4,
      totalCount: 4,
    });
    expect(perfect.newAchievements.map((a) => a.id)).toEqual(['perfectQuiz']);
  });

  it('needs seven perfect days in a row for Perfect Week', async () => {
    const six = await setup(7);
    await seedDays(six, range(1, 6), true);
    await syncAchievements(six);
    const notPerfect = await playDay(six, 7, false);
    expect(notPerfect.flatMap((o) => o.newAchievements.map((a) => a.id))).not.toContain(
      'perfectWeek',
    );

    const seven = await setup(7);
    await seedDays(seven, range(1, 6), true);
    await syncAchievements(seven);
    const perfect = await playDay(seven, 7, true);
    expect(perfect.flatMap((o) => o.newAchievements.map((a) => a.id))).toContain('perfectWeek');
  });

  it('keeps Team Streak unavailable without a team', async () => {
    const repositories = await setup(30);
    await seedDays(repositories, range(1, 29));
    await syncAchievements(repositories);
    expect(await statusOf(repositories, 'teamStreak')).toMatchObject({
      state: 'notAvailable',
      progress: null,
      unlockedAt: null,
    });
  });

  it('handles several unlocks at once as one celebration', async () => {
    const repositories = await setup(7);
    await seedDays(repositories, range(1, 6), true);
    await playDay(repositories, 7, true);
    const pending = await loadPendingCelebrations(repositories);
    expect(pending.map((a) => a.id).sort()).toEqual(
      ['days3', 'days7', 'firstDay', 'perfectQuiz', 'perfectWeek'].sort(),
    );
    expect(planCelebration(pending)?.lead.id).toBe('perfectWeek');
    expect(planCelebration(pending)?.others).toHaveLength(4);
  });

  it('celebrates the 7-day streak once — a relaunch shows it unlocked, quietly', async () => {
    const repositories = await setup(7);
    await seedDays(repositories, range(1, 6));
    await syncAchievements(repositories);
    await markCelebrated(
      repositories,
      (await loadPendingCelebrations(repositories)).map((a) => a.id),
    );

    await playDay(repositories, 7); // complete Day 7
    const pending = await loadPendingCelebrations(repositories);
    expect(pending.map((a) => a.id)).toEqual(['days7']);
    // The celebration is shown and claimed…
    expect(await markCelebrated(repositories, ['days7'])).toEqual(['days7']);
    expect(await markCelebrated(repositories, ['days7'])).toEqual([]); // …once.

    // Relaunch: everything is read back from storage.
    expect(await syncAchievements(repositories)).toEqual([]); // no new "unlocked" event
    expect(await loadPendingCelebrations(repositories)).toEqual([]);
    expect(await statusOf(repositories, 'days7')).toMatchObject({ state: 'unlocked' });
  });

  it('unlocks idempotently even when two syncs race', async () => {
    const repositories = await setup(3);
    await seedDays(repositories, range(1, 3));
    const [a, b] = await Promise.all([
      syncAchievements(repositories),
      syncAchievements(repositories),
    ]);
    const ids = [...(a ?? []), ...(b ?? [])].map((achievement) => achievement.id).sort();
    expect(ids).toEqual(['days3', 'firstDay']);
    const xp = repositories.store.xpEvents.filter((event) => event.reason === 'achievement');
    expect(xp).toHaveLength(2);
  });
});
