import type { AnswerRecord, ChoiceAnswer } from '@/schemas';

/**
 * Practice logic shared by every quest type: choose an option, the first
 * answer is locked in, continue only from an answered exercise, score at the end.
 */

/** What the shared logic needs to know about any choice exercise. */
export type ChoiceExercise = {
  id: string;
  correctOptionId: string;
  optionIds: readonly string[];
};

export type PracticeState = {
  practiceIndex: number;
  answers: ChoiceAnswer[];
};

export type PracticeScore = { correctCount: number; total: number; isPerfect: boolean };

export function answerFor(
  answers: readonly ChoiceAnswer[],
  exerciseId: string,
): ChoiceAnswer | null {
  return answers.find((answer) => answer.exerciseId === exerciseId) ?? null;
}

/** Locks in the first answer. A second tap, or an unknown option, changes nothing. */
export function withAnswer<S extends PracticeState>(
  state: S,
  exercise: ChoiceExercise,
  optionId: string,
  at: string,
): S {
  if (answerFor(state.answers, exercise.id) || !exercise.optionIds.includes(optionId)) return state;
  const answer: ChoiceAnswer = {
    exerciseId: exercise.id,
    optionId,
    correct: optionId === exercise.correctOptionId,
    answeredAt: at,
  };
  return { ...state, answers: [...state.answers, answer] };
}

/**
 * Where "Continue" leads from the current exercise: the next index, `'done'`
 * after the last one, or `null` while it is unanswered (no skipping).
 */
export function nextPracticeStep(
  state: PracticeState,
  exercise: ChoiceExercise | null,
  exerciseCount: number,
): number | 'done' | null {
  if (!exercise || !answerFor(state.answers, exercise.id)) return null;
  const next = state.practiceIndex + 1;
  return next < exerciseCount ? next : 'done';
}

export function scorePractice(answers: readonly ChoiceAnswer[], total: number): PracticeScore {
  const correctCount = answers.filter((answer) => answer.correct).length;
  return { correctCount, total, isPerfect: total > 0 && correctCount === total };
}

/** Answers in the shape the progress repository keeps for every quest type. */
export function toAnswerRecords(questId: string, answers: readonly ChoiceAnswer[]): AnswerRecord[] {
  return answers.map((answer) => ({
    questId,
    questionId: answer.exerciseId,
    answer: { kind: 'singleChoice', optionId: answer.optionId },
    isCorrect: answer.correct,
    answeredAt: answer.answeredAt,
  }));
}

/**
 * Saved answers still match the exercises (content can change between app
 * versions): each belongs to a known exercise, is scored the same way, and
 * none is ahead of the saved position.
 */
export function answersFit(
  answers: readonly ChoiceAnswer[],
  exercises: readonly ChoiceExercise[],
  practiceIndex: number,
): boolean {
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  return (
    practiceIndex < Math.max(exercises.length, 1) &&
    answers.length <= practiceIndex + 1 &&
    new Set(answers.map((answer) => answer.exerciseId)).size === answers.length &&
    answers.every((answer) => {
      const exercise = byId.get(answer.exerciseId);
      return (
        exercise !== undefined &&
        exercise.optionIds.includes(answer.optionId) &&
        answer.correct === (answer.optionId === exercise.correctOptionId)
      );
    })
  );
}
