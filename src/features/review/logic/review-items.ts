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
import type {
  GrammarQuest,
  QuestContent,
  ReadingQuest,
  ReviewExercise,
  ReviewQuest,
  ReviewSource,
  VocabularyQuest,
} from '@/schemas';

/** Today's quests a review draws on. A missing one simply contributes nothing. */
export type ReviewMaterial = {
  vocabulary: VocabularyQuest | null;
  grammar: GrammarQuest | null;
  reading: ReadingQuest | null;
};

/** Picks the review's source quests out of loaded content. */
export function reviewMaterial(review: ReviewQuest, contents: readonly QuestContent[]) {
  const find = <T extends QuestContent['type']>(type: T, questId: string | undefined) =>
    (contents.find((content) => content.type === type && content.questId === questId) ??
      null) as Extract<QuestContent, { type: T }> | null;
  return {
    vocabulary: find('vocabulary', review.sources.vocabulary),
    grammar: find('grammar', review.sources.grammar),
    reading: find('reading', review.sources.reading),
  } satisfies ReviewMaterial;
}

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

function resolveItem(exercise: ReviewExercise, material: ReviewMaterial): ReviewItem | null {
  switch (exercise.source) {
    case 'vocabulary': {
      const quest = material.vocabulary;
      const ids = [exercise.exercise.itemId, ...exercise.exercise.optionItemIds];
      if (!quest || !ids.every((id) => quest.items.some((item) => item.id === id))) return null;
      const view = describeExercise(quest, exercise.exercise);
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
      // It has to practise a point that today's rule actually taught.
      const points = material.grammar?.rule.points ?? [];
      if (!points.some((point) => point.id === exercise.pointId)) return null;
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
      const story = material.reading?.story;
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
 * The review's exercises in their authored (mixed) order. An exercise whose
 * source material is missing is left out rather than shown half-broken.
 */
export function resolveReview(review: ReviewQuest, material: ReviewMaterial): ReviewItem[] {
  return review.exercises
    .map((exercise) => resolveItem(exercise, material))
    .filter((item): item is ReviewItem => item !== null);
}
