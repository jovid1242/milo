import { z } from 'zod';

import { IdSchema } from './common';
import { GrammarExerciseSchema } from './grammar';
import { ChoiceAnswerSchema, type ChoiceAnswer } from './practice';
import { ReadingQuestionSchema } from './reading';
import { VocabularyExerciseSchema } from './vocabulary';

/** Which of today's quests a review exercise comes back to. */
export const ReviewSourceSchema = z.enum(['vocabulary', 'grammar', 'reading']);
export type ReviewSource = z.infer<typeof ReviewSourceSchema>;

/**
 * One recap exercise. It refers to today's material instead of copying it:
 * vocabulary exercises name the day's word ids (words, translations and
 * definitions are read from the Vocabulary quest), grammar exercises name the
 * rule point they practise, reading questions may quote the story by paragraph.
 */
export const ReviewExerciseSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('vocabulary'), exercise: VocabularyExerciseSchema }),
  z.object({ source: z.literal('grammar'), pointId: IdSchema, exercise: GrammarExerciseSchema }),
  z.object({
    source: z.literal('reading'),
    question: ReadingQuestionSchema,
    /**
     * A line of the story to set the scene — never the answer itself. Referenced
     * by paragraph and sentence (0-based), so the story is never copied.
     */
    snippet: z
      .object({ paragraphId: IdSchema, sentence: z.number().int().nonnegative() })
      .optional(),
  }),
]);
export type ReviewExercise = z.infer<typeof ReviewExerciseSchema>;

export function reviewExerciseId(item: ReviewExercise): string {
  return item.source === 'reading' ? item.question.id : item.exercise.id;
}

/** The authored content of one Review quest — what a backend would send. */
export const ReviewQuestSchema = z
  .object({
    type: z.literal('review'),
    questId: IdSchema,
    /** Today's quests the material comes from. */
    sources: z.object({
      vocabulary: IdSchema.optional(),
      grammar: IdSchema.optional(),
      reading: IdSchema.optional(),
    }),
    /** Played in this order — mixed on purpose, and the same on every resume. */
    exercises: z.array(ReviewExerciseSchema).min(4).max(12),
  })
  .superRefine((quest, ctx) => {
    const ids = new Set<string>();
    quest.exercises.forEach((item, index) => {
      const id = reviewExerciseId(item);
      const choice =
        item.source === 'vocabulary'
          ? { options: item.exercise.optionItemIds, correct: item.exercise.itemId }
          : item.source === 'grammar'
            ? {
                options: item.exercise.options.map((option) => option.id),
                correct: item.exercise.correctOptionId,
              }
            : {
                options: item.question.options.map((option) => option.id),
                correct: item.question.correctOptionId,
              };
      const problem = ids.has(id)
        ? 'exercise ids repeat'
        : !quest.sources[item.source]
          ? `no ${item.source} source quest for this exercise`
          : new Set(choice.options).size !== choice.options.length
            ? 'options repeat'
            : !choice.options.includes(choice.correct)
              ? 'the answer is not among the options'
              : null;
      ids.add(id);
      if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['exercises', index] });
    });
  });
export type ReviewQuest = z.infer<typeof ReviewQuestSchema>;

/** One locked-in review answer. */
export const ReviewAnswerSchema = ChoiceAnswerSchema;
export type ReviewAnswer = ChoiceAnswer;

export const ReviewPhaseSchema = z.enum(['intro', 'practice', 'result']);
export type ReviewPhase = z.infer<typeof ReviewPhaseSchema>;

/** Where the user is inside the review; saved with the quest session. */
export const ReviewProgressSchema = z.object({
  phase: ReviewPhaseSchema,
  practiceIndex: z.number().int().nonnegative(),
  answers: z.array(ReviewAnswerSchema),
});
export type ReviewProgress = z.infer<typeof ReviewProgressSchema>;

const SourceScoreSchema = z.object({
  correct: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const ReviewResultSchema = z.object({
  correctCount: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  isPerfect: z.boolean(),
  bySource: z.object({
    vocabulary: SourceScoreSchema,
    grammar: SourceScoreSchema,
    reading: SourceScoreSchema,
  }),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;
