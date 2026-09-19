import type { QuestContent } from '@/schemas';

import { questId } from '../schedule';

/** Sample authored content for Day 1. Other days are added the same way. */
export const DAY_001: readonly QuestContent[] = [
  {
    type: 'vocabulary',
    questId: questId(1, 'vocabulary'),
    items: [
      {
        id: 'journey',
        word: 'journey',
        phonetic: '/ˈdʒɜːrni/',
        partOfSpeech: 'noun',
        definition: 'A trip from one place to another, often a long one.',
        translation: 'путешествие',
        example: 'Every journey starts with a single step.',
      },
      {
        id: 'habit',
        word: 'habit',
        phonetic: '/ˈhæbɪt/',
        partOfSpeech: 'noun',
        definition: 'Something you do regularly, often without thinking.',
        translation: 'привычка',
        example: 'Reading every evening is a good habit.',
      },
      {
        id: 'goal',
        word: 'goal',
        phonetic: '/ɡoʊl/',
        partOfSpeech: 'noun',
        definition: 'Something you want to achieve.',
        translation: 'цель',
        example: 'My goal is to speak English with confidence.',
      },
      {
        id: 'improve',
        word: 'improve',
        phonetic: '/ɪmˈpruːv/',
        partOfSpeech: 'verb',
        definition: 'To become better, or to make something better.',
        translation: 'улучшать(ся)',
        example: 'Your English improves when you practice every day.',
      },
      {
        id: 'practice',
        word: 'practice',
        phonetic: '/ˈpræktɪs/',
        partOfSpeech: 'verb',
        definition: 'To do something again and again to get better at it.',
        translation: 'практиковаться',
        example: 'We practice new words together.',
      },
      {
        id: 'confident',
        word: 'confident',
        phonetic: '/ˈkɑːnfɪdənt/',
        partOfSpeech: 'adjective',
        definition: 'Sure about yourself and your abilities.',
        translation: 'уверенный',
        example: 'After a week, Milo felt more confident.',
      },
    ],
    exercises: [
      {
        kind: 'pickTranslation',
        id: 'd001-vocab-1',
        itemId: 'habit',
        optionItemIds: ['journey', 'habit', 'goal', 'practice'],
      },
      {
        kind: 'pickWord',
        id: 'd001-vocab-2',
        itemId: 'goal',
        optionItemIds: ['habit', 'goal', 'confident', 'journey'],
      },
      {
        kind: 'fillGap',
        id: 'd001-vocab-3',
        itemId: 'journey',
        sentence: 'Every ___ starts with a single step.',
        optionItemIds: ['goal', 'improve', 'journey', 'habit'],
      },
      {
        kind: 'pickTranslation',
        id: 'd001-vocab-4',
        itemId: 'improve',
        optionItemIds: ['improve', 'practice', 'confident', 'goal'],
      },
      {
        kind: 'pickWord',
        id: 'd001-vocab-5',
        itemId: 'confident',
        optionItemIds: ['practice', 'habit', 'improve', 'confident'],
      },
      {
        kind: 'fillGap',
        id: 'd001-vocab-6',
        itemId: 'practice',
        sentence: 'We ___ new words together every evening.',
        optionItemIds: ['journey', 'practice', 'goal', 'confident'],
      },
    ],
  },
  {
    type: 'grammar',
    questId: questId(1, 'grammar'),
    rule: {
      title: 'Present Simple for habits',
      lead: 'For things you do again and again.',
      points: [
        {
          id: 'base',
          name: 'I · you · we · they',
          idea: 'The verb as it is',
          timeline: 'repeated',
          example: {
            text: 'I study English every day.',
            marks: [
              { text: 'study', kind: 'form' },
              { text: 'every day', kind: 'signal' },
            ],
          },
          signals: ['every day', 'usually', 'on weekends'],
        },
        {
          id: 'third-person',
          name: 'he · she · it',
          idea: 'The verb + s',
          timeline: 'repeated',
          example: {
            text: 'She reads before bed.',
            marks: [
              { text: 'reads', kind: 'form' },
              { text: 'before bed', kind: 'signal' },
            ],
          },
          signals: ['always', 'often', 'every morning'],
        },
      ],
      tip: 'He, she, it: add -s — works, reads, goes.',
    },
    examples: [
      {
        id: 'd001-grammar-ex1',
        sentence: {
          text: 'Milo walks to the river every morning.',
          marks: [
            { text: 'walks', kind: 'form' },
            { text: 'every morning', kind: 'signal' },
          ],
        },
        pointId: 'third-person',
        question: 'Why “walks”, with -s?',
        explanation: 'Milo is “he”, and this is a habit, so the verb takes -s.',
      },
      {
        id: 'd001-grammar-ex2',
        sentence: {
          text: 'We practice English on weekends.',
          marks: [
            { text: 'practice', kind: 'form' },
            { text: 'on weekends', kind: 'signal' },
          ],
        },
        pointId: 'base',
        question: 'Why no -s here?',
        explanation: 'With “we”, the verb stays as it is.',
      },
    ],
    exercises: [
      {
        kind: 'choose',
        id: 'd001-grammar-1',
        sentence: 'Milo ___ new words every morning.',
        options: [
          { id: 'a', text: 'learn' },
          { id: 'b', text: 'learns' },
        ],
        correctOptionId: 'b',
        explanation: 'Milo is “he”, so the verb takes -s.',
      },
      {
        kind: 'complete',
        id: 'd001-grammar-2',
        sentence: 'They ___ English on weekends.',
        options: [
          { id: 'a', text: 'practice' },
          { id: 'b', text: 'practices' },
          { id: 'c', text: 'practicing' },
        ],
        correctOptionId: 'a',
        explanation: 'With “they”, use the verb as it is.',
      },
      {
        kind: 'spotCorrect',
        id: 'd001-grammar-3',
        question: 'Which sentence is correct?',
        options: [
          { id: 'a', text: 'He go to school by bus.' },
          { id: 'b', text: 'He goes to school by bus.' },
        ],
        correctOptionId: 'b',
        explanation: 'He, she, it take -s or -es: goes.',
      },
      {
        kind: 'meaning',
        id: 'd001-grammar-4',
        question: 'Which sentence is about a habit?',
        options: [
          { id: 'a', text: 'I’m reading a book right now.' },
          { id: 'b', text: 'I read a book every evening.' },
        ],
        correctOptionId: 'b',
        explanation: '“Every evening” shows something you do again and again.',
      },
    ],
  },
  {
    type: 'reading',
    questId: questId(1, 'reading'),
    story: {
      title: 'Milo packs his backpack',
      level: 'A2',
      estimatedMinutes: 1,
      paragraphs: [
        {
          id: 'p1',
          text: 'Milo wakes up early. Today is the first day of a long journey to the top of the mountain.',
        },
        {
          id: 'p2',
          text: 'He packs a notebook, a pencil and a small map. Every day he wants to learn six new words.',
        },
        {
          id: 'p3',
          text: 'The path is long, but Milo is not alone. His friends walk with him, and they help each other.',
        },
      ],
      words: [
        {
          id: 'journey',
          text: 'journey',
          paragraphId: 'p1',
          phonetic: '/ˈdʒɜːrni/',
          translation: 'путешествие',
          definition: 'a long trip from one place to another',
        },
        {
          id: 'alone',
          text: 'alone',
          paragraphId: 'p3',
          phonetic: '/əˈloʊn/',
          translation: 'один, в одиночестве',
          definition: 'without other people',
        },
      ],
    },
    questions: [
      {
        id: 'd001-reading-q1',
        kind: 'mainIdea',
        question: 'What is the story about?',
        options: [
          { id: 'a', text: 'Milo starts a long journey with his friends.' },
          { id: 'b', text: 'Milo buys a new map for school.' },
          { id: 'c', text: 'Milo walks to the sea on his own.' },
        ],
        correctOptionId: 'a',
        evidence: 'It is the first day of a long journey, and his friends walk with him.',
      },
      {
        id: 'd001-reading-q2',
        kind: 'detail',
        question: 'How many new words does Milo want to learn every day?',
        options: [
          { id: 'a', text: 'Three' },
          { id: 'b', text: 'Six' },
          { id: 'c', text: 'Ten' },
        ],
        correctOptionId: 'b',
        evidence: '“Every day he wants to learn six new words.”',
      },
      {
        id: 'd001-reading-q3',
        kind: 'inference',
        question: 'Why is the long path easier for Milo?',
        options: [
          { id: 'a', text: 'He has a very good map.' },
          { id: 'b', text: 'His friends are with him and help him.' },
          { id: 'c', text: 'He walks only a short way every day.' },
        ],
        correctOptionId: 'b',
        evidence: '“Milo is not alone. His friends walk with him, and they help each other.”',
      },
    ],
  },
  {
    // Day 1 review: back to today's words, rule and story — mixed, not in blocks.
    type: 'review',
    questId: questId(1, 'review'),
    sources: {
      vocabulary: questId(1, 'vocabulary'),
      grammar: questId(1, 'grammar'),
      reading: questId(1, 'reading'),
    },
    exercises: [
      {
        source: 'vocabulary',
        exercise: {
          kind: 'pickTranslation',
          id: 'd001-review-1',
          itemId: 'goal',
          optionItemIds: ['habit', 'goal', 'journey', 'improve'],
        },
      },
      {
        source: 'grammar',
        pointId: 'third-person',
        exercise: {
          kind: 'choose',
          id: 'd001-review-2',
          sentence: 'My sister ___ to work by bike.',
          options: [
            { id: 'a', text: 'go' },
            { id: 'b', text: 'goes' },
          ],
          correctOptionId: 'b',
          explanation: 'She takes -s or -es: goes.',
        },
      },
      {
        source: 'reading',
        question: {
          id: 'd001-review-3',
          kind: 'detail',
          question: 'What does Milo pack?',
          options: [
            { id: 'a', text: 'A notebook, a pencil and a map' },
            { id: 'b', text: 'Food and water for the trip' },
            { id: 'c', text: 'Some books and a phone' },
          ],
          correctOptionId: 'a',
          evidence: '“He packs a notebook, a pencil and a small map.”',
        },
      },
      {
        source: 'vocabulary',
        exercise: {
          kind: 'pickWordByDefinition',
          id: 'd001-review-4',
          itemId: 'practice',
          optionItemIds: ['confident', 'practice', 'goal', 'journey'],
        },
      },
      {
        source: 'grammar',
        pointId: 'base',
        exercise: {
          kind: 'spotCorrect',
          id: 'd001-review-5',
          question: 'Which sentence is correct?',
          options: [
            { id: 'a', text: 'We plays football on Sundays.' },
            { id: 'b', text: 'We play football on Sundays.' },
          ],
          correctOptionId: 'b',
          explanation: 'With “we”, the verb stays as it is.',
        },
      },
      {
        source: 'vocabulary',
        exercise: {
          kind: 'fillGap',
          id: 'd001-review-6',
          itemId: 'confident',
          sentence: 'After a month of practice, she felt more ___ in class.',
          optionItemIds: ['habit', 'goal', 'confident', 'journey'],
        },
      },
    ],
  },
];
