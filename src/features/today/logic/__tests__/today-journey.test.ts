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
    expect(journey.minutesLeft).toBe(11);
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
    expect(summit.steps.map((step) => step.quest.type)).toEqual(['review', 'finalBattle']);
  });
});
