import { diffJourney, feedbackCues, isSameSnapshot, takeSnapshot } from '../moments';
import { journeyFor } from '../__fixtures__/journey';

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

const day12 = (doneToday: Parameters<typeof journeyFor>[0]['doneToday'], totalXp: number) =>
  takeSnapshot(journeyFor({ day: 12, pastDays: range(1, 11), doneToday, totalXp }));

describe('journey moments', () => {
  it('finds a finished quest and the XP it brought', () => {
    const moment = diffJourney(day12(['vocabulary'], 300), day12(['vocabulary', 'grammar'], 315));

    expect(moment).toEqual({
      newlyCompletedQuestIds: ['d012-grammar'],
      xpFrom: 300,
      xpTo: 315,
      streakFrom: 11,
      streakTo: 11,
      dayCompleted: false,
    });
    expect(feedbackCues(moment!, 'regular')).toEqual([{ event: 'questComplete', delayMs: 0 }]);
  });

  it('celebrates the day first and lets the streak follow', () => {
    const moment = diffJourney(
      day12(['vocabulary', 'grammar', 'reading'], 355),
      day12(['vocabulary', 'grammar', 'reading', 'review'], 365),
    );

    expect(moment?.dayCompleted).toBe(true);
    expect(moment?.streakTo).toBe(12);
    expect(feedbackCues(moment!, 'regular')).toEqual([
      { event: 'dayComplete', delayMs: 0 },
      { event: 'streakUp', delayMs: 1100 },
    ]);
    expect(feedbackCues(moment!, 'summit')[0]?.event).toBe('summitVictory');
  });

  it('stays quiet on reopen, a new day or a reset', () => {
    const done = day12(['vocabulary', 'grammar', 'reading', 'review'], 365);
    expect(diffJourney(done, done)).toBeNull();
    expect(isSameSnapshot(done, day12(['vocabulary', 'grammar', 'reading', 'review'], 365))).toBe(
      true,
    );

    const tomorrow = takeSnapshot(journeyFor({ day: 13, pastDays: range(1, 12), totalXp: 365 }));
    expect(diffJourney(done, tomorrow)).toBeNull();

    expect(diffJourney(done, day12([], 0))).toBeNull();
  });
});
