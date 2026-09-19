import type { DayNumber } from '@/schemas';

/**
 * Where the map was left, for this app session only: coming back to Journey
 * keeps the place, a fresh launch centres today again. Valid only while the
 * current day is the same.
 */
let memory: { offset: number; day: DayNumber } | null = null;

export function rememberMapScroll(offset: number, day: DayNumber): void {
  memory = { offset, day };
}

export function recallMapScroll(day: DayNumber): number | null {
  return memory?.day === day ? memory.offset : null;
}
