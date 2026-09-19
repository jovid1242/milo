import type { Repositories } from '@/data/repositories/types';
import { getChallengeDay } from '@/features/challenge/logic/calendar';
import { loadTeamStreakFacts } from '@/features/friends/use-cases';
import { findCompletedDays } from '@/features/progress/logic/day-completion';
import type { Achievement, AchievementId, AchievementStatus } from '@/schemas';

import {
  buildAchievementFacts,
  evaluateAchievements,
  findNewlyEarned,
  type AchievementFacts,
} from './logic/evaluate-achievements';

/** Reads the stored progress the badges depend on. */
export async function loadAchievementFacts(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<AchievementFacts> {
  const [user, plans, completions, dayCompletions, uniqueWords] = await Promise.all([
    repositories.user.getUser(),
    repositories.challenge.getDailyChallenges(),
    repositories.progress.getCompletions(),
    repositories.progress.getDayCompletions(),
    repositories.progress.countLearnedWords(),
  ]);
  const currentDay = getChallengeDay(user.challengeStartDate, now);
  const teamStreak = await loadTeamStreakFacts(repositories, {
    completedDays: findCompletedDays(plans, completions),
    currentDay,
  });
  return buildAchievementFacts({
    plans,
    completions,
    dayCompletions,
    uniqueWords,
    currentDay,
    teamStreak,
  });
}

/** The 12 badges as the user sees them now. */
export async function loadAchievements(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<AchievementStatus[]> {
  const [definitions, unlocks, facts] = await Promise.all([
    repositories.achievements.getDefinitions(),
    repositories.achievements.getUnlocks(),
    loadAchievementFacts(repositories, now),
  ]);
  return evaluateAchievements(definitions, facts, unlocks);
}

/**
 * Unlocks every badge whose rule is met now and awards its XP — once: the
 * repository decides atomically which unlocks are new, so a double call (or a
 * reload) returns nothing. The result is the "newly unlocked" event.
 */
export async function syncAchievements(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<Achievement[]> {
  const [definitions, unlocks, facts] = await Promise.all([
    repositories.achievements.getDefinitions(),
    repositories.achievements.getUnlocks(),
    loadAchievementFacts(repositories, now),
  ]);
  const earned = findNewlyEarned(
    definitions,
    facts,
    new Set(unlocks.map((unlock) => unlock.achievementId)),
  );
  if (earned.length === 0) return [];

  const timestamp = now.toISOString();
  const added = new Set(
    await repositories.achievements.unlock(
      earned.map((achievement) => achievement.id),
      timestamp,
    ),
  );
  const unlocked = earned.filter((achievement) => added.has(achievement.id));
  for (const achievement of unlocked) {
    if (achievement.xpReward > 0) {
      await repositories.progress.addXpEvent({
        amount: achievement.xpReward,
        reason: 'achievement',
        refId: achievement.id,
        createdAt: timestamp,
      });
    }
  }
  return unlocked;
}

/** Unlocked badges whose celebration has not been shown yet, in badge order. */
export async function loadPendingCelebrations(repositories: Repositories): Promise<Achievement[]> {
  const [definitions, unlocks] = await Promise.all([
    repositories.achievements.getDefinitions(),
    repositories.achievements.getUnlocks(),
  ]);
  const pending = new Set(
    unlocks.filter((unlock) => unlock.celebratedAt === null).map((unlock) => unlock.achievementId),
  );
  return definitions.filter((achievement) => pending.has(achievement.id));
}

/** Claims celebrations; only the first claim of each badge counts (shown once, ever). */
export async function markCelebrated(
  repositories: Repositories,
  ids: readonly AchievementId[],
  now: Date = new Date(),
): Promise<AchievementId[]> {
  return repositories.achievements.markCelebrated(ids, now.toISOString());
}
