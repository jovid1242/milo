import type { Chapter, DayNumber, JourneyDay, JourneyExam } from '@/schemas';

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
  if (day.exam) parts.push(EXAM_WORDS[day.exam.status]);
  return parts.join(', ');
}

const EXAM_WORDS: Record<JourneyExam['status'], string> = {
  locked: 'exam locked',
  available: 'exam ready',
  inProgress: 'exam in progress',
  passed: 'exam passed',
  notPassed: 'exam not passed yet',
  missed: 'exam missed',
};

const percent = (score: number) => `${Math.round(score * 100)}%`;

export type ExamCopy = {
  tone: 'passed' | 'open' | 'retry' | 'locked' | 'missed';
  label: string;
  detail: string;
  /**
   * The sheet's way in: the exam (to start, resume or see the result) or —
   * once the Final Battle is passed — the summit, seen again.
   */
  action: { label: string; primary: boolean; target: 'exam' | 'summit' } | null;
};

/**
 * What the day sheet says about an exam day's exam — or Day 90's Final
 * Battle. Not passed yet is an invitation, never a verdict: the best score so
 * far and a way back in.
 */
export function examCopy(exam: JourneyExam, day: JourneyDay): ExamCopy {
  if (day.kind === 'summit') return finalCopy(exam, day);
  const best = exam.bestScore === null ? null : `Best score ${percent(exam.bestScore)}.`;
  switch (exam.status) {
    case 'passed':
      return {
        tone: 'passed',
        label: 'Exam passed',
        detail: best ?? 'Passed.',
        action: { label: 'See result', primary: false, target: 'exam' },
      };
    case 'notPassed':
      return {
        tone: 'retry',
        label: 'Not passed yet',
        detail: `${best ? `${best} ` : ''}Review the tricky parts and try again — any time.`,
        action: { label: 'Review and try again', primary: true, target: 'exam' },
      };
    case 'inProgress':
      return {
        tone: 'open',
        label: 'Exam in progress',
        detail: 'Your answers are saved. Pick up where you left off.',
        action: { label: 'Resume exam', primary: true, target: 'exam' },
      };
    case 'available':
      return {
        tone: 'open',
        label: 'Exam ready',
        detail: 'Test what you’ve learned this week.',
        action: { label: 'Start exam', primary: true, target: 'exam' },
      };
    case 'locked':
      return {
        tone: 'locked',
        label: 'Exam locked',
        detail: day.isToday
          ? 'It opens after today’s other quests.'
          : `It opens on Day ${day.day}.`,
        action: null,
      };
    case 'missed':
      return {
        tone: 'missed',
        label: 'Exam missed',
        detail: 'This exam’s day passed without it.',
        action: null,
      };
  }
}

/** Day 90: the Final Battle, and once it is passed, the summit. */
function finalCopy(exam: JourneyExam, day: JourneyDay): ExamCopy {
  const best = exam.bestScore === null ? null : `Best score ${percent(exam.bestScore)}.`;
  switch (exam.status) {
    case 'passed':
      return {
        tone: 'passed',
        label: 'Summit reached',
        detail: best ? `Final Battle passed. ${best}` : 'Final Battle passed.',
        action: { label: 'View final result', primary: false, target: 'summit' },
      };
    case 'notPassed':
      return {
        tone: 'retry',
        label: 'Not passed yet',
        detail: `${best ? `${best} ` : ''}Review the tricky parts and try again — the summit waits.`,
        action: { label: 'Try again', primary: true, target: 'exam' },
      };
    case 'inProgress':
      return {
        tone: 'open',
        label: 'Final Battle in progress',
        detail: 'Your answers are saved. Pick up where you left off.',
        action: { label: 'Resume the Final Battle', primary: true, target: 'exam' },
      };
    case 'available':
      return {
        tone: 'open',
        label: 'Final Battle ready',
        detail: 'One final challenge remains.',
        action: { label: 'Climb to the summit', primary: true, target: 'exam' },
      };
    case 'locked':
    case 'missed':
      return {
        tone: 'locked',
        label: 'Final Battle locked',
        detail: `It opens on Day ${day.day}, the day after Day ${day.day - 1}.`,
        action: null,
      };
  }
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
        // An exam day's own block says it better (the exam opens right from the map).
        detail:
          day.completedQuestCount > 0 || day.kind === 'summit'
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
