import type { VocabularyExercise, VocabularyQuest } from '@/schemas';

import { itemById } from './vocabulary-session';

/** What an exercise shows: derived from the item ids, so content stays pure data. */
export type ExerciseView = {
  /** Small instruction above the prompt. */
  instruction: string;
  /** Word or translation to recognise; `null` for sentence exercises. */
  prompt: string | null;
  /** Sentence around the gap (fill-the-gap exercises). */
  sentence: { before: string; after: string } | null;
  options: { itemId: string; label: string }[];
  /** How the right answer reads, for the feedback line. */
  answerLabel: string;
  /** "achievement — достижение": the pair to remember after answering. */
  pair: string;
};

export function describeExercise(
  quest: VocabularyQuest,
  exercise: VocabularyExercise,
): ExerciseView {
  const item = itemById(quest, exercise.itemId);
  const pair = `${item.word} — ${item.translation}`;
  const labelFor = (id: string) => {
    const option = itemById(quest, id);
    return exercise.kind === 'pickTranslation' ? option.translation : option.word;
  };
  const options = exercise.optionItemIds.map((itemId) => ({ itemId, label: labelFor(itemId) }));

  switch (exercise.kind) {
    case 'pickTranslation':
      return {
        instruction: 'What does it mean?',
        prompt: item.word,
        sentence: null,
        options,
        answerLabel: item.translation,
        pair,
      };
    case 'pickWord':
      return {
        instruction: 'Which word is it?',
        prompt: item.translation,
        sentence: null,
        options,
        answerLabel: item.word,
        pair,
      };
    case 'fillGap': {
      const [before = '', after = ''] = exercise.sentence.split('___');
      return {
        instruction: 'Complete the sentence',
        prompt: null,
        sentence: { before, after },
        options,
        answerLabel: item.word,
        pair,
      };
    }
  }
}
