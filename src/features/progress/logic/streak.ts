import type { DayNumber } from '@/schemas';

/** Consecutive completed days ending exactly at `day` (0 when `day` is not completed). */
export function streakEndingAt(completedDays: ReadonlySet<DayNumber>, day: DayNumber): number {
  let streak = 0;
  for (let current = day; current >= 1 && completedDays.has(current); current--) streak++;
  return streak;
}

/**
 * Consecutive fully completed days ending today — or yesterday, so a streak is
 * not shown as broken while today is still in progress.
 */
export function computeStreak(
  completedDays: ReadonlySet<DayNumber>,
  currentDay: DayNumber,
): number {
  return streakEndingAt(completedDays, completedDays.has(currentDay) ? currentDay : currentDay - 1);
}
