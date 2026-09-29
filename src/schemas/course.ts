import { z } from 'zod';

import { ChapterSchema } from './chapter';
import { IdSchema } from './common';
import { CourseCurriculumSchema } from './curriculum';
import { FinalChallengeSchema, WeeklyExamSchema } from './exam';
import { GrammarLessonSchema } from './grammar';
import { CourseDaySchema } from './quest';
import { ReadingTextSchema } from './reading';
import { ReviewQuestDefinitionSchema } from './review';
import { VocabularyItemSchema, VocabularyQuestDefinitionSchema } from './vocabulary';

/**
 * The course: everything the user is to learn, as one serializable document —
 * what a `LocalCourseRepository` bundles today and an `ApiCourseRepository`
 * will download, validate and cache later. Content only: what the user has
 * done lives in progress, how it looks lives in the app.
 *
 * Normalized: material lives once, in banks (words, grammar lessons, reading
 * texts), and everything else refers to it by stable id.
 *
 *   Course
 *    ├── chapters            Beginning · Momentum · Habit · Growth · Summit (band, purpose)
 *    ├── days (1…totalDays)  kind, chapter, level, quest slots, the day's curriculum
 *    ├── curriculum          bands, grammar topics, theme families, learning outcomes
 *    ├── vocabulary          vocab-<lemma>
 *    ├── grammar             grammar-<topic>, points grammar-<topic>.<point>
 *    ├── readings            reading-<slug>
 *    ├── lessons             the quests' content, by reference: d001-vocabulary …
 *    ├── checkpoints         weekly exams: exam-week-01 … on d007 …
 *    └── finalChallenge      the Final Battle on the last day
 */

/** Which material a Grammar quest teaches. */
export const GrammarQuestDefinitionSchema = z.object({
  type: z.literal('grammar'),
  questId: IdSchema,
  lessonId: IdSchema,
});

/** Which text a Reading quest reads. */
export const ReadingQuestDefinitionSchema = z.object({
  type: z.literal('reading'),
  questId: IdSchema,
  readingId: IdSchema,
});

/** A daily quest's content, as the course stores it: references into the banks. */
export const LessonQuestDefinitionSchema = z.discriminatedUnion('type', [
  VocabularyQuestDefinitionSchema,
  GrammarQuestDefinitionSchema,
  ReadingQuestDefinitionSchema,
  ReviewQuestDefinitionSchema,
]);
export type LessonQuestDefinition = z.infer<typeof LessonQuestDefinitionSchema>;

const CourseMetaFields = {
  /** Stable course id: `milo-english-90`. */
  id: IdSchema,
  /**
   * Content version. Progress records it, so content that changes later can
   * be told apart from the content a completion was earned on.
   */
  version: z.number().int().positive(),
  title: z.string().min(1),
  /** The language taught (ISO 639-1): `en`. */
  language: z.string().regex(/^[a-z]{2}$/),
  /** The language of translations and hints: `ru`. */
  supportLanguage: z.string().regex(/^[a-z]{2}$/),
  totalDays: z.number().int().positive(),
};

export const CourseMetaSchema = z.object(CourseMetaFields);
export type CourseMeta = z.infer<typeof CourseMetaSchema>;

/**
 * The course's shape without its material: what Home, the map and the
 * calendar need. Small enough to load first and keep at hand.
 */
export const CourseOutlineSchema = z.object({
  ...CourseMetaFields,
  chapters: z.array(ChapterSchema).min(1),
  days: z.array(CourseDaySchema).min(1),
});
export type CourseOutline = z.infer<typeof CourseOutlineSchema>;

/**
 * The whole course. Structural rules live in these schemas; rules across the
 * course (references, order, days and chapters, levels) in `validateCourse`.
 */
export const CourseSchema = z.object({
  ...CourseMetaFields,
  chapters: z.array(ChapterSchema).min(1),
  days: z.array(CourseDaySchema).min(1),
  vocabulary: z.array(VocabularyItemSchema),
  grammar: z.array(GrammarLessonSchema),
  readings: z.array(ReadingTextSchema),
  lessons: z.array(LessonQuestDefinitionSchema),
  checkpoints: z.array(WeeklyExamSchema),
  finalChallenge: FinalChallengeSchema.nullable(),
  curriculum: CourseCurriculumSchema,
});
export type Course = z.infer<typeof CourseSchema>;
