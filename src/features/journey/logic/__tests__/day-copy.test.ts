import type { JourneyDay } from '@/schemas';

import { dayAccessibilityLabel, dayStatus, daysToSummitLabel, examCopy } from '../day-copy';

const day = (patch: Partial<JourneyDay>): JourneyDay => ({
  day: 42,
  chapterId: 'habit',
  kind: 'weeklyExam',
  state: 'completed',
  isToday: false,
  questCount: 3,
  completedQuestCount: 3,
  xpEarned: 125,
  isPerfect: false,
  completedAt: '2026-09-18T10:00:00.000Z',
  exam: null,
  ...patch,
});

describe('day accessibility labels', () => {
  it('says the state in words', () => {
    expect(dayAccessibilityLabel(day({}))).toBe('Day 42, weekly exam, completed');
    expect(dayAccessibilityLabel(day({ kind: 'regular', isPerfect: true }))).toBe(
      'Day 42, completed, perfect',
    );
    expect(
      dayAccessibilityLabel(day({ day: 90, kind: 'summit', state: 'locked', isPerfect: null })),
    ).toBe('Day 90, final challenge, locked');
    expect(
      dayAccessibilityLabel(
        day({ day: 89, kind: 'chapterEnd', state: 'available', isToday: true }),
      ),
    ).toBe('Day 89, chapter milestone, today, available');
    expect(dayAccessibilityLabel(day({ kind: 'regular', state: 'missed', isPerfect: null }))).toBe(
      'Day 42, missed',
    );
  });
});

describe('exam days', () => {
  const exam = (
    status: NonNullable<JourneyDay['exam']>['status'],
    bestScore: number | null = null,
  ) =>
    day({ day: 84, exam: { questId: 'd084-weeklyExam', status, bestScore, submittedAttempts: 1 } });

  it('say how the exam stands, in words', () => {
    expect(dayAccessibilityLabel(exam('passed', 0.8))).toBe(
      'Day 84, weekly exam, completed, exam passed',
    );
    expect(
      dayAccessibilityLabel({ ...exam('inProgress'), state: 'available', isToday: true }),
    ).toBe('Day 84, weekly exam, today, available, exam in progress');
  });

  it('invite back in when not passed yet, and open the exam from the map', () => {
    const passed = exam('passed', 0.8);
    expect(examCopy(passed.exam!, passed)).toMatchObject({
      tone: 'passed',
      detail: 'Best score 80%.',
      action: { label: 'See result', primary: false },
    });
    const notYet = exam('notPassed', 0.6);
    expect(examCopy(notYet.exam!, notYet)).toMatchObject({
      tone: 'retry',
      label: 'Not passed yet',
      detail: 'Best score 60%. Review the tricky parts and try again — any time.',
      action: { label: 'Review and try again' },
    });
    const ready = { ...exam('available'), state: 'available' as const, isToday: true };
    expect(examCopy(ready.exam!, ready).action?.label).toBe('Start exam');
    const locked = { ...exam('locked'), state: 'available' as const, isToday: true };
    expect(examCopy(locked.exam!, locked)).toMatchObject({
      detail: 'It opens after today’s other quests.',
      action: null,
    });
    expect(examCopy(exam('missed').exam!, exam('missed')).action).toBeNull();
  });
});

describe('day status', () => {
  const today = day({
    day: 89,
    kind: 'chapterEnd',
    state: 'available',
    isToday: true,
    completedQuestCount: 0,
    xpEarned: null,
    isPerfect: null,
    completedAt: null,
  });

  it('explains a locked day with the calendar, not a promise', () => {
    const tomorrow = day({ day: 90, kind: 'summit', state: 'locked', isPerfect: null });
    expect(dayStatus(tomorrow, today)).toEqual({
      tone: 'locked',
      label: 'Locked',
      detail: 'Opens tomorrow. Finish Day 89 today to keep your streak.',
    });
    const doneToday = { ...today, state: 'completed' as const };
    expect(dayStatus(tomorrow, doneToday).detail).toBe('Opens tomorrow.');
    expect(
      dayStatus(day({ day: 95 - 10, state: 'locked' }), day({ day: 60, isToday: true })).detail,
    ).toBe('Opens in 25 days.');
  });

  it('describes today, missed and completed days', () => {
    expect(dayStatus(today, today)).toMatchObject({
      tone: 'today',
      detail: '3 quests waiting on Home.',
    });
    // Once something is done, the numbers in the sheet say it.
    expect(dayStatus({ ...today, completedQuestCount: 2 }, today).detail).toBeNull();
    expect(dayStatus(day({ state: 'missed' }), today).label).toBe('Missed');
    expect(dayStatus(day({ isPerfect: true }), today)).toMatchObject({
      label: 'Completed',
      detail: 'A perfect day: every answer right.',
    });
    expect(dayStatus(day({ isToday: true }), today).label).toBe('Completed today');
  });

  it('counts down to the summit', () => {
    expect(daysToSummitLabel(89, 90)).toBe('1 day to the summit');
    expect(daysToSummitLabel(12, 90)).toBe('78 days to the summit');
    expect(daysToSummitLabel(90, 90)).toBe('Summit day');
  });
});
