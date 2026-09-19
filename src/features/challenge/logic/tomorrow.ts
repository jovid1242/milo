import type { DailyChallenge, DayKind, DayNumber } from '@/schemas';

/** What the next day brings — for "Tomorrow: Day 90 · Summit". */
export type Tomorrow = { day: DayNumber; kind: DayKind };

const KIND_LABELS: Partial<Record<DayKind, string>> = {
  summit: 'Summit',
  weeklyExam: 'Weekly exam',
};

/** `null` after the last day of the challenge. */
export function findTomorrow(plans: readonly DailyChallenge[], day: DayNumber): Tomorrow | null {
  const next = plans.find((plan) => plan.day === day + 1);
  return next ? { day: next.day, kind: next.kind } : null;
}

export function tomorrowLabel(tomorrow: Tomorrow): string {
  const kind = KIND_LABELS[tomorrow.kind];
  return `Tomorrow: Day ${tomorrow.day}${kind ? ` · ${kind}` : ''}`;
}
