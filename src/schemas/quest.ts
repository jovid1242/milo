import { z } from 'zod';

import { ChapterIdSchema } from './chapter';
import { DayNumberSchema, IdSchema } from './common';

/** Ids match the quest icon keys in the asset registry. */
export const QuestTypeSchema = z.enum([
  'vocabulary',
  'grammar',
  'reading',
  'review',
  'finalBattle',
  'weeklyExam',
]);
export type QuestType = z.infer<typeof QuestTypeSchema>;

export const QuestSchema = z.object({
  id: IdSchema,
  day: DayNumberSchema,
  type: QuestTypeSchema,
  title: z.string().min(1),
  summary: z.string().min(1),
  xpReward: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().positive(),
  /** Vocabulary quests only: how many new words the quest teaches. */
  wordCount: z.number().int().nonnegative().optional(),
});
export type Quest = z.infer<typeof QuestSchema>;

export const DayKindSchema = z.enum(['regular', 'weeklyExam', 'summit']);
export type DayKind = z.infer<typeof DayKindSchema>;

/** The plan for one challenge day: which quests make up the day. */
export const DailyChallengeSchema = z
  .object({
    day: DayNumberSchema,
    week: z.number().int().min(1),
    chapterId: ChapterIdSchema,
    kind: DayKindSchema,
    quests: z.array(QuestSchema).min(1),
  })
  .superRefine((plan, ctx) => {
    plan.quests.forEach((quest, index) => {
      if (quest.day !== plan.day) {
        ctx.addIssue({
          code: 'custom',
          message: 'quest belongs to another day',
          path: ['quests', index, 'day'],
        });
      }
    });
  });
export type DailyChallenge = z.infer<typeof DailyChallengeSchema>;
