import { z } from 'zod';

import { IdSchema, LocalDateSchema, TimestampSchema } from './common';

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(24, 'Name must be at most 24 characters')
  .regex(/^[\p{L}\p{N} .'-]+$/u, 'Use letters, numbers, spaces, dots, apostrophes or hyphens');

/**
 * What the user wants most from the 90 days — asked once, in onboarding. A
 * preference kept on the profile (a backend can sync it later); it does not
 * change the challenge itself.
 */
export const GoalSchema = z.enum([
  'confidence',
  'understanding',
  'vocabulary',
  'habit',
  'workStudy',
]);
export type Goal = z.infer<typeof GoalSchema>;

export const UserSchema = z.object({
  id: IdSchema,
  displayName: DisplayNameSchema,
  /** Local calendar date of Day 1. The current day is derived from it. */
  challengeStartDate: LocalDateSchema,
  createdAt: TimestampSchema,
  /** `null` until chosen in onboarding. */
  goal: GoalSchema.nullable(),
  /**
   * When onboarding finished and the challenge started. `null` for a new
   * profile: the app shows onboarding until then.
   */
  onboardedAt: TimestampSchema.nullable(),
});
export type User = z.infer<typeof UserSchema>;
