import { z } from 'zod';

import { IdSchema, LocalDateSchema, TimestampSchema } from './common';

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(24, 'Name must be at most 24 characters')
  .regex(/^[\p{L}\p{N} .'-]+$/u, 'Use letters, numbers, spaces, dots, apostrophes or hyphens');

export const UserSchema = z.object({
  id: IdSchema,
  displayName: DisplayNameSchema,
  /** Local calendar date of Day 1. The current day is derived from it. */
  challengeStartDate: LocalDateSchema,
  createdAt: TimestampSchema,
});
export type User = z.infer<typeof UserSchema>;
