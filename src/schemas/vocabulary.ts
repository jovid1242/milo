import { z } from 'zod';

import { IdSchema, TimestampSchema } from './common';

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

/**
 * Practice exercises reference today's items, so a backend only has to send
 * ids: the options are words from the same set and `itemId` is the answer.
 */
const choice = {
  id: IdSchema,
  /** The word this exercise checks — also the correct option. */
  itemId: IdSchema,
  optionItemIds: z.array(IdSchema).min(2).max(4),
};

export const VocabularyExerciseSchema = z.discriminatedUnion('kind', [
  /** English word → pick its translation. */
  z.object({ kind: z.literal('pickTranslation'), ...choice }),
  /** Translation → pick the English word. */
  z.object({ kind: z.literal('pickWord'), ...choice }),
  /** A sentence with a gap (`___`) → pick the word that fits. */
  z.object({ kind: z.literal('fillGap'), ...choice, sentence: z.string().includes('___') }),
]);
export type VocabularyExercise = z.infer<typeof VocabularyExerciseSchema>;
export type VocabularyExerciseKind = VocabularyExercise['kind'];

/** The authored content of one Vocabulary quest: words to learn, then practice. */
export const VocabularyQuestSchema = z
  .object({
    type: z.literal('vocabulary'),
    questId: IdSchema,
    items: z.array(VocabularyItemSchema).min(1),
    exercises: z.array(VocabularyExerciseSchema).min(1),
  })
  .superRefine((quest, ctx) => {
    const ids = new Set(quest.items.map((item) => item.id));
    quest.exercises.forEach((exercise, index) => {
      const options = new Set(exercise.optionItemIds);
      const problem = !ids.has(exercise.itemId)
        ? 'itemId is not one of the quest items'
        : exercise.optionItemIds.some((id) => !ids.has(id))
          ? 'an option is not one of the quest items'
          : !options.has(exercise.itemId)
            ? 'the answer is not among the options'
            : options.size !== exercise.optionItemIds.length
              ? 'options repeat'
              : null;
      if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['exercises', index] });
    });
  });
export type VocabularyQuest = z.infer<typeof VocabularyQuestSchema>;

/** One locked-in answer during practice. */
export const VocabularyAnswerSchema = z.object({
  exerciseId: IdSchema,
  optionItemId: IdSchema,
  correct: z.boolean(),
  answeredAt: TimestampSchema,
});
export type VocabularyAnswer = z.infer<typeof VocabularyAnswerSchema>;

export const VocabularyPhaseSchema = z.enum(['intro', 'learn', 'practice', 'result']);
export type VocabularyPhase = z.infer<typeof VocabularyPhaseSchema>;

/**
 * Where the user is inside the quest. Saved with the quest session, so closing
 * the quest or reloading the app resumes exactly here.
 */
export const VocabularyProgressSchema = z.object({
  phase: VocabularyPhaseSchema,
  /** The word being learned (learn phase). */
  learnIndex: z.number().int().nonnegative(),
  /** Whether the current word's meaning is shown. */
  revealed: z.boolean(),
  learnedItemIds: z.array(IdSchema),
  /** The exercise being answered (practice phase). */
  practiceIndex: z.number().int().nonnegative(),
  answers: z.array(VocabularyAnswerSchema),
});
export type VocabularyProgress = z.infer<typeof VocabularyProgressSchema>;

export const VocabularyResultSchema = z.object({
  correctCount: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  isPerfect: z.boolean(),
  wordsLearned: z.array(z.string().min(1)),
});
export type VocabularyResult = z.infer<typeof VocabularyResultSchema>;
