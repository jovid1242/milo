import { getGreeting } from '../greeting';
import { journeyFor } from '../__fixtures__/journey';

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe('getGreeting', () => {
  it('invites the user into a fresh day', () => {
    const greeting = getGreeting(journeyFor({ day: 12, pastDays: range(1, 11) }));
    expect(greeting).toEqual({
      mascot: 'idle',
      title: 'Ready for Day 12?',
      subtitle: '4 quests · about 20 min',
    });
  });

  it('keeps walking mid-day and counts down to camp', () => {
    const midDay = getGreeting(
      journeyFor({ day: 12, pastDays: range(1, 11), doneToday: ['vocabulary', 'grammar'] }),
    );
    expect(midDay).toMatchObject({ mascot: 'walking', title: "Let's keep moving." });
    expect(midDay.subtitle).toBe('2 quests to camp');

    const lastStep = getGreeting(
      journeyFor({ day: 12, doneToday: ['vocabulary', 'grammar', 'reading'] }),
    );
    expect(lastStep).toEqual({
      mascot: 'walking',
      title: 'One more step!',
      subtitle: 'Review, then camp.',
    });
  });

  it('celebrates a completed day with the XP earned', () => {
    const greeting = getGreeting(
      journeyFor({ day: 12, doneToday: ['vocabulary', 'grammar', 'reading', 'review'] }),
    );
    expect(greeting).toEqual({
      mascot: 'correct',
      title: 'Day 12 complete!',
      subtitle: '+65 XP earned today',
    });
  });

  it('mentions a perfect day quietly, without a badge', () => {
    const greeting = getGreeting(
      journeyFor({
        day: 12,
        doneToday: ['vocabulary', 'grammar', 'reading', 'review'],
        perfect: true,
      }),
    );
    expect(greeting.subtitle).toBe('A perfect day · +65 XP');
  });

  it('reacts to a broken streak, day 1, exam days and the summit', () => {
    expect(getGreeting(journeyFor({ day: 12, pastDays: range(1, 10) })).title).toBe(
      'Fresh start today.',
    );
    expect(getGreeting(journeyFor({ day: 1 })).title).toBe('Ready for Day 1?');
    expect(getGreeting(journeyFor({ day: 14, pastDays: range(1, 13) })).title).toBe('Exam day!');
    expect(getGreeting(journeyFor({ day: 90, pastDays: range(1, 89) })).title).toBe(
      'The summit is close.',
    );
  });
});
