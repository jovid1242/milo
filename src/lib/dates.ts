import type { LocalDate } from '@/schemas';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD` for the given instant in the device's local time zone. */
export function toLocalDate(date: Date): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a `YYYY-MM-DD` date. */
export function parseLocalDate(value: LocalDate): Date {
  const [year, month, day] = value.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Invalid local date: ${value}`);
  }
  return new Date(year, month - 1, day);
}

export function addDays(value: LocalDate, days: number): LocalDate {
  const date = parseLocalDate(value);
  date.setDate(date.getDate() + days);
  return toLocalDate(date);
}

/** Whole calendar days from `from` to `to` (DST-safe: rounds across 23/25h days). */
export function diffInCalendarDays(from: LocalDate, to: LocalDate): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / MS_PER_DAY);
}
