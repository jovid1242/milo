import type { DayNumber } from '@/schemas';

/**
 * Consecutive fully completed days ending today — or yesterday, so a streak is
 * not shown as broken while today is still in progress.
 */
export function computeStreak(
  completedDays: ReadonlySet<DayNumber>,
  currentDay: DayNumber,
): number {
  let day = completedDays.has(currentDay) ? currentDay : currentDay - 1;
  let streak = 0;
  while (day >= 1 && completedDays.has(day)) {
    streak++;
    day--;
  }
  return streak;
}
