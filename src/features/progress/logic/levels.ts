import type { LevelInfo } from '@/schemas';

/** Cumulative XP needed to reach `level`: 0, 100, 300, 600, 1000, … */
export function xpRequiredForLevel(level: number): number {
  return 50 * (level - 1) * level;
}

export function getLevelInfo(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xpRequiredForLevel(level + 1) <= xp) level++;
  const floor = xpRequiredForLevel(level);
  const xpForNextLevel = xpRequiredForLevel(level + 1) - floor;
  const xpIntoLevel = xp - floor;
  return { level, xpIntoLevel, xpForNextLevel, progress: xpIntoLevel / xpForNextLevel };
}
