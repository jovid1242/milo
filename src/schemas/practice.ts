import { z } from 'zod';

import { IdSchema, TimestampSchema } from './common';

/**
 * One answer to a choice exercise, shared by every quest type. The first
 * answer is final: it is what the feedback shows and what the result counts.
 */
export const ChoiceAnswerSchema = z.object({
  exerciseId: IdSchema,
  optionId: IdSchema,
  correct: z.boolean(),
  answeredAt: TimestampSchema,
});
export type ChoiceAnswer = z.infer<typeof ChoiceAnswerSchema>;
