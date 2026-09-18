import { z } from 'zod';

import { TimestampSchema } from './common';

/** Ids match the badge keys in the asset registry. */
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

export const AchievementCriteriaSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('completedDays'), count: z.number().int().positive() }),
  z.object({ type: z.literal('streak'), count: z.number().int().positive() }),
  z.object({ type: z.literal('wordsLearned'), count: z.number().int().positive() }),
  z.object({ type: z.literal('perfectQuiz') }),
  z.object({ type: z.literal('teamStreak'), count: z.number().int().positive() }),
]);
export type AchievementCriteria = z.infer<typeof AchievementCriteriaSchema>;

export const AchievementSchema = z.object({
  id: AchievementIdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  xpReward: z.number().int().nonnegative(),
  criteria: AchievementCriteriaSchema,
});
export type Achievement = z.infer<typeof AchievementSchema>;

export const AchievementUnlockSchema = z.object({
  achievementId: AchievementIdSchema,
  unlockedAt: TimestampSchema,
});
export type AchievementUnlock = z.infer<typeof AchievementUnlockSchema>;
