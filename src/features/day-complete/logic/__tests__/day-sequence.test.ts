import { BEAT_AT_MS, DAY_BEATS, beatsReached, isBeatReached } from '../day-sequence';

describe('day complete sequence', () => {
  it('plays its beats in order: Milo, title, stats, 4/4, XP, streak, confetti', () => {
    const times = DAY_BEATS.map((beat) => BEAT_AT_MS[beat]);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(DAY_BEATS).toEqual(['milo', 'title', 'stats', 'quests', 'xp', 'streak', 'confetti']);
  });

  it('keeps the whole moment within a few seconds', () => {
    expect(Math.max(...Object.values(BEAT_AT_MS))).toBeLessThanOrEqual(3000);
  });

  it('knows which beats have happened', () => {
    expect(beatsReached(0)).toBe(1);
    expect(isBeatReached('milo', beatsReached(0))).toBe(true);
    expect(isBeatReached('title', beatsReached(0))).toBe(false);
    expect(isBeatReached('xp', beatsReached(BEAT_AT_MS.xp))).toBe(true);
    expect(isBeatReached('streak', beatsReached(BEAT_AT_MS.xp))).toBe(false);
    expect(beatsReached(10_000)).toBe(DAY_BEATS.length);
  });
});
