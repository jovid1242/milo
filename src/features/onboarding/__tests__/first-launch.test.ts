import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { loadProgressState } from '@/features/progress/use-cases';
import { toLocalDate } from '@/lib/dates';
import type { QuestCompletion } from '@/schemas';

import { needsOnboarding, startChallenge } from '../use-cases';

type Repositories = ReturnType<typeof createMemoryRepositories>;

const TODAY = new Date('2026-09-20T09:00:00.000Z');
const NAME = 'Mira';

/** A device the app has never run on: a profile exists, nothing else does. */
function firstLaunch(): Repositories {
  return createMemoryRepositories(toLocalDate(TODAY), { onboarded: false });
}

/** A user already walking: every day before `day` finished. */
async function midChallenge(day: number): Promise<Repositories> {
  const repositories = createMemoryRepositories(getStartDateForDay(day, TODAY));
  const plans = await repositories.challenge.getDailyChallenges();
  const history: QuestCompletion[] = plans
    .filter((plan) => plan.day < day)
    .flatMap((plan) =>
      plan.quests.map((quest) => ({
        questId: quest.id,
        day: plan.day,
        questType: quest.type,
        score: 0.9,
        correctCount: 5,
        totalCount: 5,
        xpEarned: 20,
        source: 'dev' as const,
        completedAt: '2026-09-19T10:00:00.000Z',
      })),
    );
  await repositories.dev?.seedHistory(history, [], [], []);
  return repositories;
}

describe('first launch', () => {
  it('sends a brand-new profile to onboarding', async () => {
    const repositories = firstLaunch();
    expect(needsOnboarding(await repositories.user.getUser())).toBe(true);
  });

  it('starts the challenge on Day 1 with nothing behind it', async () => {
    const repositories = firstLaunch();
    await startChallenge(repositories, { displayName: NAME, goal: 'confidence' }, TODAY);

    const user = await repositories.user.getUser();
    expect(needsOnboarding(user)).toBe(false);
    expect(user.displayName).toBe(NAME);
    expect(user.goal).toBe('confidence');
    expect(user.challengeStartDate).toBe(toLocalDate(TODAY));
    expect(user.onboardedAt).toBe(TODAY.toISOString());

    const state = await loadProgressState(repositories, TODAY);
    expect(state.currentDay).toBe(1);
    expect(state.chapterId).toBe('beginning');
    expect(state.completedDays).toEqual([]);
    expect(state.streak).toBe(0);
    expect(state.totalXp).toBe(0);
    expect(state.todayCompletedQuestIds).toEqual([]);
    expect(state.unlockedAchievementIds).toEqual([]);
    expect(state.challengeCompletion).toBeNull();
  });

  it('gives Day 1 a full set of quests to open', async () => {
    const repositories = firstLaunch();
    await startChallenge(repositories, { displayName: NAME, goal: 'habit' }, TODAY);

    const plan = await repositories.challenge.getDailyChallenge(1);
    expect(plan.day).toBe(1);
    expect(plan.quests.length).toBeGreaterThan(0);
  });

  it('starts the challenge once, however often the button is pressed', async () => {
    const repositories = firstLaunch();
    const [first, second] = await Promise.all([
      startChallenge(repositories, { displayName: NAME, goal: 'habit' }, TODAY),
      startChallenge(repositories, { displayName: 'Someone else', goal: 'vocabulary' }, TODAY),
    ]);

    expect(first.onboardedAt).toBe(second.onboardedAt);
    const user = await repositories.user.getUser();
    expect(user.displayName).toBe(NAME);
    expect(user.goal).toBe('habit');
  });

  it('never moves Day 1 once the challenge has begun', async () => {
    const repositories = firstLaunch();
    await startChallenge(repositories, { displayName: NAME, goal: 'habit' }, TODAY);

    const later = new Date('2026-09-23T09:00:00.000Z');
    await startChallenge(repositories, { displayName: 'Later', goal: 'workStudy' }, later);

    const user = await repositories.user.getUser();
    expect(user.challengeStartDate).toBe(toLocalDate(TODAY));
    const state = await loadProgressState(repositories, later);
    expect(state.currentDay).toBe(4);
  });

  it('refuses a name it could not keep, leaving the profile new', async () => {
    const repositories = firstLaunch();
    await expect(
      startChallenge(repositories, { displayName: 'J', goal: 'habit' }, TODAY),
    ).rejects.toThrow();

    expect(needsOnboarding(await repositories.user.getUser())).toBe(true);
  });

  it('trims the name the way it will be shown', async () => {
    const repositories = firstLaunch();
    const user = await startChallenge(
      repositories,
      { displayName: '  Mira  ', goal: 'habit' },
      TODAY,
    );
    expect(user.displayName).toBe(NAME);
  });
});

describe('a user already on the way', () => {
  it('is never sent back to onboarding', async () => {
    const repositories = await midChallenge(89);
    const user = await repositories.user.getUser();

    expect(needsOnboarding(user)).toBe(false);
    const state = await loadProgressState(repositories, TODAY);
    expect(state.currentDay).toBe(89);
    expect(state.completedDays).toHaveLength(88);
  });

  it('keeps their day even if the start is run again', async () => {
    const repositories = await midChallenge(89);
    const before = await repositories.user.getUser();

    await startChallenge(repositories, { displayName: 'Restart', goal: 'habit' }, TODAY);

    const after = await repositories.user.getUser();
    expect(after.challengeStartDate).toBe(before.challengeStartDate);
    expect(after.displayName).toBe(before.displayName);
    expect((await loadProgressState(repositories, TODAY)).currentDay).toBe(89);
  });

  it('can be put back into onboarding by the dev tools, progress intact', async () => {
    const repositories = await midChallenge(30);
    await repositories.dev?.resetOnboarding();

    expect(needsOnboarding(await repositories.user.getUser())).toBe(true);
    expect(await repositories.progress.getCompletions()).not.toHaveLength(0);
  });
});
