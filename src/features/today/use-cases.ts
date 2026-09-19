import type { Repositories } from '@/data/repositories/types';
import { findTomorrow } from '@/features/challenge/logic/tomorrow';
import { loadProgressState } from '@/features/progress/use-cases';

import { buildTodayJourney, type TodayJourney } from './logic/today-journey';

/** Reads the current day's plan and progress and derives the Home view. */
export async function loadTodayJourney(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<TodayJourney> {
  const progress = await loadProgressState(repositories, now);
  const [chapters, plans, completions, sessions, dayCompletion] = await Promise.all([
    repositories.challenge.getChapters(),
    repositories.challenge.getDailyChallenges(),
    repositories.progress.getCompletionsForDays([progress.currentDay]),
    repositories.progress.getQuestSessions(),
    repositories.progress.getDayCompletion(progress.currentDay),
  ]);
  const plan = plans.find((item) => item.day === progress.currentDay);
  if (!plan) throw new Error(`No plan for day ${progress.currentDay}`);
  return buildTodayJourney({
    plan,
    chapters,
    progress,
    completions,
    sessions,
    dayCompletion,
    tomorrow: findTomorrow(plans, plan.day),
  });
}
