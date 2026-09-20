import { z } from 'zod';

import { DayNumberSchema, IdSchema, ScoreSchema, TimestampSchema } from './common';

/**
 * Exams: the weekly exam (a checkpoint on every 7th day, testing the week
 * before it) and the Final Battle on Day 90 (the whole challenge). One shape
 * for both — self-contained on purpose, exactly what a backend would send as
 * JSON. Answers are checked only after the whole exam is submitted.
 */

export const ExamSectionSchema = z.enum(['vocabulary', 'grammar', 'reading']);
export type ExamSection = z.infer<typeof ExamSectionSchema>;

/**
 * The exercise a question repeats — the kinds the daily quests use, so an
 * exam never brings a new mechanic: what a word means, a sentence to
 * complete, the right form, a word in context, a text to understand, the
 * correct sentence, what a text implies.
 */
export const ExerciseKindSchema = z.enum([
  'meaning',
  'sentenceCompletion',
  'correctForm',
  'context',
  'readingComprehension',
  'sentenceCorrectness',
  'inference',
]);
export type ExerciseKind = z.infer<typeof ExerciseKindSchema>;

/** A short text that reading questions refer to. */
export const ExamPassageSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  text: z.string().min(40),
});
export type ExamPassage = z.infer<typeof ExamPassageSchema>;

export const ExamOptionSchema = z.object({ id: IdSchema, text: z.string().min(1) });

export const ExamQuestionSchema = z.object({
  id: IdSchema,
  section: ExamSectionSchema,
  kind: ExerciseKindSchema.optional(),
  /** The challenge day the material comes from. */
  sourceDay: DayNumberSchema,
  prompt: z.string().min(1),
  /** Gap questions: the sentence around `___`. */
  sentence: z.string().includes('___').optional(),
  /** Reading questions name their passage. */
  passageId: IdSchema.optional(),
  options: z.array(ExamOptionSchema).min(2).max(4),
  correctOptionId: IdSchema,
  /** Shown only after submission, in the review. */
  explanation: z.string().min(1),
});
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;

/** What every exam has, whichever kind it is. */
const examFields = {
  questId: IdSchema,
  id: IdSchema,
  /** The day the exam belongs to. */
  day: DayNumberSchema,
  /** The days whose material it tests — all before the exam day. */
  coveredDays: z.array(DayNumberSchema).min(1),
  /** Share of right answers needed to pass, 0…1 (the one place it is defined). */
  passingScore: ScoreSchema,
  /** Paid once, for the first pass. */
  xpReward: z.number().int().nonnegative(),
  estimatedMinutes: z.number().int().positive(),
  passages: z.array(ExamPassageSchema),
};

type ExamFields = {
  day: number;
  coveredDays: number[];
  passages: { id: string }[];
  questions: ExamQuestion[];
};

function checkExam(exam: ExamFields, ctx: z.RefinementCtx) {
  const issue = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: 'custom', message, path });
  exam.coveredDays.forEach((day, index) => {
    if (day >= exam.day)
      issue('covered days must come before the exam day', ['coveredDays', index]);
  });
  const ids = new Set<string>();
  const passages = new Set(exam.passages.map((passage) => passage.id));
  exam.questions.forEach((question, index) => {
    const path = ['questions', index];
    if (ids.has(question.id)) issue('question ids repeat', path);
    ids.add(question.id);
    const options = question.options.map((option) => option.id);
    if (new Set(options).size !== options.length) issue('option ids repeat', path);
    if (!options.includes(question.correctOptionId))
      issue('the answer is not among the options', path);
    if (!exam.coveredDays.includes(question.sourceDay)) issue('source day is not covered', path);
    if (question.section === 'reading' && !question.passageId)
      issue('reading needs a passage', path);
    if (question.passageId && !passages.has(question.passageId)) issue('unknown passage', path);
  });
}

export const WeeklyExamSchema = z
  .object({
    type: z.literal('weeklyExam'),
    week: z.number().int().min(1),
    ...examFields,
    questions: z.array(ExamQuestionSchema).min(5).max(30),
  })
  .superRefine(checkExam);
export type WeeklyExam = z.infer<typeof WeeklyExamSchema>;

/**
 * The Final Battle: Day 90's exam over the whole challenge — every chapter,
 * every kind of exercise. Unlike a weekly exam, only a pass finishes it (and
 * with it Day 90 and the challenge).
 */
export const FinalChallengeSchema = z
  .object({
    type: z.literal('finalBattle'),
    ...examFields,
    questions: z.array(ExamQuestionSchema).min(10).max(40),
  })
  .superRefine((exam, ctx) => {
    checkExam(exam, ctx);
    // The whole way up, not just the last days: material from the first
    // month and from the last one.
    if (Math.min(...exam.coveredDays) > 30 || Math.max(...exam.coveredDays) < 60) {
      ctx.addIssue({
        code: 'custom',
        message: 'the final battle covers the whole challenge',
        path: ['coveredDays'],
      });
    }
  });
export type FinalChallenge = z.infer<typeof FinalChallengeSchema>;

/** Any exam: the week's checkpoint or the Final Battle. */
export type Exam = WeeklyExam | FinalChallenge;

export const ExamAnswerSchema = z.object({ questionId: IdSchema, optionId: IdSchema });
export type ExamAnswer = z.infer<typeof ExamAnswerSchema>;

/**
 * One try at an exam, as stored. Open (`submittedAt: null`) it can be resumed
 * and its answers changed; once submitted it is final and scored.
 */
export const ExamAttemptSchema = z.object({
  id: IdSchema,
  examId: IdSchema,
  questId: IdSchema,
  /** 1 for the first try. */
  number: z.number().int().positive(),
  startedAt: TimestampSchema,
  updatedAt: TimestampSchema,
  currentIndex: z.number().int().nonnegative(),
  answers: z.array(ExamAnswerSchema),
  submittedAt: TimestampSchema.nullable(),
  correctCount: z.number().int().nonnegative().nullable(),
  totalCount: z.number().int().positive(),
  score: ScoreSchema.nullable(),
  passed: z.boolean().nullable(),
});
export type ExamAttempt = z.infer<typeof ExamAttemptSchema>;

/** A scored exam — derived from the questions and the answers, never stored as text. */
export const ExamScoreSchema = z.object({
  correctCount: z.number().int().nonnegative(),
  totalCount: z.number().int().positive(),
  unansweredCount: z.number().int().nonnegative(),
  score: ScoreSchema,
  passed: z.boolean(),
  isPerfect: z.boolean(),
});
export type ExamScore = z.infer<typeof ExamScoreSchema>;
