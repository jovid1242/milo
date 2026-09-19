import { CHALLENGE } from '@/constants/challenge';
import { diffInCalendarDays, toLocalDate } from '@/lib/dates';
import type { Chapter, DayKind, DayNumber, LocalDate } from '@/schemas';
import { clamp } from '@/utils/number';

/** Challenge day for `now`, where `startDate` is Day 1. Clamped to 1…90. */
export function getChallengeDay(startDate: LocalDate, now: Date): DayNumber {
  const elapsed = diffInCalendarDays(startDate, toLocalDate(now));
  return clamp(elapsed + 1, 1, CHALLENGE.totalDays);
}

/** Start date that makes `day` the current day on `now` (used by dev tools). */
export function getStartDateForDay(day: DayNumber, now: Date): LocalDate {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1));
  return toLocalDate(start);
}

export function getWeekForDay(day: DayNumber): number {
  return Math.ceil(day / CHALLENGE.weeklyExamInterval);
}

export function getDayKind(day: DayNumber): DayKind {
  if (day === CHALLENGE.totalDays) return 'summit';
  if (day % CHALLENGE.weeklyExamInterval === 0) return 'weeklyExam';
  return 'regular';
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
