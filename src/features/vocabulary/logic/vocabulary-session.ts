import {
  VocabularyProgressSchema,
  type AnswerRecord,
  type VocabularyAnswer,
  type VocabularyItem,
  type VocabularyProgress,
  type VocabularyQuest,
  type VocabularyResult,
} from '@/schemas';

/**
 * The Vocabulary quest as a small state machine:
 *
 *   intro → learn (one word at a time: word → reveal → "Got it")
 *         → practice (answer → feedback → continue)
 *         → result
 *
 * One reducer owns every transition, so the screen never juggles booleans and
 * the same state can be saved and restored as-is.
 */
export const INITIAL_PROGRESS: VocabularyProgress = {
  phase: 'intro',
  learnIndex: 0,
  revealed: false,
  learnedItemIds: [],
  practiceIndex: 0,
  answers: [],
};

export type VocabularyAction =
  | { type: 'start' }
  | { type: 'reveal' }
  | { type: 'learned' }
  | { type: 'answer'; optionItemId: string; at: string }
  | { type: 'continue' };

export function answerFor(state: VocabularyProgress, exerciseId: string): VocabularyAnswer | null {
  return state.answers.find((answer) => answer.exerciseId === exerciseId) ?? null;
}

export function reduceVocabulary(
  quest: VocabularyQuest,
  state: VocabularyProgress,
  action: VocabularyAction,
): VocabularyProgress {
  switch (action.type) {
    case 'start':
      return state.phase === 'intro'
        ? { ...state, phase: 'learn', learnIndex: 0, revealed: false }
        : state;

    case 'reveal':
      return state.phase === 'learn' ? { ...state, revealed: true } : state;

    case 'learned': {
      const item = state.phase === 'learn' ? quest.items[state.learnIndex] : undefined;
      if (!item) return state;
      const learnedItemIds = state.learnedItemIds.includes(item.id)
        ? state.learnedItemIds
        : [...state.learnedItemIds, item.id];
      const next = state.learnIndex + 1;
      return next < quest.items.length
        ? { ...state, learnedItemIds, learnIndex: next, revealed: false }
        : { ...state, learnedItemIds, phase: 'practice', practiceIndex: 0 };
    }

    case 'answer': {
      const exercise =
        state.phase === 'practice' ? quest.exercises[state.practiceIndex] : undefined;
      // An answer is final: tapping again (or another option) changes nothing.
      if (!exercise || answerFor(state, exercise.id)) return state;
      if (!exercise.optionItemIds.includes(action.optionItemId)) return state;
      const answer: VocabularyAnswer = {
        exerciseId: exercise.id,
        optionItemId: action.optionItemId,
        correct: action.optionItemId === exercise.itemId,
        answeredAt: action.at,
      };
      return { ...state, answers: [...state.answers, answer] };
    }

    case 'continue': {
      const exercise =
        state.phase === 'practice' ? quest.exercises[state.practiceIndex] : undefined;
      // No skipping: continue only moves on from an answered exercise.
      if (!exercise || !answerFor(state, exercise.id)) return state;
      const next = state.practiceIndex + 1;
      return next < quest.exercises.length
        ? { ...state, practiceIndex: next }
        : { ...state, phase: 'result' };
    }
  }
}

export function currentItem(quest: VocabularyQuest, state: VocabularyProgress) {
  return quest.items[state.learnIndex] ?? null;
}

export function currentExercise(quest: VocabularyQuest, state: VocabularyProgress) {
  return quest.exercises[state.practiceIndex] ?? null;
}

export function itemById(quest: VocabularyQuest, id: string): VocabularyItem {
  const item = quest.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown vocabulary item: ${id}`);
  return item;
}

/** Learned words plus answered exercises, over everything the quest asks for. */
export function progressFraction(quest: VocabularyQuest, state: VocabularyProgress): number {
  if (state.phase === 'result') return 1;
  const total = quest.items.length + quest.exercises.length;
  return (state.learnedItemIds.length + state.answers.length) / total;
}

/** Something the user would lose by leaving — then leaving asks first. */
export function hasProgress(state: VocabularyProgress): boolean {
  return state.revealed || state.learnedItemIds.length > 0 || state.answers.length > 0;
}

export function vocabularyResult(
  quest: VocabularyQuest,
  state: VocabularyProgress,
): VocabularyResult {
  const correctCount = state.answers.filter((answer) => answer.correct).length;
  const total = quest.exercises.length;
  return {
    correctCount,
    total,
    isPerfect: correctCount === total,
    wordsLearned: quest.items.map((item) => item.word),
  };
}

/** Answers in the shape the progress repository stores for every quest type. */
export function toAnswerRecords(
  questId: string,
  answers: readonly VocabularyAnswer[],
): AnswerRecord[] {
  return answers.map((answer) => ({
    questId,
    questionId: answer.exerciseId,
    answer: { kind: 'singleChoice', optionId: answer.optionItemId },
    isCorrect: answer.correct,
    answeredAt: answer.answeredAt,
  }));
}

/**
 * Saved progress is untrusted: it may be from an older version of the content.
 * Anything that does not fit today's quest starts over instead of crashing.
 */
export function restoreProgress(quest: VocabularyQuest, saved: unknown): VocabularyProgress {
  const parsed = VocabularyProgressSchema.safeParse(saved);
  if (!parsed.success) return INITIAL_PROGRESS;
  const state = parsed.data;

  const itemIds = new Set(quest.items.map((item) => item.id));
  const exercises = new Map(quest.exercises.map((exercise) => [exercise.id, exercise]));
  const fits =
    state.learnIndex < quest.items.length &&
    state.practiceIndex < quest.exercises.length &&
    state.learnedItemIds.every((id) => itemIds.has(id)) &&
    state.answers.length <= state.practiceIndex + 1 &&
    state.answers.every((answer) => {
      const exercise = exercises.get(answer.exerciseId);
      return exercise !== undefined && answer.correct === (answer.optionItemId === exercise.itemId);
    });
  return fits ? state : INITIAL_PROGRESS;
}
