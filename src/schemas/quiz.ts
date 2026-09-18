import { z } from 'zod';

import { IdSchema } from './common';

const QuizOptionSchema = z.object({
  id: IdSchema,
  label: z.string().min(1),
});

const SingleChoiceQuestionSchema = z
  .object({
    kind: z.literal('singleChoice'),
    id: IdSchema,
    prompt: z.string().min(1),
    options: z.array(QuizOptionSchema).min(2).max(4),
    correctOptionId: IdSchema,
    explanation: z.string().optional(),
  })
  .superRefine((question, ctx) => {
    if (!question.options.some((option) => option.id === question.correctOptionId)) {
      ctx.addIssue({
        code: 'custom',
        message: 'correctOptionId is not one of the options',
        path: ['correctOptionId'],
      });
    }
  });

const FillBlankQuestionSchema = z.object({
  kind: z.literal('fillBlank'),
  id: IdSchema,
  /** Prompt containing `___` where the answer goes. */
  prompt: z.string().includes('___'),
  acceptedAnswers: z.array(z.string().min(1)).min(1),
  explanation: z.string().optional(),
});

export const QuizQuestionSchema = z.discriminatedUnion('kind', [
  SingleChoiceQuestionSchema,
  FillBlankQuestionSchema,
]);
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizAnswerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('singleChoice'), optionId: IdSchema }),
  z.object({ kind: z.literal('fillBlank'), text: z.string() }),
]);
export type QuizAnswer = z.infer<typeof QuizAnswerSchema>;
