import type { QuestContent } from '@/schemas';

import { questId } from '../schedule';

/**
 * Day 89, the day before the summit: six B1 words about what the whole journey
 * was about — effort, progress and the confidence it brings.
 */
export const DAY_089: readonly QuestContent[] = [
  {
    type: 'vocabulary',
    questId: questId(89, 'vocabulary'),
    items: [
      {
        id: 'achievement',
        word: 'achievement',
        phonetic: '/əˈtʃiːvmənt/',
        partOfSpeech: 'noun',
        definition: 'Something good you have done after trying hard.',
        translation: 'достижение',
        example: 'Finishing all ninety days is a real achievement.',
      },
      {
        id: 'confidence',
        word: 'confidence',
        phonetic: '/ˈkɑːnfɪdəns/',
        partOfSpeech: 'noun',
        definition: 'The feeling that you can do something well.',
        translation: 'уверенность',
        example: 'Every conversation gives me more confidence.',
      },
      {
        id: 'progress',
        word: 'progress',
        phonetic: '/ˈprɑːɡres/',
        partOfSpeech: 'noun',
        definition: 'Getting better, or closer to a goal, step by step.',
        translation: 'прогресс',
        example: 'You can see your progress on the map.',
      },
      {
        id: 'effort',
        word: 'effort',
        phonetic: '/ˈefərt/',
        partOfSpeech: 'noun',
        definition: 'The energy and hard work you put into something.',
        translation: 'усилие',
        example: 'Learning a language takes time and effort.',
      },
      {
        id: 'consistent',
        word: 'consistent',
        phonetic: '/kənˈsɪstənt/',
        partOfSpeech: 'adjective',
        definition: 'Doing something the same way, again and again, over time.',
        translation: 'последовательный',
        example: 'Be consistent: ten minutes every day is enough.',
      },
      {
        id: 'overcome',
        word: 'overcome',
        phonetic: '/ˌoʊvərˈkʌm/',
        partOfSpeech: 'verb',
        definition: 'To deal with a problem or a fear and succeed.',
        translation: 'преодолеть',
        example: 'She overcame her fear of speaking English.',
      },
    ],
    exercises: [
      {
        kind: 'pickTranslation',
        id: 'd089-vocab-1',
        itemId: 'achievement',
        optionItemIds: ['confidence', 'achievement', 'effort', 'progress'],
      },
      {
        kind: 'pickWord',
        id: 'd089-vocab-2',
        itemId: 'confidence',
        optionItemIds: ['progress', 'effort', 'confidence', 'consistent'],
      },
      {
        kind: 'fillGap',
        id: 'd089-vocab-3',
        itemId: 'progress',
        sentence: 'Small steps lead to real ___.',
        optionItemIds: ['confidence', 'achievement', 'progress', 'effort'],
      },
      {
        kind: 'pickTranslation',
        id: 'd089-vocab-4',
        itemId: 'effort',
        optionItemIds: ['effort', 'overcome', 'achievement', 'consistent'],
      },
      {
        kind: 'pickWord',
        id: 'd089-vocab-5',
        itemId: 'overcome',
        optionItemIds: ['consistent', 'overcome', 'progress', 'effort'],
      },
      {
        kind: 'fillGap',
        id: 'd089-vocab-6',
        itemId: 'consistent',
        sentence: 'Practice a little every day and stay ___.',
        optionItemIds: ['confidence', 'achievement', 'consistent', 'progress'],
      },
    ],
  },
];
