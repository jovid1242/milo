import { CHALLENGE } from '@/constants/challenge';
import type { Repositories } from '@/data/repositories/types';
import { trailCheckpoints } from '@/features/challenge/logic/calendar';
import { findTomorrow, type Tomorrow } from '@/features/challenge/logic/tomorrow';
import { findCompletedDays } from '@/features/progress/logic/day-completion';
import type { DayCompletion, DayKind, DayNumber } from '@/schemas';

/** Everything the Day Complete screen shows about one finished day. */
export type DaySummary = {
  day: DayNumber;
  totalDays: number;
  kind: DayKind;
  questCount: number;
  /** `null` while the day is not complete. */
  record: DayCompletion | null;
  /** Fully completed days of the whole challenge. */
  completedDays: number;
  checkpointDays: DayNumber[];
  daysToSummit: number;
  tomorrow: Tomorrow | null;
};

export async function loadDaySummary(
  repositories: Repositories,
  day: DayNumber,
): Promise<DaySummary> {
  const [plans, chapters, completions, record] = await Promise.all([
    repositories.challenge.getDailyChallenges(),
    repositories.challenge.getChapters(),
    repositories.progress.getCompletions(),
    repositories.progress.getDayCompletion(day),
  ]);
  const plan = plans.find((item) => item.day === day);
  if (!plan) throw new Error(`Unknown day: ${day}`);

  return {
    day,
    totalDays: CHALLENGE.totalDays,
    kind: plan.kind,
    questCount: plan.quests.length,
    record,
    completedDays: findCompletedDays(plans, completions).size,
    checkpointDays: trailCheckpoints(chapters),
    daysToSummit: CHALLENGE.totalDays - day,
    tomorrow: findTomorrow(plans, day),
  };
}
