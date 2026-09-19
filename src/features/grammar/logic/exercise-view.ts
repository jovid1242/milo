import type { GrammarExercise, GrammarExerciseKind } from '@/schemas';

/** What a grammar exercise shows. The explanation always comes from the exercise itself. */
export type GrammarExerciseView = {
  instruction: string;
  /** Gap exercises: the sentence around the gap. */
  gap: { before: string; after: string } | null;
  /** Sentence exercises: the question above the options. */
  question: string | null;
  options: { id: string; label: string }[];
  /** How the right answer reads, for the gap once answered. */
  answerLabel: string;
  feedback: { correct: string; wrong: string };
};

const INSTRUCTIONS: Record<GrammarExerciseKind, string> = {
  choose: 'Choose the right form',
  complete: 'Complete the sentence',
  spotCorrect: 'Spot the correct sentence',
  meaning: 'Think about the meaning',
};

export function describeGrammarExercise(exercise: GrammarExercise): GrammarExerciseView {
  const options = exercise.options.map((option) => ({ id: option.id, label: option.text }));
  const answerLabel =
    exercise.options.find((option) => option.id === exercise.correctOptionId)?.text ?? '';
  const hasGap = exercise.kind === 'choose' || exercise.kind === 'complete';
  const [before = '', after = ''] = hasGap ? exercise.sentence.split('___') : [];

  return {
    instruction: INSTRUCTIONS[exercise.kind],
    gap: hasGap ? { before, after } : null,
    question: hasGap ? null : exercise.question,
    options,
    answerLabel,
    // Right or wrong, the user learns why. A miss on a gap also names the
    // answer; for sentence options the right one is already marked in the list.
    feedback: {
      correct: exercise.explanation,
      wrong: hasGap ? `It's “${answerLabel}”. ${exercise.explanation}` : exercise.explanation,
    },
  };
}
