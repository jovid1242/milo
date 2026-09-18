import { getLevelInfo, xpRequiredForLevel } from '@/features/progress/logic/levels';

describe('levels', () => {
  it('uses a growing XP curve', () => {
    expect(xpRequiredForLevel(1)).toBe(0);
    expect(xpRequiredForLevel(2)).toBe(100);
    expect(xpRequiredForLevel(3)).toBe(300);
    expect(xpRequiredForLevel(4)).toBe(600);
  });

  it('derives the level and the progress inside it', () => {
    expect(getLevelInfo(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100, progress: 0 });
    expect(getLevelInfo(99).level).toBe(1);
    expect(getLevelInfo(100).level).toBe(2);
    expect(getLevelInfo(150)).toEqual({
      level: 2,
      xpIntoLevel: 50,
      xpForNextLevel: 200,
      progress: 0.25,
    });
  });

  it('never goes below level 1', () => {
    expect(getLevelInfo(-50).level).toBe(1);
  });
});
