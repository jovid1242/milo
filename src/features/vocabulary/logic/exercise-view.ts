import type { VocabularyExercise, VocabularyQuest } from '@/schemas';

import { itemById } from './vocabulary-session';

/** What the prompt is, so it gets the right type: a word, Cyrillic, or a phrase. */
export type VocabularyPromptKind = 'word' | 'translation' | 'definition';

/** What an exercise shows — derived from item ids, so content stays pure data. */
export type ExerciseView = {
  /** Small instruction above the prompt. */
  instruction: string;
  /** Word, translation or definition to recognise; `null` for sentence exercises. */
  prompt: { kind: VocabularyPromptKind; text: string } | null;
  /** Sentence around the gap (fill-the-gap exercises). */
  sentence: { before: string; after: string } | null;
  options: { id: string; label: string }[];
  /** How the right answer reads, for the gap and the feedback line. */
  answerLabel: string;
  feedback: { correct: string; wrong: string };
};

export function describeExercise(
  quest: VocabularyQuest,
  exercise: VocabularyExercise,
): ExerciseView {
  const item = itemById(quest, exercise.itemId);
  const byTranslation = exercise.kind === 'pickTranslation';
  const options = exercise.optionItemIds.map((id) => {
    const option = itemById(quest, id);
    return { id, label: byTranslation ? option.translation : option.word };
  });
  const answerLabel = byTranslation ? item.translation : item.word;
  const base = {
    options,
    answerLabel,
    // A right answer shows the pair to remember; a miss names the right answer.
    feedback: {
      correct: `${item.word} — ${item.translation}`,
      wrong: `The answer is “${answerLabel}”.`,
    },
  };

  switch (exercise.kind) {
    case 'pickTranslation':
      return {
        ...base,
        instruction: 'What does it mean?',
        prompt: { kind: 'word', text: item.word },
        sentence: null,
      };
    case 'pickWord':
      return {
        ...base,
        instruction: 'Which word is it?',
        prompt: { kind: 'translation', text: item.translation },
        sentence: null,
      };
    case 'pickWordByDefinition':
      return {
        ...base,
        instruction: 'Which word means this?',
        prompt: { kind: 'definition', text: item.definition },
        sentence: null,
      };
    case 'fillGap': {
      const [before = '', after = ''] = exercise.sentence.split('___');
      return {
        ...base,
        instruction: 'Complete the sentence',
        prompt: null,
        sentence: { before, after },
      };
    }
  }
}
