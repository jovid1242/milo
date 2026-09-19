import { journeyFor } from '../__fixtures__/journey';

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe('buildTodayJourney', () => {
  it('opens a fresh day with the first quest available and the rest locked', () => {
    const journey = journeyFor({ day: 12, pastDays: range(1, 11) });

    expect(journey.steps.map((step) => step.status)).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
    ]);
    expect(journey.current?.quest.type).toBe('vocabulary');
    expect(journey.chapter.title).toBe('Momentum');
    expect(journey.streak).toBe(11);
    expect(journey.completedDays).toBe(11);
    expect(journey.daysToSummit).toBe(78);
    expect(journey.checkpointDays).toEqual([10, 30, 60]);
  });

  it('walks the route in order: done, in progress, locked', () => {
    const journey = journeyFor({
      day: 12,
      pastDays: range(1, 11),
      doneToday: ['vocabulary', 'grammar'],
      started: [{ type: 'reading', progress: 0.4 }],
    });

    expect(journey.steps.map((step) => step.status)).toEqual([
      'completed',
      'completed',
      'inProgress',
      'locked',
    ]);
    expect(journey.current?.progress).toBe(0.4);
    expect(journey.completedCount).toBe(2);
    expect(journey.xpEarnedToday).toBe(35);
    // Reading (5 min) and the Review (3 min) are still open.
    expect(journey.minutesLeft).toBe(8);
    expect(journey.isComplete).toBe(false);
  });

  it('ignores sessions of quests that are not current yet', () => {
    const journey = journeyFor({ day: 12, started: [{ type: 'review', progress: 0.5 }] });
    expect(journey.steps.at(-1)?.status).toBe('locked');
  });

  it('completes the day when every quest is done', () => {
    const journey = journeyFor({
      day: 12,
      pastDays: range(1, 11),
      doneToday: ['vocabulary', 'grammar', 'reading', 'review'],
    });

    expect(journey.isComplete).toBe(true);
    expect(journey.current).toBeNull();
    expect(journey.xpEarnedToday).toBe(65);
    expect(journey.streak).toBe(12);
    expect(journey.completedDays).toBe(12);
    // Every fixture quest has one wrong answer: done, but not a perfect day.
    expect(journey.isPerfectDay).toBe(false);
    expect(journey.tomorrow).toEqual({ day: 13, kind: 'regular' });
  });

  it('finishes Day 89 at camp, one day before the summit', () => {
    const journey = journeyFor({
      day: 89,
      pastDays: range(1, 88),
      doneToday: ['vocabulary', 'grammar', 'reading', 'review'],
    });

    expect(journey.completedCount).toBe(4);
    expect(journey.steps.every((step) => step.status === 'completed')).toBe(true);
    expect(journey.streak).toBe(89);
    expect(journey.completedDays).toBe(89);
    expect(journey.daysToSummit).toBe(1);
    expect(journey.tomorrow).toEqual({ day: 90, kind: 'summit' });
  });

  it('counts a perfect day only when every answer was right', () => {
    const perfect = journeyFor({
      day: 12,
      doneToday: ['vocabulary', 'grammar', 'reading', 'review'],
      perfect: true,
    });
    expect(perfect.isPerfectDay).toBe(true);
    const unfinished = journeyFor({ day: 12, doneToday: ['vocabulary'], perfect: true });
    expect(unfinished.isPerfectDay).toBe(false);
  });

  it('shapes exam days and the summit differently', () => {
    expect(journeyFor({ day: 14 }).steps.map((step) => step.quest.type)).toEqual([
      'vocabulary',
      'review',
      'weeklyExam',
    ]);
    const summit = journeyFor({ day: 90 });
    expect(summit.dayKind).toBe('summit');
    expect(summit.daysToSummit).toBe(0);
    expect(summit.steps.map((step) => step.quest.type)).toEqual(['finalBattle']);
  });

  it('says how a handed-in weekly exam went instead of its XP', () => {
    const exam = (examPassed: boolean) =>
      journeyFor({
        day: 84,
        pastDays: range(1, 83),
        doneToday: ['vocabulary', 'review', 'weeklyExam'],
        examPassed,
      }).steps.at(-1);

    expect(exam(false)).toMatchObject({ status: 'completed', examResult: 'notPassed' });
    expect(exam(true)).toMatchObject({ status: 'completed', examResult: 'passed' });
    // Other steps never carry an exam result.
    const journey = journeyFor({ day: 84, doneToday: ['vocabulary'] });
    expect(journey.steps.map((step) => step.examResult)).toEqual([null, null, null]);
  });
});
