import type { LearningOutcome } from '@/schemas';

/**
 * What the learner can do at the end of each chapter. Realistic on purpose:
 * about 30 hours of study in 90 days moves an A2 learner towards B1 — it does
 * not make anyone fluent. Word counts are words met in the course, not words
 * the learner can produce at will.
 */
export const OUTCOMES: LearningOutcome[] = [
  {
    day: 10,
    title: 'After Chapter 1 · Beginning',
    canDo: [
      'Introduce yourself and others: hometown, work or studies, personality, family.',
      'Describe your routine and how often you do things (Present Simple, always … never).',
      'Say what is happening now and contrast it with what usually happens.',
      'Ask and answer everyday questions: do / does, where, when, what time, how often.',
      'Say where places are (there is / there are with prepositions) and make polite requests (Can / Could you…?).',
      'Read a 50–110-word message, profile or notice and find its main idea and key details.',
      'Has met about 60 new words.',
    ],
  },
  {
    day: 30,
    title: 'After Chapter 2 · Momentum',
    canDo: [
      'Tell a short story about a weekend, a trip or a problem in the right order (Past Simple, Past Continuous; first, then, finally).',
      'Talk about plans, arrangements and predictions (going to, Present Continuous, will).',
      'Compare products and places, and talk about quantities when shopping and cooking.',
      'Give simple advice and explain rules (should, have to, must).',
      'Understand 90–170-word messages, emails, dialogues and reviews: main idea, details, simple inferences.',
      'Has met about 180 new words and recognises most of them in context.',
    ],
  },
  {
    day: 60,
    title: 'After Chapter 3 · Habit',
    canDo: [
      'Talk about experiences, recent news and life changes (Present Perfect with for / since, vs Past Simple; Present Perfect Continuous).',
      'Describe how life used to be and what you like or choose to do (used to; verb + -ing / to).',
      'Talk about possibilities and real conditions (may, might, could; zero and first conditionals; unless, as soon as).',
      'Describe people, places and processes (relative clauses; present and past passive).',
      'Give an opinion with reasons and contrast (because, so, although, however) and ask polite indirect questions.',
      'Read 150–260-word texts for the main idea, details, opinions and the meaning of a word from context.',
      'Has met about 360 new words.',
    ],
  },
  {
    day: 89,
    title: 'After Chapter 4 · Growth',
    canDo: [
      'Talk about imaginary situations and give advice (second conditional; If I were you…).',
      "Make deductions (must, might, can't) and tell stories with narrative tenses, including the Past Perfect.",
      'Report what people said, asked and told you to do.',
      'Link ideas into a short, organised paragraph and use common phrasal verbs.',
      'Read 220–400-word B1 texts for main idea, detail, inference and context.',
      'Has met about 530 new words, the core of them reviewed at least four times.',
    ],
  },
  {
    day: 90,
    title: 'At the summit',
    canDo: [
      'Passes the Final Battle (70%): vocabulary retention, grammar in context, reading comprehension and inference from all four chapters.',
      'Works at a solid A2+ moving into B1: B1 in understanding everyday texts and core B1 grammar, not yet consistent B1 in free speaking or writing.',
      'Has a daily habit of about 20 minutes of English.',
    ],
  },
];
