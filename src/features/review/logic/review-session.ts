import type { RunStage } from '@/features/quests/hooks/use-quest-flow';
import {
  answersFit,
  nextPracticeStep,
  scorePractice,
  withAnswer,
} from '@/features/quests/logic/practice';
import {
  ReviewProgressSchema,
  type ChoiceAnswer,
  type ReviewProgress,
  type ReviewResult,
  type ReviewSource,
} from '@/schemas';

import type { ReviewItem } from './review-items';

/**
 * The Review quest as a small state machine:
 *
 *   intro → mixed practice (shared choice logic) → result
 *
 * No new material: every exercise comes back to something learned today.
 */
export const INITIAL_REVIEW: ReviewProgress = { phase: 'intro', practiceIndex: 0, answers: [] };

export type ReviewAction =
  { type: 'start' } | { type: 'answer'; optionId: string; at: string } | { type: 'continue' };

export function currentItem(items: readonly ReviewItem[], state: ReviewProgress) {
  return state.phase === 'practice' ? (items[state.practiceIndex] ?? null) : null;
}

export function reduceReview(
  items: readonly ReviewItem[],
  state: ReviewProgress,
  action: ReviewAction,
): ReviewProgress {
  switch (action.type) {
    case 'start':
      return state.phase === 'intro' ? { ...state, phase: 'practice', practiceIndex: 0 } : state;

    case 'answer': {
      const item = currentItem(items, state);
      return item ? withAnswer(state, item.choice, action.optionId, action.at) : state;
    }

    case 'continue': {
      const item = currentItem(items, state);
      const next = nextPracticeStep(state, item && item.choice, items.length);
      if (next === null) return state;
      return next === 'done' ? { ...state, phase: 'result' } : { ...state, practiceIndex: next };
    }
  }
}

export function reviewStage(state: ReviewProgress): RunStage {
  if (state.phase === 'intro') return 'intro';
  return state.phase === 'result' ? 'result' : 'playing';
}

export function reviewStepsDone(items: readonly ReviewItem[], state: ReviewProgress): number {
  return state.phase === 'result' ? items.length : state.answers.length;
}

export function reviewProgress(items: readonly ReviewItem[], state: ReviewProgress): number {
  return items.length > 0 ? reviewStepsDone(items, state) / items.length : 0;
}

/** Something the user would lose by leaving — then leaving asks first. */
export function hasReviewProgress(state: ReviewProgress): boolean {
  return state.answers.length > 0;
}

/** The score, and how each of today's quests held up. */
export function scoreReview(
  items: readonly ReviewItem[],
  answers: readonly ChoiceAnswer[],
): ReviewResult {
  const score = scorePractice(answers, items.length);
  const bySource: ReviewResult['bySource'] = {
    vocabulary: { correct: 0, total: 0 },
    grammar: { correct: 0, total: 0 },
    reading: { correct: 0, total: 0 },
  };
  for (const item of items) {
    const tally = bySource[item.source];
    tally.total++;
    if (answers.some((answer) => answer.exerciseId === item.id && answer.correct)) tally.correct++;
  }
  return {
    correctCount: score.correctCount,
    total: Math.max(1, score.total),
    isPerfect: score.isPerfect,
    bySource,
  };
}

/** The sources in the order they first appear — for the result's breakdown. */
export function reviewSources(items: readonly ReviewItem[]): ReviewSource[] {
  return [...new Set(items.map((item) => item.source))];
}

/**
 * Saved progress is untrusted: it may come from an older version of the
 * content. Anything that does not fit today's review starts over instead of crashing.
 */
export function restoreReview(items: readonly ReviewItem[], saved: unknown): ReviewProgress {
  const parsed = ReviewProgressSchema.safeParse(saved);
  if (!parsed.success) return INITIAL_REVIEW;
  const state = parsed.data;

  const fits =
    answersFit(
      state.answers,
      items.map((item) => item.choice),
      state.practiceIndex,
    ) &&
    (state.phase !== 'intro' || state.answers.length === 0) &&
    (state.phase !== 'result' || state.answers.length === items.length);
  return fits ? state : INITIAL_REVIEW;
}
