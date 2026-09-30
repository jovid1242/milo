import { CHALLENGE } from '@/constants/challenge';
import { addDays, diffInCalendarDays } from '@/lib/dates';
import type { DayNumber, LocalDate, TeamStreak } from '@/schemas';

/**
 * The team streak — computed by the server from its own records (members,
 * when they joined, their finished days), never stored and never sent by a
 * device. The rule, the badge's "everyone in your team finishes the day":
 *
 * - A team day is a calendar date on which every member of the team who had
 *   joined by then finished their challenge day for that date — and there
 *   were at least two of them. Alone is not a team.
 * - Each member counts from the day they join (the days before are not theirs
 *   to finish), on their own calendar: dates are in their challenge's time
 *   zone, and their challenge day for a date follows from their Day 1.
 * - Only the team as it is now counts: someone who left no longer counts, for
 *   or against, on any day.
 * - The streak is the team days in a row up to today — or up to yesterday
 *   while today is still open, like a member's own streak.
 * - Two members are enough; the third counts from the day they join.
 */

export type TeamStreakMember = {
  /** Day 1 of their challenge. */
  startDate: LocalDate;
  /** The date they joined the team, in their challenge's time zone. */
  joinedOn: LocalDate;
  /** Their challenge days the server recorded as finished. */
  completedDays: ReadonlySet<DayNumber>;
};

const later = (a: LocalDate, b: LocalDate) => (a > b ? a : b);

/** The first date a member counts on: the day they joined, or their Day 1 if that is later. */
const countsFrom = (member: TeamStreakMember) => later(member.joinedOn, member.startDate);

/** Whether the member finished their challenge day that falls on `date`. */
function finishedOn(member: TeamStreakMember, date: LocalDate): boolean {
  const day = diffInCalendarDays(member.startDate, date) + 1;
  return day >= 1 && day <= CHALLENGE.totalDays && member.completedDays.has(day);
}

/** Every team day up to `today` (the viewer's date). */
export function teamDates(members: readonly TeamStreakMember[], today: LocalDate): Set<LocalDate> {
  const dates = new Set<LocalDate>();
  const starts = members.map(countsFrom).sort();
  // Before the second member counts, nobody shares a day.
  const first = starts[1];
  if (first === undefined) return dates;
  // After everyone's last challenge day there is nothing left to finish.
  const last = members
    .map((member) => addDays(member.startDate, CHALLENGE.totalDays - 1))
    .reduce((a, b) => later(a, b));
  const end = today < last ? today : last;
  for (let date = first; date <= end; date = addDays(date, 1)) {
    const counted = members.filter((member) => countsFrom(member) <= date);
    if (counted.length >= 2 && counted.every((member) => finishedOn(member, date))) {
      dates.add(date);
    }
  }
  return dates;
}

function runEndingAt(dates: ReadonlySet<LocalDate>, date: LocalDate): number {
  let run = 0;
  for (let current = date; dates.has(current); current = addDays(current, -1)) run += 1;
  return run;
}

/** The team streak on `today` (the viewer's date). */
export function teamStreakOf(members: readonly TeamStreakMember[], today: LocalDate): TeamStreak {
  const dates = teamDates(members, today);
  const todayComplete = dates.has(today);
  let longest = 0;
  for (const date of dates) {
    if (dates.has(addDays(date, -1))) continue; // not the start of a run
    let length = 1;
    while (dates.has(addDays(date, length))) length += 1;
    longest = Math.max(longest, length);
  }
  return {
    current: runEndingAt(dates, todayComplete ? today : addDays(today, -1)),
    longest,
    todayComplete,
  };
}
