import type { RunStage } from '@/features/quests/hooks/use-quest-flow';
import {
  answersFit,
  nextPracticeStep,
  withAnswer,
  type ChoiceExercise,
} from '@/features/quests/logic/practice';
import {
  GrammarProgressSchema,
  type GrammarExercise,
  type GrammarProgress,
  type GrammarQuest,
  type GrammarRulePoint,
} from '@/schemas';

/**
 * The Grammar quest as a small state machine:
 *
 *   intro → rule → guided examples (sentence → "Show why" → next)
 *         → practice (shared choice logic) → result
 *
 * Guided examples are for understanding and are never scored.
 */
export const INITIAL_GRAMMAR: GrammarProgress = {
  phase: 'intro',
  exampleIndex: 0,
  exampleRevealed: false,
  practiceIndex: 0,
  answers: [],
};

export type GrammarAction =
  | { type: 'start' }
  | { type: 'ruleLearned' }
  | { type: 'revealExample' }
  | { type: 'nextExample' }
  | { type: 'answer'; optionId: string; at: string }
  | { type: 'continue' };

export function asChoice(exercise: GrammarExercise): ChoiceExercise {
  return {
    id: exercise.id,
    correctOptionId: exercise.correctOptionId,
    optionIds: exercise.options.map((option) => option.id),
  };
}

export function currentExample(quest: GrammarQuest, state: GrammarProgress) {
  return state.phase === 'examples' ? (quest.examples[state.exampleIndex] ?? null) : null;
}

export function currentExercise(quest: GrammarQuest, state: GrammarProgress) {
  return state.phase === 'practice' ? (quest.exercises[state.practiceIndex] ?? null) : null;
}

export function pointById(quest: GrammarQuest, id: string): GrammarRulePoint | null {
  return quest.rule.points.find((point) => point.id === id) ?? null;
}

export function reduceGrammar(
  quest: GrammarQuest,
  state: GrammarProgress,
  action: GrammarAction,
): GrammarProgress {
  switch (action.type) {
    case 'start':
      return state.phase === 'intro' ? { ...state, phase: 'rule' } : state;

    case 'ruleLearned':
      return state.phase === 'rule'
        ? { ...state, phase: 'examples', exampleIndex: 0, exampleRevealed: false }
        : state;

    case 'revealExample':
      return state.phase === 'examples' ? { ...state, exampleRevealed: true } : state;

    case 'nextExample': {
      // Only past an explained example: a double tap cannot skip the next one.
      if (state.phase !== 'examples' || !state.exampleRevealed) return state;
      const next = state.exampleIndex + 1;
      return next < quest.examples.length
        ? { ...state, exampleIndex: next, exampleRevealed: false }
        : { ...state, phase: 'practice', practiceIndex: 0 };
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

export function grammarStage(state: GrammarProgress): RunStage {
  if (state.phase === 'intro') return 'intro';
  return state.phase === 'result' ? 'result' : 'playing';
}

/** Progress segments: learning (the rule and each example), then practice. */
export function grammarSteps(quest: GrammarQuest) {
  return { learn: 1 + quest.examples.length, practice: quest.exercises.length };
}

export function grammarStepsDone(quest: GrammarQuest, state: GrammarProgress): number {
  const { learn, practice } = grammarSteps(quest);
  switch (state.phase) {
    case 'intro':
    case 'rule':
      return 0;
    case 'examples':
      return 1 + state.exampleIndex + (state.exampleRevealed ? 1 : 0);
    case 'practice':
      return learn + state.answers.length;
    case 'result':
      return learn + practice;
  }
}

export function grammarProgress(quest: GrammarQuest, state: GrammarProgress): number {
  const { learn, practice } = grammarSteps(quest);
  return grammarStepsDone(quest, state) / (learn + practice);
}

/** Something the user would lose by leaving — then leaving asks first. */
export function hasGrammarProgress(quest: GrammarQuest, state: GrammarProgress): boolean {
  return grammarStepsDone(quest, state) > 0;
}

/**
 * Saved progress is untrusted: it may come from an older version of the
 * content. Anything that does not fit today's quest starts over instead of crashing.
 */
export function restoreGrammar(quest: GrammarQuest, saved: unknown): GrammarProgress {
  const parsed = GrammarProgressSchema.safeParse(saved);
  if (!parsed.success) return INITIAL_GRAMMAR;
  const state = parsed.data;

  const fits =
    state.exampleIndex < quest.examples.length &&
    answersFit(state.answers, quest.exercises.map(asChoice), state.practiceIndex) &&
    (state.phase === 'practice' || state.phase === 'result' || state.answers.length === 0);
  return fits ? state : INITIAL_GRAMMAR;
}
