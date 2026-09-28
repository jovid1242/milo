import type { DayKind, DayNumber } from '@/schemas';

export type ReminderCopy = { title: string; body: string };

/**
 * Every word a daily reminder can say, in one place. Gentle by design: an
 * invitation to today's walk, never a threat — nothing about losing a streak,
 * nothing that counts what could be lost.
 *
 * The wording depends only on the challenge day and its kind, so planning the
 * same day twice produces the same notification (and nothing is rescheduled).
 */
const EVERYDAY: readonly [
  (day: DayNumber) => ReminderCopy,
  ...((day: DayNumber) => ReminderCopy)[],
] = [
  () => ({
    title: 'Milo is ready',
    body: 'A few minutes of English moves you one step closer to the summit.',
  }),
  () => ({
    title: 'Today’s journey is waiting',
    body: 'Complete your quests and keep moving toward the summit.',
  }),
  (day) => ({
    title: `Day ${day} is waiting`,
    body: 'A few short quests, and today’s stretch of the trail is done.',
  }),
];

/** The words for `day`, a day of kind `kind` in the course. */
export function reminderCopy(day: DayNumber, kind: DayKind): ReminderCopy {
  if (kind === 'summit') {
    return {
      title: 'The summit is waiting',
      body: 'One final challenge: everything you learned, one last climb.',
    };
  }
  if (kind === 'weeklyExam') {
    return { title: 'Checkpoint day', body: 'This week’s exam is ready whenever you are.' };
  }
  const variant = EVERYDAY[day % EVERYDAY.length] ?? EVERYDAY[0];
  return variant(day);
}
