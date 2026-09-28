import { z } from 'zod';

import { CefrLevelSchema, IdSchema } from './common';
import { ChoiceAnswerSchema, type ChoiceAnswer } from './practice';

/**
 * One word of the course's vocabulary bank — the same model the Vocabulary
 * quest shows. Learned-word progress is stored by `id` (`vocab-<lemma>`),
 * never by the word's text, so fixing a typo in `word` changes no progress.
 */
export const VocabularyItemSchema = z.object({
  id: IdSchema,
  word: z.string().min(1),
  /** Pronunciation as text, e.g. "/ˈdʒɜːrni/". */
  phonetic: z.string().optional(),
  partOfSpeech: z.enum(['noun', 'verb', 'adjective', 'adverb', 'phrase']),
  /** Plain-English definition. */
  definition: z.string().min(1),
  /** Meaning in the course's support language (`Course.supportLanguage`). */
  translation: z.string().min(1),
  example: z.string().min(1),
  level: CefrLevelSchema.optional(),
  /** Free topics for search and future grouping: "travel", "study". */
  tags: z.array(z.string().min(1)).max(8).optional(),
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
  /** Plain-English definition → pick the word (recall without the translation). */
  z.object({ kind: z.literal('pickWordByDefinition'), ...choice }),
  /** A sentence with a gap (`___`) → pick the word that fits. */
  z.object({ kind: z.literal('fillGap'), ...choice, sentence: z.string().includes('___') }),
]);
export type VocabularyExercise = z.infer<typeof VocabularyExerciseSchema>;
export type VocabularyExerciseKind = VocabularyExercise['kind'];

/**
 * Practice checks only the quest's own words: the answer and every option
 * are among them, the answer is an option, and no option repeats.
 */
export function checkVocabularyPractice(
  wordIds: readonly string[],
  exercises: readonly VocabularyExercise[],
  ctx: z.RefinementCtx,
) {
  const ids = new Set(wordIds);
  if (ids.size !== wordIds.length) {
    ctx.addIssue({ code: 'custom', message: 'words repeat', path: ['wordIds'] });
  }
  const exerciseIds = new Set<string>();
  exercises.forEach((exercise, index) => {
    const options = new Set(exercise.optionItemIds);
    const problem = exerciseIds.has(exercise.id)
      ? 'exercise ids repeat'
      : !ids.has(exercise.itemId)
        ? 'itemId is not one of the quest words'
        : exercise.optionItemIds.some((id) => !ids.has(id))
          ? 'an option is not one of the quest words'
          : !options.has(exercise.itemId)
            ? 'the answer is not among the options'
            : options.size !== exercise.optionItemIds.length
              ? 'options repeat'
              : null;
    exerciseIds.add(exercise.id);
    if (problem) ctx.addIssue({ code: 'custom', message: problem, path: ['exercises', index] });
  });
}

/**
 * The Vocabulary quest as the course stores it: the words it teaches, by id
 * from the vocabulary bank, and the practice over them.
 */
export const VocabularyQuestDefinitionSchema = z
  .object({
    type: z.literal('vocabulary'),
    questId: IdSchema,
    wordIds: z.array(IdSchema).min(1).max(12),
    exercises: z.array(VocabularyExerciseSchema).min(1),
  })
  .superRefine((quest, ctx) => checkVocabularyPractice(quest.wordIds, quest.exercises, ctx));
export type VocabularyQuestDefinition = z.infer<typeof VocabularyQuestDefinitionSchema>;

/** One Vocabulary quest, ready to play: the words themselves, then practice. */
export const VocabularyQuestSchema = z
  .object({
    type: z.literal('vocabulary'),
    questId: IdSchema,
    items: z.array(VocabularyItemSchema).min(1),
    exercises: z.array(VocabularyExerciseSchema).min(1),
  })
  .superRefine((quest, ctx) =>
    checkVocabularyPractice(
      quest.items.map((item) => item.id),
      quest.exercises,
      ctx,
    ),
  );
export type VocabularyQuest = z.infer<typeof VocabularyQuestSchema>;

/** One locked-in answer during practice; the option id is the chosen item's id. */
export const VocabularyAnswerSchema = ChoiceAnswerSchema;
export type VocabularyAnswer = ChoiceAnswer;

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
