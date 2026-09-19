import { z } from 'zod';

import { FinalChallengeSchema, WeeklyExamSchema } from './exam';
import { GrammarQuestSchema } from './grammar';
import { ReadingQuestSchema } from './reading';
import { ReviewQuestSchema } from './review';
import { VocabularyQuestSchema } from './vocabulary';

/** Authored learning content behind a quest. */
export const QuestContentSchema = z.discriminatedUnion('type', [
  VocabularyQuestSchema,
  GrammarQuestSchema,
  ReadingQuestSchema,
  ReviewQuestSchema,
  WeeklyExamSchema,
  FinalChallengeSchema,
]);
export type QuestContent = z.infer<typeof QuestContentSchema>;
