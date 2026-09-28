import type { DayContent } from '../types';

/**
 * Day 7 — the first checkpoint. The day warms up before the week's exam:
 * six words about a week of effort (A2), then a review that mixes them with
 * Days 1 and 2. The exam itself is `checkpoints/week-01`.
 */
export const DAY_007: DayContent = {
  vocabulary: [
    {
      id: 'vocab-challenge',
      word: 'challenge',
      phonetic: '/ˈtʃælɪndʒ/',
      partOfSpeech: 'noun',
      definition: 'Something new and difficult that tests you.',
      translation: 'вызов, испытание',
      example: 'Ninety days of English is a real challenge.',
      level: 'A2',
    },
    {
      id: 'vocab-mistake',
      word: 'mistake',
      phonetic: '/mɪˈsteɪk/',
      partOfSpeech: 'noun',
      definition: 'Something that is wrong, done by accident.',
      translation: 'ошибка',
      example: 'Everyone makes mistakes when they learn.',
      level: 'A2',
    },
    {
      id: 'vocab-check',
      word: 'check',
      phonetic: '/tʃek/',
      partOfSpeech: 'verb',
      definition: 'To look at something to see if it is right.',
      translation: 'проверять',
      example: 'Check your answers before you finish.',
      level: 'A1',
    },
    {
      id: 'vocab-ready',
      word: 'ready',
      phonetic: '/ˈredi/',
      partOfSpeech: 'adjective',
      definition: 'Prepared and able to start.',
      translation: 'готовый',
      example: 'Are you ready for the weekly exam?',
      level: 'A1',
    },
    {
      id: 'vocab-proud',
      word: 'proud',
      phonetic: '/praʊd/',
      partOfSpeech: 'adjective',
      definition: 'Pleased about something you or someone close to you did.',
      translation: 'гордый',
      example: 'Milo is proud of his first week.',
      level: 'A2',
    },
    {
      id: 'vocab-rest',
      word: 'rest',
      phonetic: '/rest/',
      partOfSpeech: 'verb',
      definition: 'To stop and relax after work or effort.',
      translation: 'отдыхать',
      example: 'After the exam, we rest by the fire.',
      level: 'A1',
    },
  ],
  grammar: [],
  readings: [],
  lessons: [
    {
      type: 'vocabulary',
      questId: 'd007-vocabulary',
      wordIds: [
        'vocab-challenge',
        'vocab-mistake',
        'vocab-check',
        'vocab-ready',
        'vocab-proud',
        'vocab-rest',
      ],
      exercises: [
        {
          kind: 'pickTranslation',
          id: 'd007-vocab-1',
          itemId: 'vocab-challenge',
          optionItemIds: ['vocab-challenge', 'vocab-mistake', 'vocab-ready', 'vocab-proud'],
        },
        {
          kind: 'pickWord',
          id: 'd007-vocab-2',
          itemId: 'vocab-mistake',
          optionItemIds: ['vocab-check', 'vocab-mistake', 'vocab-rest', 'vocab-challenge'],
        },
        {
          kind: 'fillGap',
          id: 'd007-vocab-3',
          itemId: 'vocab-check',
          sentence: 'Always ___ your answers before you finish.',
          optionItemIds: ['vocab-check', 'vocab-rest', 'vocab-ready', 'vocab-proud'],
        },
        {
          kind: 'pickTranslation',
          id: 'd007-vocab-4',
          itemId: 'vocab-ready',
          optionItemIds: ['vocab-ready', 'vocab-proud', 'vocab-check', 'vocab-rest'],
        },
        {
          kind: 'pickWordByDefinition',
          id: 'd007-vocab-5',
          itemId: 'vocab-proud',
          optionItemIds: ['vocab-mistake', 'vocab-proud', 'vocab-challenge', 'vocab-ready'],
        },
        {
          kind: 'fillGap',
          id: 'd007-vocab-6',
          itemId: 'vocab-rest',
          sentence: 'After a long week, it is good to ___ for an evening.',
          optionItemIds: ['vocab-rest', 'vocab-check', 'vocab-mistake', 'vocab-proud'],
        },
      ],
    },
    {
      type: 'review',
      questId: 'd007-review',
      exercises: [
        {
          source: 'vocabulary',
          exercise: {
            kind: 'pickTranslation',
            id: 'd007-review-1',
            itemId: 'vocab-mistake',
            optionItemIds: ['vocab-mistake', 'vocab-goal', 'vocab-challenge', 'vocab-routine'],
          },
        },
        {
          source: 'grammar',
          pointId: 'grammar-present-simple-spelling.ies',
          exercise: {
            kind: 'complete',
            id: 'd007-review-2',
            sentence: 'She ___ hard before every exam.',
            options: [
              { id: 'a', text: 'studys' },
              { id: 'b', text: 'studies' },
              { id: 'c', text: 'study' },
            ],
            correctOptionId: 'b',
            explanation: 'Consonant + y: the y becomes -ies — studies.',
          },
        },
        {
          source: 'vocabulary',
          exercise: {
            kind: 'fillGap',
            id: 'd007-review-3',
            itemId: 'vocab-proud',
            sentence: 'Milo is ___ of his first week.',
            optionItemIds: ['vocab-proud', 'vocab-quiet', 'vocab-ready', 'vocab-routine'],
          },
        },
        {
          source: 'reading',
          // The Day 1 story, a week later.
          readingId: 'reading-milo-packs-his-backpack',
          question: {
            id: 'd007-review-4',
            kind: 'detail',
            question: 'What does Milo want to learn every day?',
            options: [
              { id: 'a', text: 'Six new words' },
              { id: 'b', text: 'One new song' },
              { id: 'c', text: 'The names of the mountains' },
            ],
            correctOptionId: 'a',
            evidence: '“Every day he wants to learn six new words.”',
          },
          // The sentence before the answer: it sets the scene, it does not give it away.
          snippet: { paragraphId: 'p2', sentence: 0 },
        },
        {
          source: 'grammar',
          pointId: 'grammar-present-simple-habits.base',
          exercise: {
            kind: 'choose',
            id: 'd007-review-5',
            sentence: 'My friends ___ English every evening.',
            options: [
              { id: 'a', text: 'practice' },
              { id: 'b', text: 'practices' },
            ],
            correctOptionId: 'a',
            explanation: 'With “they”, the verb stays as it is.',
          },
        },
        {
          source: 'vocabulary',
          exercise: {
            kind: 'pickWordByDefinition',
            id: 'd007-review-6',
            itemId: 'vocab-check',
            optionItemIds: ['vocab-check', 'vocab-remember', 'vocab-prepare', 'vocab-rest'],
          },
        },
      ],
    },
  ],
};
