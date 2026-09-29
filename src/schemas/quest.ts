import { z } from 'zod';

import { ChapterIdSchema } from './chapter';
import { CefrLevelSchema, DayNumberSchema, IdSchema } from './common';
import { DayCurriculumSchema } from './curriculum';

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

/**
 * What a day is in the course: a regular lesson day, a checkpoint (the weekly
 * exam) or the summit. Declared by the course for every day — the app reads
 * it and never works it out from the day number.
 */
export const DayKindSchema = z.enum(['regular', 'weeklyExam', 'summit']);
export type DayKind = z.infer<typeof DayKindSchema>;

/**
 * One day of the course: which chapter it belongs to, what kind of day it is
 * and which quests make it up. Content only — what the user did with it is
 * progress, and lives elsewhere.
 */
export const CourseDaySchema = z
  .object({
    /** `d001` … `d090`. */
    id: IdSchema,
    day: DayNumberSchema,
    week: z.number().int().min(1),
    chapterId: ChapterIdSchema,
    kind: DayKindSchema,
    /** The day's target level: it never goes down as the course goes on. */
    level: CefrLevelSchema,
    quests: z.array(QuestSchema).min(1),
    /**
     * What the day should teach — its learning objectives. Optional in shape;
     * the curriculum validator requires it for every day of a course.
     */
    curriculum: DayCurriculumSchema.optional(),
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
export type CourseDay = z.infer<typeof CourseDaySchema>;
