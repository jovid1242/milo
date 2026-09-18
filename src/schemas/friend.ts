import { z } from 'zod';

import { DayNumberSchema, IdSchema, TimestampSchema } from './common';

export const FriendSchema = z.object({
  id: IdSchema,
  displayName: z.string().min(1),
  currentDay: DayNumberSchema,
  streak: z.number().int().nonnegative(),
  totalXp: z.number().int().nonnegative(),
  completedToday: z.boolean(),
  lastActiveAt: TimestampSchema,
});
export type Friend = z.infer<typeof FriendSchema>;
