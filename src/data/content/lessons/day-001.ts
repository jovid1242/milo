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
    quiz: [
      {
        kind: 'singleChoice',
        id: 'd001-vocab-q1',
        prompt: 'What is a habit?',
        options: [
          { id: 'a', label: 'Something you do regularly' },
          { id: 'b', label: 'A long trip' },
          { id: 'c', label: 'A difficult test' },
        ],
        correctOptionId: 'a',
      },
      {
        kind: 'fillBlank',
        id: 'd001-vocab-q2',
        prompt: 'My ___ is to speak English with confidence.',
        acceptedAnswers: ['goal'],
      },
      {
        kind: 'singleChoice',
        id: 'd001-vocab-q3',
        prompt: 'Which word means "to get better"?',
        options: [
          { id: 'a', label: 'forget' },
          { id: 'b', label: 'improve' },
          { id: 'c', label: 'finish' },
        ],
        correctOptionId: 'b',
      },
    ],
  },
  {
    type: 'grammar',
    questId: questId(1, 'grammar'),
    topic: 'Present Simple for habits',
    explanation:
      'Use the Present Simple for things you do regularly. With he, she and it, add -s or -es to the verb.',
    examples: ['I study English every day.', 'She reads before bed.', "We don't give up."],
    quiz: [
      {
        kind: 'singleChoice',
        id: 'd001-grammar-q1',
        prompt: 'Milo ___ new words every morning.',
        options: [
          { id: 'a', label: 'learn' },
          { id: 'b', label: 'learns' },
          { id: 'c', label: 'learning' },
        ],
        correctOptionId: 'b',
        explanation: 'Milo = he, so the verb takes -s.',
      },
      {
        kind: 'singleChoice',
        id: 'd001-grammar-q2',
        prompt: 'They ___ English on weekends.',
        options: [
          { id: 'a', label: 'practice' },
          { id: 'b', label: 'practices' },
          { id: 'c', label: 'practicing' },
        ],
        correctOptionId: 'a',
      },
      {
        kind: 'fillBlank',
        id: 'd001-grammar-q3',
        prompt: 'She ___ (read) a short story every evening.',
        acceptedAnswers: ['reads'],
      },
    ],
  },
  {
    type: 'reading',
    questId: questId(1, 'reading'),
    title: 'Milo packs his backpack',
    paragraphs: [
      'Milo wakes up early. Today is the first day of a long journey to the top of the mountain.',
      'He packs a notebook, a pencil and a small map. Every day he wants to learn six new words.',
      'The path is long, but Milo is not alone. His friends walk with him, and they help each other.',
    ],
    quiz: [
      {
        kind: 'singleChoice',
        id: 'd001-reading-q1',
        prompt: 'Where does Milo want to go?',
        options: [
          { id: 'a', label: 'To the sea' },
          { id: 'b', label: 'To the top of the mountain' },
          { id: 'c', label: 'To school' },
        ],
        correctOptionId: 'b',
      },
      {
        kind: 'singleChoice',
        id: 'd001-reading-q2',
        prompt: 'How many new words does Milo want to learn every day?',
        options: [
          { id: 'a', label: 'Three' },
          { id: 'b', label: 'Six' },
          { id: 'c', label: 'Ten' },
        ],
        correctOptionId: 'b',
      },
      {
        kind: 'singleChoice',
        id: 'd001-reading-q3',
        prompt: 'Who walks with Milo?',
        options: [
          { id: 'a', label: 'His friends' },
          { id: 'b', label: 'His teacher' },
          { id: 'c', label: 'Nobody' },
        ],
        correctOptionId: 'a',
      },
    ],
  },
  {
    // Day 1 review: today's words and rule once more, mixed.
    type: 'review',
    questId: questId(1, 'review'),
    quiz: [
      {
        kind: 'singleChoice',
        id: 'd001-review-q1',
        prompt: 'Translate: «привычка»',
        options: [
          { id: 'a', label: 'goal' },
          { id: 'b', label: 'habit' },
          { id: 'c', label: 'journey' },
        ],
        correctOptionId: 'b',
      },
      {
        kind: 'fillBlank',
        id: 'd001-review-q2',
        prompt: 'He ___ (practice) English every day.',
        acceptedAnswers: ['practices'],
      },
      {
        kind: 'singleChoice',
        id: 'd001-review-q3',
        prompt: 'Which sentence is correct?',
        options: [
          { id: 'a', label: 'She read every evening.' },
          { id: 'b', label: 'She reading every evening.' },
          { id: 'c', label: 'She reads every evening.' },
        ],
        correctOptionId: 'c',
      },
      {
        kind: 'singleChoice',
        id: 'd001-review-q4',
        prompt: 'Something you want to achieve is a…',
        options: [
          { id: 'a', label: 'goal' },
          { id: 'b', label: 'habit' },
          { id: 'c', label: 'map' },
        ],
        correctOptionId: 'a',
      },
      {
        kind: 'fillBlank',
        id: 'd001-review-q5',
        prompt: 'Every ___ starts with a single step.',
        acceptedAnswers: ['journey'],
      },
    ],
  },
];
