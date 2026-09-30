import { addDays } from '@/lib/dates';

import { teamDates, teamStreakOf, type TeamStreakMember } from '../team-streak';

/**
 * The team streak rule, as the server applies it: a date counts when every
 * member who had joined by then finished their challenge day for it — two
 * members at least — each on their own calendar.
 */

const START = '2026-09-01';
const on = (offset: number) => addDays(START, offset);
const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => from + index);

function member(input: { days: number[]; start?: string; joined?: string }): TeamStreakMember {
  return {
    startDate: input.start ?? START,
    joinedOn: input.joined ?? input.start ?? START,
    completedDays: new Set(input.days),
  };
}

describe('team days', () => {
  it('need everyone in the team to finish', () => {
    const ada = member({ days: [1, 2, 3] });
    const bea = member({ days: [1, 3] });
    expect([...teamDates([ada, bea], on(2))]).toEqual([on(0), on(2)]);
  });

  it('need two people: alone is not a team', () => {
    expect(teamDates([member({ days: range(1, 10) })], on(9)).size).toBe(0);
    expect(teamStreakOf([member({ days: range(1, 10) })], on(9))).toEqual({
      current: 0,
      longest: 0,
      todayComplete: false,
    });
  });

  it('count two members; a third counts from the day they join', () => {
    const ada = member({ days: range(1, 6) });
    const bea = member({ days: range(1, 6) });
    // Cy joins on the fourth day and misses it: that day is not the team's.
    const cy = member({ days: [5, 6], joined: on(3) });
    expect([...teamDates([ada, bea, cy], on(5))]).toEqual([on(0), on(1), on(2), on(4), on(5)]);
  });

  it('ask a new member for their day from the day they join — the days before are not theirs', () => {
    const ada = member({ days: range(1, 5) });
    const bea = member({ days: [4, 5], joined: on(3) });
    // Before Bea joined Ada was alone: no team days at all.
    expect([...teamDates([ada, bea], on(4))]).toEqual([on(3), on(4)]);
  });

  it('line members up by date, whatever day of the challenge each is on', () => {
    // Bea started three days after Ada: Bea's Day 1 is Ada's Day 4.
    const ada = member({ days: range(1, 6) });
    const bea = member({ days: [1, 2, 3], start: on(3) });
    expect([...teamDates([ada, bea], on(5))]).toEqual([on(3), on(4), on(5)]);
    expect(teamStreakOf([ada, bea], on(5))).toEqual({
      current: 3,
      longest: 3,
      todayComplete: true,
    });
  });

  it('count a member who starts after joining from their Day 1', () => {
    const ada = member({ days: range(1, 3) });
    const bea = member({ days: [1, 2], joined: on(0), start: on(1) });
    expect([...teamDates([ada, bea], on(2))]).toEqual([on(1), on(2)]);
  });

  it('end with the challenge: nothing is left to finish after Day 90', () => {
    const ada = member({ days: range(1, 90) });
    const bea = member({ days: range(1, 90) });
    const dates = teamDates([ada, bea], on(120));
    expect(dates.size).toBe(90);
    expect(dates.has(on(90))).toBe(false);
  });
});

describe('the team streak', () => {
  const pair = (days: number[]) => [member({ days }), member({ days })];

  it('runs up to today once everyone finished it', () => {
    expect(teamStreakOf(pair(range(1, 7)), on(6))).toEqual({
      current: 7,
      longest: 7,
      todayComplete: true,
    });
  });

  it('keeps yesterday’s run while today is still open', () => {
    expect(teamStreakOf(pair(range(1, 6)), on(6))).toEqual({
      current: 6,
      longest: 6,
      todayComplete: false,
    });
  });

  it('breaks for the whole team when one member misses a day — and the longest run stays', () => {
    const ada = member({ days: range(1, 12) });
    const bea = member({ days: [...range(1, 8), 10, 11, 12] });
    expect(teamStreakOf([ada, bea], on(11))).toEqual({
      current: 3,
      longest: 8,
      todayComplete: true,
    });
    // Two days without a team day: gone.
    expect(teamStreakOf([ada, bea], on(13)).current).toBe(0);
  });

  it('forgets a member who left: only the team as it is now counts', () => {
    const ada = member({ days: range(1, 7) });
    const bea = member({ days: range(1, 7) });
    const cy = member({ days: [1, 2] });
    expect(teamStreakOf([ada, bea, cy], on(6)).longest).toBe(2);
    // Cy left: Ada and Bea finished seven days together.
    expect(teamStreakOf([ada, bea], on(6)).longest).toBe(7);
  });
});
