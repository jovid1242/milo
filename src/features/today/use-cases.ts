import type { Repositories } from '@/data/repositories/types';
import { loadProgressState } from '@/features/progress/use-cases';

import { buildTodayJourney, type TodayJourney } from './logic/today-journey';

/** Reads the current day's plan and progress and derives the Home view. */
export async function loadTodayJourney(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<TodayJourney> {
  const progress = await loadProgressState(repositories, now);
  const [chapters, plan, completions, sessions] = await Promise.all([
    repositories.challenge.getChapters(),
    repositories.challenge.getDailyChallenge(progress.currentDay),
    repositories.progress.getCompletionsForDays([progress.currentDay]),
    repositories.progress.getQuestSessions(),
  ]);
  return buildTodayJourney({ plan, chapters, progress, completions, sessions });
}
