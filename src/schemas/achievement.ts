import { z } from 'zod';

import { TimestampSchema } from './common';

/** The 12 badges. Ids match the badge keys in the asset registry. */
export const AchievementIdSchema = z.enum([
  'firstDay',
  'days3',
  'days7',
  'days14',
  'days30',
  'days50',
  'days90',
  'words100',
  'words500',
  'perfectQuiz',
  'perfectWeek',
  'teamStreak',
]);
export type AchievementId = z.infer<typeof AchievementIdSchema>;

/** Groups on the Achievements screen. */
export const AchievementCategorySchema = z.enum(['consistency', 'learning', 'mastery', 'together']);
export type AchievementCategory = z.infer<typeof AchievementCategorySchema>;

/**
 * When a badge unlocks — always a fact of the challenge state:
 * - `completedDays`: fully completed challenge days (in total)
 * - `streak`: completed days in a row
 * - `uniqueWords`: different vocabulary words learned (a word counts once)
 * - `perfectQuest`: a scored quest finished with every answer right
 * - `perfectDaysInRow`: perfect days in a row (every quest of each day without a mistake)
 * - `teamStreak`: needs Friends, which do not exist yet — never unlocks until then
 */
export const AchievementRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('completedDays'), count: z.number().int().positive() }),
  z.object({ type: z.literal('streak'), count: z.number().int().positive() }),
  z.object({ type: z.literal('uniqueWords'), count: z.number().int().positive() }),
  z.object({ type: z.literal('perfectQuest') }),
  z.object({ type: z.literal('perfectDaysInRow'), count: z.number().int().positive() }),
  z.object({ type: z.literal('teamStreak'), count: z.number().int().positive() }),
]);
export type AchievementRule = z.infer<typeof AchievementRuleSchema>;

export const AchievementSchema = z.object({
  id: AchievementIdSchema,
  title: z.string().min(1),
  /** What it takes, in one sentence. */
  description: z.string().min(1),
  /** The line under the title when it unlocks. */
  tagline: z.string().min(1),
  category: AchievementCategorySchema,
  /** Badge asset key — a key, never the image itself. */
  badge: AchievementIdSchema,
  xpReward: z.number().int().nonnegative(),
  rule: AchievementRuleSchema,
});
export type Achievement = z.infer<typeof AchievementSchema>;

/** A persisted unlock: once written it stays, whatever happens to the streak later. */
export const AchievementUnlockSchema = z.object({
  achievementId: AchievementIdSchema,
  unlockedAt: TimestampSchema,
  /** When its celebration was shown; `null` until then (it is shown once, ever). */
  celebratedAt: TimestampSchema.nullable(),
});
export type AchievementUnlock = z.infer<typeof AchievementUnlockSchema>;

export const AchievementStateSchema = z.enum(['locked', 'unlocked', 'notAvailable']);
export type AchievementState = z.infer<typeof AchievementStateSchema>;

/** Real progress towards a locked badge; `null` for yes/no badges. */
export const AchievementProgressSchema = z.object({
  current: z.number().int().nonnegative(),
  target: z.number().int().positive(),
});
export type AchievementProgress = z.infer<typeof AchievementProgressSchema>;

/** A badge as the user sees it right now — derived, never stored. */
export const AchievementStatusSchema = z.object({
  achievement: AchievementSchema,
  state: AchievementStateSchema,
  unlockedAt: TimestampSchema.nullable(),
  progress: AchievementProgressSchema.nullable(),
});
export type AchievementStatus = z.infer<typeof AchievementStatusSchema>;
