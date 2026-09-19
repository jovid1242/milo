import type { DayNumber } from '@/schemas';

/** The longest run of consecutive days in a set. */
export function longestRun(days: ReadonlySet<DayNumber>): number {
  let longest = 0;
  for (const day of days) {
    if (days.has(day - 1)) continue; // not the start of a run
    let length = 1;
    while (days.has(day + length)) length++;
    longest = Math.max(longest, length);
  }
  return longest;
}
