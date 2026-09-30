import { CHALLENGE } from '@/constants/challenge';
import { diffInCalendarDays, toLocalDate } from '@/lib/dates';
import type { Chapter, DayNumber, LocalDate } from '@/schemas';
import { clamp } from '@/utils/number';

/** Challenge day on the calendar date `date`, where `startDate` is Day 1. Clamped to 1…90. */
export function challengeDayOn(startDate: LocalDate, date: LocalDate): DayNumber {
  return clamp(diffInCalendarDays(startDate, date) + 1, 1, CHALLENGE.totalDays);
}

/** Challenge day for `now` on this device's calendar, where `startDate` is Day 1. Clamped to 1…90. */
export function getChallengeDay(startDate: LocalDate, now: Date): DayNumber {
  return challengeDayOn(startDate, toLocalDate(now));
}

/** Start date that makes `day` the current day on `now` (used by dev tools). */
export function getStartDateForDay(day: DayNumber, now: Date): LocalDate {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1));
  return toLocalDate(start);
}

export function findChapterForDay<T extends Pick<Chapter, 'startDay' | 'endDay'>>(
  chapters: readonly T[],
  day: DayNumber,
): T {
  const chapter = chapters.find((c) => day >= c.startDay && day <= c.endDay);
  if (!chapter) throw new Error(`No chapter covers day ${day}`);
  return chapter;
}

/** Chapter ends shown along the 90-day trail (the last two sit on the summit itself). */
export function trailCheckpoints(chapters: readonly Pick<Chapter, 'endDay'>[]): DayNumber[] {
  return chapters.map((chapter) => chapter.endDay).filter((day) => day < CHALLENGE.totalDays - 1);
}
