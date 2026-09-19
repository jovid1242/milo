import type { RunStage } from '@/features/quests/hooks/use-quest-flow';
import {
  answersFit,
  nextPracticeStep,
  withAnswer,
  type ChoiceExercise,
} from '@/features/quests/logic/practice';
import {
  ReadingProgressSchema,
  type ReadingProgress,
  type ReadingQuest,
  type ReadingQuestion,
} from '@/schemas';

/**
 * The Reading quest as a small state machine:
 *
 *   intro → story (read at your pace; words can be looked up)
 *         → questions (shared choice logic, the story one tap away) → result
 *
 * Reading itself is never scored: only understanding is.
 */
export const INITIAL_READING: ReadingProgress = {
  phase: 'intro',
  paragraphIndex: 0,
  reachedEnd: false,
  openedWordIds: [],
  practiceIndex: 0,
  answers: [],
};

export type ReadingAction =
  | { type: 'start' }
  | { type: 'readTo'; paragraphIndex: number }
  | { type: 'reachEnd' }
  | { type: 'openWord'; wordId: string }
  | { type: 'finishReading' }
  | { type: 'answer'; optionId: string; at: string }
  | { type: 'continue' };

export function asChoice(question: ReadingQuestion): ChoiceExercise {
  return {
    id: question.id,
    correctOptionId: question.correctOptionId,
    optionIds: question.options.map((option) => option.id),
  };
}

export function currentQuestion(quest: ReadingQuest, state: ReadingProgress) {
  return state.phase === 'questions' ? (quest.questions[state.practiceIndex] ?? null) : null;
}

export function reduceReading(
  quest: ReadingQuest,
  state: ReadingProgress,
  action: ReadingAction,
): ReadingProgress {
  switch (action.type) {
    case 'start':
      return state.phase === 'intro' ? { ...state, phase: 'story' } : state;

    case 'readTo': {
      const index = Math.min(
        Math.max(0, Math.round(action.paragraphIndex)),
        quest.story.paragraphs.length - 1,
      );
      return state.phase === 'story' && index !== state.paragraphIndex
        ? { ...state, paragraphIndex: index }
        : state;
    }

    case 'reachEnd':
      return state.phase === 'story' && !state.reachedEnd ? { ...state, reachedEnd: true } : state;

    case 'openWord': {
      const known = quest.story.words.some((word) => word.id === action.wordId);
      return known && !state.openedWordIds.includes(action.wordId)
        ? { ...state, openedWordIds: [...state.openedWordIds, action.wordId] }
        : state;
    }

    case 'finishReading':
      // The button sits at the end of the story, so pressing it means the end was reached.
      return state.phase === 'story'
        ? { ...state, phase: 'questions', reachedEnd: true, practiceIndex: 0 }
        : state;

    case 'answer': {
      const question = currentQuestion(quest, state);
      return question ? withAnswer(state, asChoice(question), action.optionId, action.at) : state;
    }

    case 'continue': {
      const question = currentQuestion(quest, state);
      const next = nextPracticeStep(state, question && asChoice(question), quest.questions.length);
      if (next === null) return state;
      return next === 'done' ? { ...state, phase: 'result' } : { ...state, practiceIndex: next };
    }
  }
}

export function readingStage(state: ReadingProgress): RunStage {
  if (state.phase === 'intro') return 'intro';
  return state.phase === 'result' ? 'result' : 'playing';
}

/** Progress segments: the story, then each question. */
export function readingSteps(quest: ReadingQuest) {
  return { story: 1, questions: quest.questions.length };
}

export function readingStepsDone(quest: ReadingQuest, state: ReadingProgress): number {
  if (state.phase === 'result') return 1 + quest.questions.length;
  const storyDone = state.reachedEnd || state.phase === 'questions' ? 1 : 0;
  return storyDone + state.answers.length;
}

export function readingProgress(quest: ReadingQuest, state: ReadingProgress): number {
  return readingStepsDone(quest, state) / (1 + quest.questions.length);
}

/** Something the user would lose by leaving — then leaving asks first. */
export function hasReadingProgress(quest: ReadingQuest, state: ReadingProgress): boolean {
  return (
    readingStepsDone(quest, state) > 0 || state.paragraphIndex > 0 || state.openedWordIds.length > 0
  );
}

/**
 * Saved progress is untrusted: it may come from an older version of the
 * content. Anything that does not fit today's story starts over instead of crashing.
 */
export function restoreReading(quest: ReadingQuest, saved: unknown): ReadingProgress {
  const parsed = ReadingProgressSchema.safeParse(saved);
  if (!parsed.success) return INITIAL_READING;
  const state = parsed.data;

  const wordIds = new Set(quest.story.words.map((word) => word.id));
  const fits =
    state.paragraphIndex < quest.story.paragraphs.length &&
    state.openedWordIds.every((id) => wordIds.has(id)) &&
    answersFit(state.answers, quest.questions.map(asChoice), state.practiceIndex) &&
    (state.phase === 'questions' || state.phase === 'result' || state.answers.length === 0);
  return fits ? state : INITIAL_READING;
}
