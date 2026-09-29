import { z } from 'zod';

import { ChapterIdSchema } from './chapter';
import { CefrLevelSchema, CurriculumBandSchema, DayNumberSchema, IdSchema } from './common';
import { ReadingQuestionKindSchema } from './reading';

/**
 * The curriculum: the course's learning design, as data that a content
 * generator and the curriculum validator can read. It sits beside the
 * playable course and says what each day should teach, never the material
 * itself — words, lessons and texts stay in the course's banks.
 *
 *   Course.curriculum     the syllabus: bands, grammar topics, theme families, outcomes
 *   CourseDay.curriculum  one day's objectives: theme, vocabulary focus, grammar step,
 *                         reading, review mix — or a checkpoint's exam objectives,
 *                         or the Final Battle's blueprint
 */

/** How a day works on a grammar topic: first meeting, practice, contrast, consolidation. */
export const GrammarStageSchema = z.enum(['introduce', 'practice', 'contrast', 'consolidate']);
export type GrammarStage = z.infer<typeof GrammarStageSchema>;
export const GRAMMAR_STAGES = GrammarStageSchema.options;

/** What kind of text a Reading quest reads — varied on purpose, all short enough for a phone. */
export const ReadingGenreSchema = z.enum([
  'story',
  'dialogue',
  'message',
  'email',
  'blog',
  'travelNote',
  'workSituation',
  'personalExperience',
  'informational',
  'notice',
  'problemSolution',
  'opinion',
]);
export type ReadingGenre = z.infer<typeof ReadingGenreSchema>;
export const READING_GENRES = ReadingGenreSchema.options;

/** One unit of the grammar syllabus. */
export const GrammarTopicSchema = z.object({
  /** `present-perfect`. */
  id: IdSchema,
  title: z.string().min(1),
  level: CefrLevelSchema,
  /** Topics that must be introduced before this one is. */
  prerequisites: z.array(IdSchema),
});
export type GrammarTopic = z.infer<typeof GrammarTopicSchema>;

/** A theme family: days come back to it through the course, each time further on. */
export const ThemeFamilySchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
});
export type ThemeFamily = z.infer<typeof ThemeFamilySchema>;

const RangeSchema = z
  .object({ min: z.number().int().positive(), max: z.number().int().positive() })
  .refine((range) => range.max >= range.min, { message: 'max is below min', path: ['max'] });

/** What a band asks of a day: text length, questions, review size, how much Russian. */
export const BandProfileSchema = z.object({
  band: CurriculumBandSchema,
  level: CefrLevelSchema,
  readingWords: RangeSchema,
  readingQuestions: RangeSchema,
  readingSkills: z.array(ReadingQuestionKindSchema).min(1),
  /** Review exercises on a lesson day, and how many of them are about today. */
  review: z.object({
    size: z.number().int().min(4).max(12),
    today: z.number().int().min(1),
  }),
  /** How the day uses the support language (Russian). */
  support: z.string().min(1),
});
export type BandProfile = z.infer<typeof BandProfileSchema>;

/** What the learner can do by a given day — measurable, never a promise of fluency. */
export const LearningOutcomeSchema = z.object({
  day: DayNumberSchema,
  title: z.string().min(1),
  canDo: z.array(z.string().min(1)).min(3),
});
export type LearningOutcome = z.infer<typeof LearningOutcomeSchema>;

export const CourseCurriculumSchema = z.object({
  bands: z.array(BandProfileSchema).min(1),
  grammarTopics: z.array(GrammarTopicSchema).min(1),
  themes: z.array(ThemeFamilySchema).min(1),
  outcomes: z.array(LearningOutcomeSchema).min(1),
});
export type CourseCurriculum = z.infer<typeof CourseCurriculumSchema>;

const DayThemeSchema = z.object({
  /** The theme family it belongs to. */
  family: IdSchema,
  /** The day's own title: "Around town". */
  title: z.string().min(1),
});

const VocabularyPlanSchema = z.object({
  /** The semantic field of the day's new words. */
  focus: z.string().min(1),
  /** A few anchor words — not the day's list, which the content writes. */
  examples: z.array(z.string().min(1)).min(1).max(4),
});

const GrammarPlanSchema = z.object({
  topic: IdSchema,
  stage: GrammarStageSchema,
  /** Topics contrasted or recycled alongside — all introduced on earlier days. */
  related: z.array(IdSchema),
  objective: z.string().min(1),
});

const ReadingPlanSchema = z.object({
  genre: ReadingGenreSchema,
  topic: z.string().min(1),
  /** Question kinds the day's text is read for. */
  skills: z.array(ReadingQuestionKindSchema).min(1),
  words: RangeSchema,
  questions: RangeSchema,
});

/**
 * The review's mix, as exercise counts by where their material comes from,
 * and the earlier days that material comes back from.
 */
const ReviewPlanSchema = z.object({
  today: z.number().int().nonnegative(),
  recent: z.number().int().nonnegative(),
  older: z.number().int().nonnegative(),
  recentDays: z.array(DayNumberSchema),
  olderDays: z.array(DayNumberSchema),
});
export type ReviewPlan = z.infer<typeof ReviewPlanSchema>;

/** Written content that no longer fits the curriculum: NEEDS_CONTENT_REVISION, and why. */
const RevisionSchema = z.object({ reason: z.string().min(1) });

const SectionsSchema = z.object({
  vocabulary: z.number().int().nonnegative(),
  grammar: z.number().int().nonnegative(),
  reading: z.number().int().nonnegative(),
});

export const RegularDayCurriculumSchema = z.object({
  kind: z.literal('regular'),
  theme: DayThemeSchema,
  vocabulary: VocabularyPlanSchema,
  grammar: GrammarPlanSchema,
  reading: ReadingPlanSchema,
  review: ReviewPlanSchema,
  revision: RevisionSchema.optional(),
});

/** What a weekly exam checks: the learning objectives of the days before it. */
export const CheckpointObjectiveSchema = z.object({
  objective: z.string().min(1),
  coveredDays: z.array(DayNumberSchema).min(1),
  questions: z.number().int().min(5),
  sections: SectionsSchema,
  /** Theme families of the covered days. */
  themes: z.array(IdSchema),
  /** Grammar topics the covered days worked on. */
  grammar: z.array(IdSchema),
  readingSkills: z.array(ReadingQuestionKindSchema),
  /** What the learner should still know a week later. */
  mustRetain: z.array(z.string().min(1)).min(2),
});
export type CheckpointObjective = z.infer<typeof CheckpointObjectiveSchema>;

export const CheckpointDayCurriculumSchema = z.object({
  kind: z.literal('weeklyExam'),
  theme: DayThemeSchema,
  vocabulary: VocabularyPlanSchema,
  review: ReviewPlanSchema,
  exam: CheckpointObjectiveSchema,
  revision: RevisionSchema.optional(),
});

/** What the Final Battle measures — a distribution, not a list of questions. */
export const FinalBlueprintSchema = z.object({
  objective: z.string().min(1),
  questions: z.number().int().min(10),
  measures: z.object({
    vocabularyRetention: z.number().int().nonnegative(),
    grammarApplication: z.number().int().nonnegative(),
    readingComprehension: z.number().int().nonnegative(),
    contextInference: z.number().int().nonnegative(),
  }),
  sections: SectionsSchema,
  /** Questions per chapter: the whole way up, weighted by what each chapter taught. */
  chapters: z.array(
    z.object({ chapterId: ChapterIdSchema, questions: z.number().int().nonnegative() }),
  ),
  /** Grammar strands the grammar questions sample, one question each. */
  grammarStrands: z
    .array(z.object({ title: z.string().min(1), topics: z.array(IdSchema).min(1) }))
    .min(1),
  passages: z.number().int().min(1),
});
export type FinalBlueprint = z.infer<typeof FinalBlueprintSchema>;

export const SummitDayCurriculumSchema = z.object({
  kind: z.literal('summit'),
  theme: DayThemeSchema,
  final: FinalBlueprintSchema,
  revision: RevisionSchema.optional(),
});

/** One day's objectives. `kind` matches the day's kind in the course plan. */
export const DayCurriculumSchema = z.discriminatedUnion('kind', [
  RegularDayCurriculumSchema,
  CheckpointDayCurriculumSchema,
  SummitDayCurriculumSchema,
]);
export type DayCurriculum = z.infer<typeof DayCurriculumSchema>;
export type RegularDayCurriculum = z.infer<typeof RegularDayCurriculumSchema>;
export type CheckpointDayCurriculum = z.infer<typeof CheckpointDayCurriculumSchema>;
export type SummitDayCurriculum = z.infer<typeof SummitDayCurriculumSchema>;
