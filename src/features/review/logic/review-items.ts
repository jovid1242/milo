import {
  describeGrammarExercise,
  type GrammarExerciseView,
} from '@/features/grammar/logic/exercise-view';
import { asChoice as grammarChoice } from '@/features/grammar/logic/grammar-session';
import type { ChoiceExercise } from '@/features/quests/logic/practice';
import { describeReadingQuestion } from '@/features/reading/logic/question-view';
import { asChoice as readingChoice } from '@/features/reading/logic/reading-session';
import { storySentence } from '@/features/reading/logic/story-text';
import { describeExercise, type ExerciseView } from '@/features/vocabulary/logic/exercise-view';
import { asChoice as vocabularyChoice } from '@/features/vocabulary/logic/vocabulary-session';
import type { ReviewExercise, ReviewQuest, ReviewSource } from '@/schemas';

type ReviewItemBase = {
  id: string;
  choice: ChoiceExercise;
  /** Small instruction next to the source label. */
  instruction: string;
  options: { id: string; label: string }[];
  feedback: { correct: string; wrong: string };
};

/** A review exercise ready to show, its references resolved against today's quests. */
export type ReviewItem = ReviewItemBase &
  (
    | { source: 'vocabulary'; view: ExerciseView }
    | { source: 'grammar'; view: GrammarExerciseView }
    | { source: 'reading'; question: string; snippet: string | null }
  );

export const SOURCE_LABELS: Record<ReviewSource, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  reading: 'Reading',
};

function resolveItem(
  exercise: ReviewExercise,
  material: ReviewQuest['material'],
): ReviewItem | null {
  switch (exercise.source) {
    case 'vocabulary': {
      const words = { items: material.words };
      const ids = [exercise.exercise.itemId, ...exercise.exercise.optionItemIds];
      if (!ids.every((id) => material.words.some((word) => word.id === id))) return null;
      const view = describeExercise(words, exercise.exercise);
      return {
        source: 'vocabulary',
        id: exercise.exercise.id,
        choice: vocabularyChoice(exercise.exercise),
        instruction: view.instruction,
        options: view.options,
        feedback: view.feedback,
        view,
      };
    }
    case 'grammar': {
      // It has to practise a point the course actually taught.
      if (!material.points.some((point) => point.id === exercise.pointId)) return null;
      const view = describeGrammarExercise(exercise.exercise);
      return {
        source: 'grammar',
        id: exercise.exercise.id,
        choice: grammarChoice(exercise.exercise),
        instruction: view.instruction,
        options: view.options,
        feedback: view.feedback,
        view,
      };
    }
    case 'reading': {
      const story = material.readings.find((reading) => reading.id === exercise.readingId)?.story;
      if (!story) return null;
      const view = describeReadingQuestion(exercise.question);
      return {
        source: 'reading',
        id: exercise.question.id,
        choice: readingChoice(exercise.question),
        instruction: view.instruction,
        options: view.options,
        feedback: view.feedback,
        question: exercise.question.question,
        // A reference that no longer fits the story only loses the quote.
        snippet: exercise.snippet
          ? storySentence(story, exercise.snippet.paragraphId, exercise.snippet.sentence)
          : null,
      };
    }
  }
}

/**
 * The review's exercises in their authored (mixed) order, resolved against
 * the material the review carries — today's and earlier days'. An exercise
 * whose material is missing is left out rather than shown half-broken.
 */
export function resolveReview(review: ReviewQuest): ReviewItem[] {
  return review.exercises
    .map((exercise) => resolveItem(exercise, review.material))
    .filter((item): item is ReviewItem => item !== null);
}
