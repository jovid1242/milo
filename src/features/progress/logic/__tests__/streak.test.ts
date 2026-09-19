import { computeStreak, streakEndingAt } from '@/features/progress/logic/streak';

describe('computeStreak', () => {
  it('is zero without completed days', () => {
    expect(computeStreak(new Set(), 5)).toBe(0);
  });

  it('counts back from today when today is done', () => {
    expect(computeStreak(new Set([3, 4, 5]), 5)).toBe(3);
  });

  it('keeps yesterday’s streak while today is still open', () => {
    expect(computeStreak(new Set([3, 4]), 5)).toBe(2);
  });

  it('stops at a missed day', () => {
    expect(computeStreak(new Set([1, 2, 4, 5]), 5)).toBe(2);
  });

  it('breaks when neither today nor yesterday is done', () => {
    expect(computeStreak(new Set([1, 2, 3]), 6)).toBe(0);
  });
});

describe('streakEndingAt', () => {
  it('counts the run of days that ends exactly at a day', () => {
    expect(streakEndingAt(new Set([1, 2, 3, 5, 6]), 6)).toBe(2);
    expect(streakEndingAt(new Set([1, 2, 3, 5, 6]), 3)).toBe(3);
    expect(streakEndingAt(new Set([1, 2, 3]), 4)).toBe(0);
    expect(streakEndingAt(new Set([1]), 0)).toBe(0);
  });
});
