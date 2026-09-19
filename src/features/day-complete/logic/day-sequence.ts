/**
 * The first-visit celebration, beat by beat: Milo arrives, the title, the
 * summary appears, today's quests resolve to 4/4, the XP counts up, the streak
 * steps up, a light confetti sweep. About two and a half seconds; a tap skips
 * straight to the end.
 */
export const DAY_BEATS = ['milo', 'title', 'stats', 'quests', 'xp', 'streak', 'confetti'] as const;
export type DayBeat = (typeof DAY_BEATS)[number];

export const BEAT_AT_MS: Record<DayBeat, number> = {
  milo: 0,
  title: 250,
  stats: 600,
  quests: 900,
  xp: 1250,
  streak: 2050,
  confetti: 2400,
};

/** Beats reached after `elapsedMs` (the first one is there at once). */
export function beatsReached(elapsedMs: number): number {
  return DAY_BEATS.filter((beat) => BEAT_AT_MS[beat] <= elapsedMs).length;
}

export function isBeatReached(beat: DayBeat, reached: number): boolean {
  return DAY_BEATS.indexOf(beat) < reached;
}
