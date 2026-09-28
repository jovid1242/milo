import { z } from 'zod';

import { IdSchema } from './common';
import { GrammarExerciseSchema, GrammarRulePointSchema, choiceProblem } from './grammar';
import { ChoiceAnswerSchema, type ChoiceAnswer } from './practice';
import { ReadingQuestionSchema, ReadingStorySchema } from './reading';
import { VocabularyExerciseSchema, VocabularyItemSchema } from './vocabulary';

/** Which kind of material a review exercise comes back to. */
export const ReviewSourceSchema = z.enum(['vocabulary', 'grammar', 'reading']);
export type ReviewSource = z.infer<typeof ReviewSourceSchema>;

/**
 * One recap exercise. It refers to course material by id instead of copying
 * it — any material introduced on this day or before, so a review can come
 * back to Day 5's words on Day 8: vocabulary exercises name word ids
 * (`vocab-…`), grammar exercises the rule point they practise
 * (`grammar-….point`), reading questions the text they are about and, for a
 * quote, a paragraph and sentence of it.
 */
export const ReviewExerciseSchema = z.discriminatedUnion('source', [
  z.object({ source: z.literal('vocabulary'), exercise: VocabularyExerciseSchema }),
  z.object({ source: z.literal('grammar'), pointId: IdSchema, exercise: GrammarExerciseSchema }),
  z.object({
    source: z.literal('reading'),
    readingId: IdSchema,
    question: ReadingQuestionSchema,
    /**
     * A line of the text to set the scene — never the answer itself. Referenced
     * by paragraph and sentence (0-based), so the text is never copied.
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

/** The choice an exercise asks for, whatever its source. */
function reviewChoice(item: ReviewExercise) {
  return item.source === 'vocabulary'
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
}

const ReviewExercisesSchema = z
  .array(ReviewExerciseSchema)
  .min(4)
  .max(12)
  .superRefine((exercises, ctx) => {
    const ids = new Set<string>();
    exercises.forEach((item, index) => {
      const id = reviewExerciseId(item);
      const choice = reviewChoice(item);
      const problem = ids.has(id)
        ? 'exercise ids repeat'
        : new Set(choice.options).size !== choice.options.length
          ? 'options repeat'
          : !choice.options.includes(choice.correct)
            ? 'the answer is not among the options'
            : item.source === 'grammar'
              ? choiceProblem(item.exercise)
              : item.source === 'reading'
                ? choiceProblem(item.question)
                : null;
      ids.add(id);
      if (problem) ctx.addIssue({ code: 'custom', message: problem, path: [index] });
    });
  });

/**
 * The Review quest as the course stores it: exercises only, played in this
 * order — mixed on purpose, and the same on every resume. Whether each
 * reference exists (and was already taught) is checked course-wide.
 */
export const ReviewQuestDefinitionSchema = z.object({
  type: z.literal('review'),
  questId: IdSchema,
  exercises: ReviewExercisesSchema,
});
export type ReviewQuestDefinition = z.infer<typeof ReviewQuestDefinitionSchema>;

/** Everything a review's exercises refer to, resolved from the course. */
export const ReviewMaterialSchema = z.object({
  words: z.array(VocabularyItemSchema),
  points: z.array(GrammarRulePointSchema),
  readings: z.array(z.object({ id: IdSchema, story: ReadingStorySchema })),
});
export type ReviewMaterial = z.infer<typeof ReviewMaterialSchema>;

/**
 * One Review quest, ready to play: the exercises and the material they refer
 * to — self-sufficient, so a day can be played offline from its own content.
 */
export const ReviewQuestSchema = z
  .object({
    type: z.literal('review'),
    questId: IdSchema,
    exercises: ReviewExercisesSchema,
    material: ReviewMaterialSchema,
  })
  .superRefine((quest, ctx) => {
    const words = new Set(quest.material.words.map((word) => word.id));
    const points = new Set(quest.material.points.map((point) => point.id));
    const readings = new Set(quest.material.readings.map((reading) => reading.id));
    quest.exercises.forEach((item, index) => {
      const missing =
        item.source === 'vocabulary'
          ? [item.exercise.itemId, ...item.exercise.optionItemIds].find((id) => !words.has(id))
          : item.source === 'grammar'
            ? points.has(item.pointId)
              ? undefined
              : item.pointId
            : readings.has(item.readingId)
              ? undefined
              : item.readingId;
      if (missing) {
        ctx.addIssue({
          code: 'custom',
          message: `"${missing}" is not in the review's material`,
          path: ['exercises', index],
        });
      }
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
