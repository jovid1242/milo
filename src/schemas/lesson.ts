import { z } from 'zod';

import { IdSchema, ScoreSchema } from './common';
import { GrammarQuestSchema } from './grammar';
import { QuizQuestionSchema } from './quiz';
import { ReadingQuestSchema } from './reading';
import { ReviewQuestSchema } from './review';
import { VocabularyQuestSchema } from './vocabulary';

const QuizSchema = z.array(QuizQuestionSchema).min(1);

/** Authored learning content behind a quest. */
export const QuestContentSchema = z.discriminatedUnion('type', [
  VocabularyQuestSchema,
  GrammarQuestSchema,
  ReadingQuestSchema,
  ReviewQuestSchema,
  z.object({ type: z.literal('finalBattle'), questId: IdSchema, quiz: QuizSchema }),
  z.object({
    type: z.literal('weeklyExam'),
    questId: IdSchema,
    passingScore: ScoreSchema,
    quiz: QuizSchema,
  }),
]);
export type QuestContent = z.infer<typeof QuestContentSchema>;
