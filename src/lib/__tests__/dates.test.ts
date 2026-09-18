import { addDays, diffInCalendarDays, parseLocalDate, toLocalDate } from '@/lib/dates';

describe('local dates', () => {
  it('formats and parses local calendar dates', () => {
    const date = new Date(2026, 8, 18, 23, 30, 0);
    expect(toLocalDate(date)).toBe('2026-09-18');
    expect(parseLocalDate('2026-09-18').getFullYear()).toBe(2026);
    expect(parseLocalDate('2026-09-18').getMonth()).toBe(8);
    expect(parseLocalDate('2026-09-18').getDate()).toBe(18);
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('counts whole calendar days, including across a DST change', () => {
    expect(diffInCalendarDays('2026-09-18', '2026-09-18')).toBe(0);
    expect(diffInCalendarDays('2026-09-18', '2026-09-30')).toBe(12);
    // Europe/Moscow has no DST, but CET/CEST switches on 2026-10-25.
    expect(diffInCalendarDays('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('rejects malformed dates', () => {
    expect(() => parseLocalDate('nope')).toThrow();
  });
});
