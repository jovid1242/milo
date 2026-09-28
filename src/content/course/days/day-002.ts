import type { DayContent } from '../types';

/**
 * Day 2 — a morning routine.
 * - Vocabulary: six everyday words for a daily routine (A2).
 * - Grammar: he / she / it in Present Simple — when -s, -es or -ies.
 * - Reading: "Milo's morning" (A2); two of its highlighted words are this
 *   day's vocabulary and are referenced, not copied.
 * - Review: today's material mixed with Day 1's — a word, the rule and the
 *   story from yesterday come back: the first "later review".
 */
export const DAY_002: DayContent = {
  vocabulary: [
    {
      id: 'vocab-routine',
      word: 'routine',
      phonetic: '/ruːˈtiːn/',
      partOfSpeech: 'noun',
      definition: 'The usual things you do every day, in the same order.',
      translation: 'распорядок дня',
      example: 'A short morning routine helps me start the day.',
      level: 'A2',
    },
    {
      id: 'vocab-prepare',
      word: 'prepare',
      phonetic: '/prɪˈper/',
      partOfSpeech: 'verb',
      definition: 'To get something or someone ready.',
      translation: 'готовить(ся)',
      example: 'Milo prepares his map before every walk.',
      level: 'A2',
    },
    {
      id: 'vocab-usually',
      word: 'usually',
      phonetic: '/ˈjuːʒuəli/',
      partOfSpeech: 'adverb',
      definition: 'In most cases; most of the time.',
      translation: 'обычно',
      example: 'I usually study in the evening.',
      level: 'A2',
    },
    {
      id: 'vocab-remember',
      word: 'remember',
      phonetic: '/rɪˈmembər/',
      partOfSpeech: 'verb',
      definition: 'To keep something in your mind, or bring it back to it.',
      translation: 'помнить, запоминать',
      example: 'Say a new word three times to remember it.',
      level: 'A2',
    },
    {
      id: 'vocab-quiet',
      word: 'quiet',
      phonetic: '/ˈkwaɪət/',
      partOfSpeech: 'adjective',
      definition: 'Making very little noise.',
      translation: 'тихий',
      example: 'The camp is quiet early in the morning.',
      level: 'A1',
    },
    {
      id: 'vocab-together',
      word: 'together',
      phonetic: '/təˈɡeðər/',
      partOfSpeech: 'adverb',
      definition: 'With each other; not alone.',
      translation: 'вместе',
      example: 'We walk and learn together.',
      level: 'A1',
    },
  ],
  grammar: [
    {
      id: 'grammar-present-simple-spelling',
      level: 'A1',
      rule: {
        title: 'He, she, it: -s, -es or -ies',
        lead: 'The -s of Present Simple has three spellings.',
        points: [
          {
            id: 'grammar-present-simple-spelling.s',
            name: 'Most verbs',
            idea: 'Just add -s',
            timeline: 'repeated',
            example: {
              text: 'Milo packs his notebook every morning.',
              marks: [
                { text: 'packs', kind: 'form' },
                { text: 'every morning', kind: 'signal' },
              ],
            },
            signals: ['every morning', 'usually'],
          },
          {
            id: 'grammar-present-simple-spelling.es',
            name: '-s, -sh, -ch, -x, -o',
            idea: 'Add -es',
            timeline: 'repeated',
            example: {
              text: 'She watches the sunrise every day.',
              marks: [
                { text: 'watches', kind: 'form' },
                { text: 'every day', kind: 'signal' },
              ],
            },
            signals: ['every day', 'often'],
          },
          {
            id: 'grammar-present-simple-spelling.ies',
            name: 'Consonant + y',
            idea: 'The y becomes -ies',
            timeline: 'repeated',
            example: {
              text: 'He studies six words a day.',
              marks: [
                { text: 'studies', kind: 'form' },
                { text: 'a day', kind: 'signal' },
              ],
            },
            signals: ['a day', 'always'],
          },
        ],
        tip: 'go → goes, watch → watches, study → studies — but play → plays.',
      },
      examples: [
        {
          id: 'd002-grammar-ex1',
          sentence: {
            text: 'Milo fixes his tent before dark.',
            marks: [{ text: 'fixes', kind: 'form' }],
          },
          pointId: 'grammar-present-simple-spelling.es',
          question: 'Why -es in “fixes”?',
          explanation: 'Fix ends in -x, so he / she / it adds -es: fixes.',
        },
        {
          id: 'd002-grammar-ex2',
          sentence: {
            text: 'Our teacher tries a new game every week.',
            marks: [
              { text: 'tries', kind: 'form' },
              { text: 'every week', kind: 'signal' },
            ],
          },
          pointId: 'grammar-present-simple-spelling.ies',
          question: 'Why “tries”, not “trys”?',
          explanation: 'Try ends in a consonant + y, so the y becomes -ies.',
        },
        {
          id: 'd002-grammar-ex3',
          sentence: {
            text: 'Milo plays a song at the camp every night.',
            marks: [
              { text: 'plays', kind: 'form' },
              { text: 'every night', kind: 'signal' },
            ],
          },
          pointId: 'grammar-present-simple-spelling.s',
          question: 'Why just -s in “plays”?',
          explanation: 'Play ends in a vowel + y, so it simply takes -s.',
        },
      ],
      exercises: [
        {
          kind: 'choose',
          id: 'd002-grammar-1',
          sentence: 'She ___ her homework after dinner.',
          options: [
            { id: 'a', text: 'dos' },
            { id: 'b', text: 'does' },
          ],
          correctOptionId: 'b',
          explanation: 'Do ends in -o, so he / she / it adds -es: does.',
        },
        {
          kind: 'complete',
          id: 'd002-grammar-2',
          sentence: 'My brother ___ English at university.',
          options: [
            { id: 'a', text: 'studys' },
            { id: 'b', text: 'studies' },
            { id: 'c', text: 'studyes' },
          ],
          correctOptionId: 'b',
          explanation: 'Consonant + y: the y becomes -ies — studies.',
        },
        {
          kind: 'spotCorrect',
          id: 'd002-grammar-3',
          question: 'Which sentence is correct?',
          options: [
            { id: 'a', text: 'Milo watchs the stars at night.' },
            { id: 'b', text: 'Milo watches the stars at night.' },
          ],
          correctOptionId: 'b',
          explanation: 'Watch ends in -ch, so it takes -es: watches.',
        },
        {
          kind: 'complete',
          id: 'd002-grammar-4',
          sentence: 'The bus ___ at the corner every ten minutes.',
          options: [
            { id: 'a', text: 'stops' },
            { id: 'b', text: 'stopes' },
            { id: 'c', text: 'stopies' },
          ],
          correctOptionId: 'a',
          explanation: 'Stop ends in -p: just add -s — stops.',
        },
      ],
    },
  ],
  readings: [
    {
      id: 'reading-milo-morning-routine',
      story: {
        title: 'Milo’s morning',
        level: 'A2',
        estimatedMinutes: 1,
        paragraphs: [
          {
            id: 'p1',
            text: 'Milo usually wakes up before the sun. The camp is quiet, and his friends are still asleep.',
          },
          {
            id: 'p2',
            text: 'First he prepares tea and checks his map. Then he opens his notebook and says yesterday’s words out loud, so he remembers them.',
          },
          {
            id: 'p3',
            text: 'When the others wake up, they eat breakfast together and talk about the path. It is a small routine, but it makes every day easier.',
          },
        ],
        words: [
          { id: 'quiet', text: 'quiet', paragraphId: 'p1', vocabularyId: 'vocab-quiet' },
          {
            id: 'asleep',
            text: 'asleep',
            paragraphId: 'p1',
            phonetic: '/əˈsliːp/',
            translation: 'спящий',
            definition: 'sleeping, not awake',
          },
          { id: 'routine', text: 'routine', paragraphId: 'p3', vocabularyId: 'vocab-routine' },
        ],
      },
      questions: [
        {
          id: 'd002-reading-q1',
          kind: 'mainIdea',
          question: 'What is the story about?',
          options: [
            { id: 'a', text: 'Milo’s short morning routine at the camp.' },
            { id: 'b', text: 'A long walk to a new camp.' },
            { id: 'c', text: 'How Milo cooks dinner for his friends.' },
          ],
          correctOptionId: 'a',
          evidence: '“It is a small routine, but it makes every day easier.”',
        },
        {
          id: 'd002-reading-q2',
          kind: 'detail',
          question: 'What does Milo do first?',
          options: [
            { id: 'a', text: 'He talks with his friends.' },
            { id: 'b', text: 'He prepares tea and checks his map.' },
            { id: 'c', text: 'He eats breakfast.' },
          ],
          correctOptionId: 'b',
          evidence: '“First he prepares tea and checks his map.”',
        },
        {
          id: 'd002-reading-q3',
          kind: 'inference',
          question: 'Why does Milo say yesterday’s words out loud?',
          options: [
            { id: 'a', text: 'To wake up his friends.' },
            { id: 'b', text: 'To remember them better.' },
            { id: 'c', text: 'Because his teacher asks him to.' },
          ],
          correctOptionId: 'b',
          evidence: '“…says yesterday’s words out loud, so he remembers them.”',
        },
      ],
    },
  ],
  lessons: [
    {
      type: 'vocabulary',
      questId: 'd002-vocabulary',
      wordIds: [
        'vocab-routine',
        'vocab-prepare',
        'vocab-usually',
        'vocab-remember',
        'vocab-quiet',
        'vocab-together',
      ],
      exercises: [
        {
          kind: 'pickTranslation',
          id: 'd002-vocab-1',
          itemId: 'vocab-routine',
          optionItemIds: ['vocab-routine', 'vocab-prepare', 'vocab-quiet', 'vocab-together'],
        },
        {
          kind: 'pickWord',
          id: 'd002-vocab-2',
          itemId: 'vocab-usually',
          optionItemIds: ['vocab-remember', 'vocab-usually', 'vocab-quiet', 'vocab-routine'],
        },
        {
          kind: 'fillGap',
          id: 'd002-vocab-3',
          itemId: 'vocab-prepare',
          sentence: 'Let’s ___ our things for tomorrow.',
          optionItemIds: ['vocab-prepare', 'vocab-remember', 'vocab-together', 'vocab-quiet'],
        },
        {
          kind: 'pickWordByDefinition',
          id: 'd002-vocab-4',
          itemId: 'vocab-remember',
          optionItemIds: ['vocab-routine', 'vocab-remember', 'vocab-usually', 'vocab-prepare'],
        },
        {
          kind: 'pickTranslation',
          id: 'd002-vocab-5',
          itemId: 'vocab-quiet',
          optionItemIds: ['vocab-quiet', 'vocab-together', 'vocab-usually', 'vocab-remember'],
        },
        {
          kind: 'fillGap',
          id: 'd002-vocab-6',
          itemId: 'vocab-together',
          sentence: 'Milo and his friends climb the hill ___.',
          optionItemIds: ['vocab-together', 'vocab-quiet', 'vocab-routine', 'vocab-prepare'],
        },
      ],
    },
    { type: 'grammar', questId: 'd002-grammar', lessonId: 'grammar-present-simple-spelling' },
    { type: 'reading', questId: 'd002-reading', readingId: 'reading-milo-morning-routine' },
    {
      type: 'review',
      questId: 'd002-review',
      exercises: [
        {
          source: 'vocabulary',
          exercise: {
            kind: 'pickTranslation',
            id: 'd002-review-1',
            itemId: 'vocab-routine',
            // Yesterday's words come back as options.
            optionItemIds: ['vocab-routine', 'vocab-habit', 'vocab-goal', 'vocab-quiet'],
          },
        },
        {
          source: 'grammar',
          pointId: 'grammar-present-simple-spelling.es',
          exercise: {
            kind: 'choose',
            id: 'd002-review-2',
            sentence: 'My dad ___ the dishes after dinner.',
            options: [
              { id: 'a', text: 'washs' },
              { id: 'b', text: 'washes' },
            ],
            correctOptionId: 'b',
            explanation: 'Wash ends in -sh, so it takes -es: washes.',
          },
        },
        {
          source: 'reading',
          readingId: 'reading-milo-morning-routine',
          question: {
            id: 'd002-review-3',
            kind: 'detail',
            question: 'Who is still asleep when Milo wakes up?',
            options: [
              { id: 'a', text: 'His friends' },
              { id: 'b', text: 'His teacher' },
              { id: 'c', text: 'Nobody' },
            ],
            correctOptionId: 'a',
            evidence: '“…his friends are still asleep.”',
          },
          snippet: { paragraphId: 'p1', sentence: 0 },
        },
        {
          source: 'vocabulary',
          exercise: {
            kind: 'pickWordByDefinition',
            id: 'd002-review-4',
            // A Day 1 word, one day later.
            itemId: 'vocab-practice',
            optionItemIds: ['vocab-practice', 'vocab-prepare', 'vocab-remember', 'vocab-improve'],
          },
        },
        {
          source: 'grammar',
          // Day 1's rule, practised again.
          pointId: 'grammar-present-simple-habits.third-person',
          exercise: {
            kind: 'spotCorrect',
            id: 'd002-review-5',
            question: 'Which sentence is correct?',
            options: [
              { id: 'a', text: 'Milo usually walk to the river.' },
              { id: 'b', text: 'Milo usually walks to the river.' },
            ],
            correctOptionId: 'b',
            explanation: 'Milo is “he”: the verb takes -s — walks.',
          },
        },
        {
          source: 'vocabulary',
          exercise: {
            kind: 'fillGap',
            id: 'd002-review-6',
            itemId: 'vocab-usually',
            sentence: 'I ___ drink tea in the morning, not coffee.',
            optionItemIds: ['vocab-usually', 'vocab-together', 'vocab-quiet', 'vocab-journey'],
          },
        },
      ],
    },
  ],
};
