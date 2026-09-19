import type { Chapter, DayNumber, JourneyDay } from '@/schemas';

const KIND_LABELS: Record<JourneyDay['kind'], string | null> = {
  regular: null,
  weeklyExam: 'weekly exam',
  chapterEnd: 'chapter milestone',
  summit: 'final challenge',
};

/** "Day 42, completed" · "Day 90, final challenge, locked" — state in words, not only colour. */
export function dayAccessibilityLabel(day: JourneyDay): string {
  const parts = [`Day ${day.day}`];
  const kind = KIND_LABELS[day.kind];
  if (kind) parts.push(kind);
  if (day.isToday) parts.push('today');
  parts.push(
    day.state === 'available' ? 'available' : day.state === 'locked' ? 'locked' : day.state,
  );
  if (day.isPerfect) parts.push('perfect');
  return parts.join(', ');
}

export type DayStatus = {
  tone: 'done' | 'today' | 'missed' | 'locked';
  label: string;
  /** One calm sentence under the status. */
  detail: string | null;
};

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** What the day details sheet says about a day — from stored facts and the calendar only. */
export function dayStatus(day: JourneyDay, today: JourneyDay): DayStatus {
  switch (day.state) {
    case 'completed':
      return {
        tone: 'done',
        label: day.isToday ? 'Completed today' : 'Completed',
        detail: day.isPerfect ? 'A perfect day: every answer right.' : null,
      };
    case 'available':
      return {
        tone: 'today',
        label: 'Today',
        // Once something is done the numbers below say it; before that, where to go.
        detail:
          day.completedQuestCount > 0
            ? null
            : `${plural(day.questCount, 'quest')} waiting on Home.`,
      };
    case 'missed':
      return { tone: 'missed', label: 'Missed', detail: 'This day passed without its quests.' };
    case 'locked': {
      const wait = day.day - today.day;
      const opens = wait === 1 ? 'Opens tomorrow.' : `Opens in ${wait} days.`;
      const keepStreak =
        wait === 1 && today.state === 'available'
          ? ` Finish Day ${today.day} today to keep your streak.`
          : '';
      return { tone: 'locked', label: 'Locked', detail: opens + keepStreak };
    }
  }
}

/** "Chapter 03 · Habit" */
export const chapterLine = (chapter: Pick<Chapter, 'number' | 'title'>) =>
  `Chapter ${String(chapter.number).padStart(2, '0')} · ${chapter.title}`;

/** "Completed on 18 Sep" — in the device's language. */
export function completedOn(timestamp: string, locale?: string): string {
  const date = new Date(timestamp);
  return `Completed on ${date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`;
}

export const daysToSummitLabel = (currentDay: DayNumber, totalDays: number) => {
  const left = totalDays - currentDay;
  if (left <= 0) return 'Summit day';
  return left === 1 ? '1 day to the summit' : `${left} days to the summit`;
};
