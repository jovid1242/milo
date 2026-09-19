import type { RunStage } from '@/features/quests/hooks/use-quest-flow';
import {
  answersFit,
  nextPracticeStep,
  withAnswer,
  type ChoiceExercise,
} from '@/features/quests/logic/practice';
import {
  VocabularyProgressSchema,
  type VocabularyExercise,
  type VocabularyItem,
  type VocabularyProgress,
  type VocabularyQuest,
} from '@/schemas';

/**
 * The Vocabulary quest as a small state machine:
 *
 *   intro → learn (one word at a time: word → reveal → "Got it")
 *         → practice (shared choice logic) → result
 *
 * One reducer owns every transition, so the screen never juggles booleans and
 * the same state is saved and restored as-is.
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
  | { type: 'answer'; optionId: string; at: string }
  | { type: 'continue' };

/** Vocabulary exercises in the shared shape: the options are item ids. */
export function asChoice(exercise: VocabularyExercise): ChoiceExercise {
  return { id: exercise.id, correctOptionId: exercise.itemId, optionIds: exercise.optionItemIds };
}

export function currentItem(quest: VocabularyQuest, state: VocabularyProgress) {
  return quest.items[state.learnIndex] ?? null;
}

export function currentExercise(quest: VocabularyQuest, state: VocabularyProgress) {
  return state.phase === 'practice' ? (quest.exercises[state.practiceIndex] ?? null) : null;
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
      // Only a word whose meaning was seen: a double tap cannot skip the next word.
      const item = state.phase === 'learn' && state.revealed ? currentItem(quest, state) : null;
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
      const exercise = currentExercise(quest, state);
      return exercise ? withAnswer(state, asChoice(exercise), action.optionId, action.at) : state;
    }

    case 'continue': {
      const exercise = currentExercise(quest, state);
      const next = nextPracticeStep(state, exercise && asChoice(exercise), quest.exercises.length);
      if (next === null) return state;
      return next === 'done' ? { ...state, phase: 'result' } : { ...state, practiceIndex: next };
    }
  }
}

export function vocabularyStage(state: VocabularyProgress): RunStage {
  if (state.phase === 'intro') return 'intro';
  return state.phase === 'result' ? 'result' : 'playing';
}

export function itemById(quest: VocabularyQuest, id: string): VocabularyItem {
  const item = quest.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown vocabulary item: ${id}`);
  return item;
}

/** Steps done — learned words plus answered exercises — for the progress bar. */
export function vocabularyStepsDone(quest: VocabularyQuest, state: VocabularyProgress): number {
  if (state.phase === 'result') return quest.items.length + quest.exercises.length;
  return state.learnedItemIds.length + state.answers.length;
}

export function progressFraction(quest: VocabularyQuest, state: VocabularyProgress): number {
  return vocabularyStepsDone(quest, state) / (quest.items.length + quest.exercises.length);
}

/** Something the user would lose by leaving — then leaving asks first. */
export function hasProgress(state: VocabularyProgress): boolean {
  return state.revealed || state.learnedItemIds.length > 0 || state.answers.length > 0;
}

/**
 * Saved progress is untrusted: it may come from an older version of the
 * content. Anything that does not fit today's quest starts over instead of crashing.
 */
export function restoreProgress(quest: VocabularyQuest, saved: unknown): VocabularyProgress {
  const parsed = VocabularyProgressSchema.safeParse(saved);
  if (!parsed.success) return INITIAL_PROGRESS;
  const state = parsed.data;

  const itemIds = new Set(quest.items.map((item) => item.id));
  const fits =
    state.learnIndex < quest.items.length &&
    state.learnedItemIds.every((id) => itemIds.has(id)) &&
    answersFit(state.answers, quest.exercises.map(asChoice), state.practiceIndex);
  return fits ? state : INITIAL_PROGRESS;
}
