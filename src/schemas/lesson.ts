import { z } from 'zod';

import { IdSchema, ScoreSchema } from './common';
import { QuizQuestionSchema } from './quiz';

export const VocabularyItemSchema = z.object({
  id: IdSchema,
  word: z.string().min(1),
  phonetic: z.string().optional(),
  partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'phrase']),
  definition: z.string().min(1),
  /** Translation for the group's native language (Russian). */
  translation: z.string().min(1),
  example: z.string().min(1),
});
export type VocabularyItem = z.infer<typeof VocabularyItemSchema>;

const QuizSchema = z.array(QuizQuestionSchema).min(1);

/** Authored learning content behind a quest. */
export const QuestContentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('vocabulary'),
    questId: IdSchema,
    items: z.array(VocabularyItemSchema).min(1),
    quiz: QuizSchema,
  }),
  z.object({
    type: z.literal('grammar'),
    questId: IdSchema,
    topic: z.string().min(1),
    explanation: z.string().min(1),
    examples: z.array(z.string().min(1)).min(1),
    quiz: QuizSchema,
  }),
  z.object({
    type: z.literal('reading'),
    questId: IdSchema,
    title: z.string().min(1),
    paragraphs: z.array(z.string().min(1)).min(1),
    quiz: QuizSchema,
  }),
  z.object({ type: z.literal('review'), questId: IdSchema, quiz: QuizSchema }),
  z.object({ type: z.literal('finalBattle'), questId: IdSchema, quiz: QuizSchema }),
  z.object({
    type: z.literal('weeklyExam'),
    questId: IdSchema,
    passingScore: ScoreSchema,
    quiz: QuizSchema,
  }),
]);
export type QuestContent = z.infer<typeof QuestContentSchema>;
