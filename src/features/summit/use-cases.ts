import { CHALLENGE } from '@/constants/challenge';
import type { Repositories } from '@/data/repositories/types';
import { loadPendingCelebrations, markCelebrated } from '@/features/achievements/use-cases';
import { loadProgressState } from '@/features/progress/use-cases';
import type { Achievement, ChallengeCompletion } from '@/schemas';

/** The finale, as the Summit Victory shows it — all from the existing progress selectors. */
export type SummitView = {
  completion: ChallengeCompletion;
  completedDays: number;
  totalDays: number;
  streak: number;
  totalXp: number;
  wordsLearned: number;
  /**
   * Badges that belong to the moment: the ones still waiting for their
   * celebration (the summit shows them itself — never as separate popups);
   * on a replay, the 90-day badge.
   */
  badges: Achievement[];
};

/** `null` until the summit is reached. */
export async function loadSummit(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<SummitView | null> {
  const [progress, pending, definitions] = await Promise.all([
    loadProgressState(repositories, now),
    loadPendingCelebrations(repositories),
    repositories.achievements.getDefinitions(),
  ]);
  const completion = progress.challengeCompletion;
  if (!completion) return null;
  const days90 = definitions.filter(
    (achievement) =>
      achievement.id === 'days90' && progress.unlockedAchievementIds.includes('days90'),
  );
  return {
    completion,
    completedDays: progress.completedDays.length,
    totalDays: CHALLENGE.totalDays,
    streak: progress.streak,
    totalXp: progress.totalXp,
    wordsLearned: progress.wordsLearned,
    badges: pending.length > 0 ? pending : days90,
  };
}

/**
 * Claims the summit's moment, all of it at once: the challenge's celebration,
 * Day 90's (the summit replaces its day summary) and the badges shown in the
 * sequence. Only the first call ever gets `true` — reopening the app or the
 * screen never plays the victory again.
 */
export async function claimSummit(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<boolean> {
  const at = now.toISOString();
  const first = await repositories.progress.markChallengeCelebrated(at);
  await repositories.progress.markDayCelebrated(CHALLENGE.totalDays, at);
  const pending = await loadPendingCelebrations(repositories);
  await markCelebrated(
    repositories,
    pending.map((achievement) => achievement.id),
    now,
  );
  return first;
}
