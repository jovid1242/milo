import type { DayContent } from '../types';

/**
 * Day 89, the day before the summit.
 * - Vocabulary: six B1 words about what the journey was about — effort,
 *   progress and the confidence it brings.
 * - Grammar: Present Perfect vs Past Simple, kept to the one idea that matters
 *   at B1: a finished time → Past Simple; the past connected to now → Present Perfect.
 * - Reading: "Small Steps" (~400 words, B1) — ten minutes a day, four months, one
 *   ordinary conversation that shows how far she has come. "Confident" is a
 *   Day 1 word: the text refers to it instead of copying its meaning.
 * - Review: eight quick questions back to all three — mixed, with new sentences
 *   for the rule, and the words and story referenced rather than copied.
 */
export const DAY_089: DayContent = {
  vocabulary: [
    {
      id: 'vocab-achievement',
      word: 'achievement',
      phonetic: '/əˈtʃiːvmənt/',
      partOfSpeech: 'noun',
      definition: 'Something good you have done after trying hard.',
      translation: 'достижение',
      example: 'Finishing all ninety days is a real achievement.',
      level: 'B1',
    },
    {
      id: 'vocab-confidence',
      word: 'confidence',
      phonetic: '/ˈkɑːnfɪdəns/',
      partOfSpeech: 'noun',
      definition: 'The feeling that you can do something well.',
      translation: 'уверенность',
      example: 'Every conversation gives me more confidence.',
      level: 'B1',
    },
    {
      id: 'vocab-progress',
      word: 'progress',
      phonetic: '/ˈprɑːɡres/',
      partOfSpeech: 'noun',
      definition: 'Getting better, or closer to a goal, step by step.',
      translation: 'прогресс',
      example: 'You can see your progress on the map.',
      level: 'B1',
    },
    {
      id: 'vocab-effort',
      word: 'effort',
      phonetic: '/ˈefərt/',
      partOfSpeech: 'noun',
      definition: 'The energy and hard work you put into something.',
      translation: 'усилие',
      example: 'Learning a language takes time and effort.',
      level: 'B1',
    },
    {
      id: 'vocab-consistent',
      word: 'consistent',
      phonetic: '/kənˈsɪstənt/',
      partOfSpeech: 'adjective',
      definition: 'Doing something the same way, again and again, over time.',
      translation: 'последовательный',
      example: 'Be consistent: ten minutes every day is enough.',
      level: 'B1',
    },
    {
      id: 'vocab-overcome',
      word: 'overcome',
      phonetic: '/ˌoʊvərˈkʌm/',
      partOfSpeech: 'verb',
      definition: 'To deal with a problem or a fear and succeed.',
      translation: 'преодолеть',
      example: 'She overcame her fear of speaking English.',
      level: 'B1',
    },
  ],
  grammar: [
    {
      id: 'grammar-past-simple-vs-present-perfect',
      level: 'B1',
      rule: {
        title: 'Present Perfect vs Past Simple',
        lead: 'Both look back at the past. What matters is when.',
        points: [
          {
            id: 'grammar-past-simple-vs-present-perfect.past-simple',
            name: 'Past Simple',
            idea: 'A finished time in the past',
            timeline: 'pastPoint',
            example: {
              text: 'I visited London last year.',
              marks: [
                {
                  text: 'visited',
                  kind: 'form',
                },
                {
                  text: 'last year',
                  kind: 'signal',
                },
              ],
            },
            signals: ['yesterday', 'last year', 'in 2025', 'two days ago'],
          },
          {
            id: 'grammar-past-simple-vs-present-perfect.present-perfect',
            name: 'Present Perfect',
            idea: 'The past, connected to now',
            timeline: 'pastToNow',
            example: {
              text: 'I’ve visited London three times.',
              marks: [
                {
                  text: '’ve visited',
                  kind: 'form',
                },
                {
                  text: 'three times',
                  kind: 'signal',
                },
              ],
            },
            signals: ['ever', 'never', 'already', 'yet', 'three times'],
          },
        ],
        tip: 'See a finished time like “yesterday”? Use Past Simple.',
      },
      examples: [
        {
          id: 'd089-grammar-ex1',
          sentence: {
            text: 'I lost my keys yesterday.',
            marks: [
              {
                text: 'lost',
                kind: 'form',
              },
              {
                text: 'yesterday',
                kind: 'signal',
              },
            ],
          },
          pointId: 'grammar-past-simple-vs-present-perfect.past-simple',
          question: 'Why Past Simple?',
          explanation: '“Yesterday” is a finished time, so the action is finished too.',
        },
        {
          id: 'd089-grammar-ex2',
          sentence: {
            text: 'I’ve lost my keys.',
            marks: [
              {
                text: '’ve lost',
                kind: 'form',
              },
            ],
          },
          pointId: 'grammar-past-simple-vs-present-perfect.present-perfect',
          question: 'Why Present Perfect?',
          explanation: 'No time is given, and the result matters now: I still can’t find them.',
        },
        {
          id: 'd089-grammar-ex3',
          sentence: {
            text: 'Have you ever been to Italy?',
            marks: [
              {
                text: 'Have',
                kind: 'form',
              },
              {
                text: 'ever',
                kind: 'signal',
              },
              {
                text: 'been',
                kind: 'form',
              },
            ],
          },
          pointId: 'grammar-past-simple-vs-present-perfect.present-perfect',
          question: 'Why Present Perfect?',
          explanation: 'It asks about your whole life up to now, not one finished moment.',
        },
      ],
      exercises: [
        {
          kind: 'choose',
          id: 'd089-grammar-1',
          sentence: 'I ___ that movie three times.',
          options: [
            {
              id: 'a',
              text: 'saw',
            },
            {
              id: 'b',
              text: 'have seen',
            },
          ],
          correctOptionId: 'b',
          explanation: 'No finished past time is given, and “three times” counts up to now.',
        },
        {
          kind: 'complete',
          id: 'd089-grammar-2',
          sentence: 'She ___ to Paris last year.',
          options: [
            {
              id: 'a',
              text: 'has gone',
            },
            {
              id: 'b',
              text: 'went',
            },
            {
              id: 'c',
              text: 'has been',
            },
            {
              id: 'd',
              text: 'goes',
            },
          ],
          correctOptionId: 'b',
          explanation: '“Last year” tells us when the finished action happened.',
        },
        {
          kind: 'spotCorrect',
          id: 'd089-grammar-3',
          question: 'Which sentence is correct?',
          options: [
            {
              id: 'a',
              text: 'I’ve seen him yesterday.',
            },
            {
              id: 'b',
              text: 'I saw him yesterday.',
            },
          ],
          correctOptionId: 'b',
          explanation: 'Use Past Simple with a finished time such as “yesterday”.',
        },
        {
          kind: 'meaning',
          id: 'd089-grammar-4',
          question: 'Which sentence is about a life experience?',
          options: [
            {
              id: 'a',
              text: 'I went to Italy in 2024.',
            },
            {
              id: 'b',
              text: 'I’ve been to Italy twice.',
            },
          ],
          correctOptionId: 'b',
          explanation:
            'Present Perfect looks at your life up to now; “in 2024” is one finished time.',
        },
        {
          kind: 'complete',
          id: 'd089-grammar-5',
          sentence: 'When ___ your new job?',
          options: [
            {
              id: 'a',
              text: 'have you started',
            },
            {
              id: 'b',
              text: 'did you start',
            },
            {
              id: 'c',
              text: 'did you started',
            },
            {
              id: 'd',
              text: 'you started',
            },
          ],
          correctOptionId: 'b',
          explanation: '“When” asks for a finished time, so we use Past Simple.',
        },
        {
          kind: 'choose',
          id: 'd089-grammar-6',
          sentence: '___ you ever met a famous person?',
          options: [
            {
              id: 'a',
              text: 'Did',
            },
            {
              id: 'b',
              text: 'Have',
            },
          ],
          correctOptionId: 'b',
          explanation: '“Ever” asks about your whole life up to now: Have you ever…?',
        },
      ],
    },
  ],
  readings: [
    {
      id: 'reading-small-steps',
      story: {
        title: 'Small Steps',
        subtitle: 'A short story',
        level: 'B1',
        estimatedMinutes: 3,
        paragraphs: [
          {
            id: 'p1',
            text: 'Kamila worked at a small café near the old bridge in her town. In summer, tourists came in every day, and many of them spoke English. Kamila knew some words, but when someone asked her a question, she could not find a single one. She usually smiled, pointed at the menu and waited for her manager, Rustam, to help. Every time, she felt embarrassed.',
          },
          {
            id: 'p2',
            text: 'One evening, after a long day, she decided to change something. She did not have time for a course, and lessons with a private teacher were too expensive. So she made a simple plan: ten minutes of English every morning on the bus to work. She bought a small notebook, and every morning she wrote down five new words and said them quietly to herself.',
          },
          {
            id: 'p3',
            text: 'The first month was hard. Kamila practiced every day, but she did not feel any different. Tourists still spoke too fast, and she still waited for Rustam. One night she wanted to give up. “Ten minutes a day is nothing,” she told her sister. Her sister laughed. “You didn’t learn to cook in ten minutes either,” she said. “Be patient.”',
          },
          {
            id: 'p4',
            text: 'So Kamila kept going. She started reading the signs and menus around town in English, and on the way home she listened to one English song and tried to follow the words. Nothing changed in a day, but gradually the sentences stopped sounding like noise. First she caught single words, then whole phrases.',
          },
          {
            id: 'p5',
            text: 'In October, a family came into the café with a map. The father asked, very quickly, how to get to the museum and whether it was open on Mondays. Rustam was busy in the kitchen. Kamila took a deep breath and answered. She explained the way, told them that the museum was closed on Mondays and even recommended a place for lunch. The father thanked her and said that her English was very clear.',
          },
          {
            id: 'p6',
            text: 'After they left, Kamila stood still for a moment. She had not studied for hours, and she had not found a secret method. She had simply opened her notebook every morning for four months. That evening she felt more confident than ever, and the next morning on the bus she wrote down five new words, just like before.',
          },
        ],
        words: [
          {
            id: 'embarrassed',
            text: 'embarrassed',
            paragraphId: 'p1',
            phonetic: '/ɪmˈbærəst/',
            translation: 'смущённый',
            definition: 'feeling shy or silly in front of other people',
          },
          {
            id: 'give-up',
            text: 'give up',
            paragraphId: 'p3',
            phonetic: '/ɡɪv ˈʌp/',
            translation: 'сдаться, бросить',
            definition: 'to stop trying',
          },
          {
            id: 'patient',
            text: 'patient',
            paragraphId: 'p3',
            phonetic: '/ˈpeɪʃənt/',
            translation: 'терпеливый',
            definition: 'able to wait calmly for something',
          },
          {
            id: 'gradually',
            text: 'gradually',
            paragraphId: 'p4',
            phonetic: '/ˈɡrædʒuəli/',
            translation: 'постепенно',
            definition: 'slowly, over time',
          },
          {
            id: 'confident',
            text: 'confident',
            paragraphId: 'p6',
            vocabularyId: 'vocab-confident',
          },
        ],
      },
      questions: [
        {
          id: 'd089-reading-1',
          kind: 'mainIdea',
          question: 'What is the main idea of the story?',
          options: [
            {
              id: 'a',
              text: 'Kamila found a fast way to learn English in one month.',
            },
            {
              id: 'b',
              text: 'A little practice every day slowly changed Kamila’s English.',
            },
            {
              id: 'c',
              text: 'Tourists at the café helped Kamila learn English.',
            },
            {
              id: 'd',
              text: 'Kamila left her job to study English full-time.',
            },
          ],
          correctOptionId: 'b',
          evidence:
            'Ten minutes every morning for four months made the difference — not one big change.',
        },
        {
          id: 'd089-reading-2',
          kind: 'detail',
          question: 'What did Kamila do every morning on the bus?',
          options: [
            {
              id: 'a',
              text: 'She listened to an English song.',
            },
            {
              id: 'b',
              text: 'She read the café menu in English.',
            },
            {
              id: 'c',
              text: 'She wrote down five new words and said them quietly.',
            },
            {
              id: 'd',
              text: 'She called her sister to practice speaking.',
            },
          ],
          correctOptionId: 'c',
          evidence:
            '“Every morning she wrote down five new words and said them quietly to herself.” The song was on the way home.',
        },
        {
          id: 'd089-reading-3',
          kind: 'inference',
          question: 'Why could Kamila answer the family’s questions in October?',
          options: [
            {
              id: 'a',
              text: 'The father spoke slowly and used easy words.',
            },
            {
              id: 'b',
              text: 'Rustam told her what to say from the kitchen.',
            },
            {
              id: 'c',
              text: 'She had learned those exact questions the day before.',
            },
            {
              id: 'd',
              text: 'Months of short daily practice had built up her English.',
            },
          ],
          correctOptionId: 'd',
          evidence:
            '“She had simply opened her notebook every morning for four months.” The father spoke very quickly.',
        },
        {
          id: 'd089-reading-4',
          kind: 'context',
          wordId: 'gradually',
          question: 'In the story, what does “gradually” most likely mean?',
          options: [
            {
              id: 'a',
              text: 'slowly, little by little',
            },
            {
              id: 'b',
              text: 'suddenly, all at once',
            },
            {
              id: 'c',
              text: 'only sometimes',
            },
            {
              id: 'd',
              text: 'without any effort',
            },
          ],
          correctOptionId: 'a',
          evidence:
            '“Nothing changed in a day, but gradually the sentences stopped sounding like noise.”',
        },
      ],
    },
  ],
  lessons: [
    {
      type: 'vocabulary',
      questId: 'd089-vocabulary',
      wordIds: [
        'vocab-achievement',
        'vocab-confidence',
        'vocab-progress',
        'vocab-effort',
        'vocab-consistent',
        'vocab-overcome',
      ],
      exercises: [
        {
          kind: 'pickTranslation',
          id: 'd089-vocab-1',
          itemId: 'vocab-achievement',
          optionItemIds: [
            'vocab-confidence',
            'vocab-achievement',
            'vocab-effort',
            'vocab-progress',
          ],
        },
        {
          kind: 'pickWord',
          id: 'd089-vocab-2',
          itemId: 'vocab-confidence',
          optionItemIds: ['vocab-progress', 'vocab-effort', 'vocab-confidence', 'vocab-consistent'],
        },
        {
          kind: 'fillGap',
          id: 'd089-vocab-3',
          itemId: 'vocab-progress',
          sentence: 'Small steps lead to real ___.',
          optionItemIds: [
            'vocab-confidence',
            'vocab-achievement',
            'vocab-progress',
            'vocab-effort',
          ],
        },
        {
          kind: 'pickTranslation',
          id: 'd089-vocab-4',
          itemId: 'vocab-effort',
          optionItemIds: [
            'vocab-effort',
            'vocab-overcome',
            'vocab-achievement',
            'vocab-consistent',
          ],
        },
        {
          kind: 'pickWord',
          id: 'd089-vocab-5',
          itemId: 'vocab-overcome',
          optionItemIds: ['vocab-consistent', 'vocab-overcome', 'vocab-progress', 'vocab-effort'],
        },
        {
          kind: 'fillGap',
          id: 'd089-vocab-6',
          itemId: 'vocab-consistent',
          sentence: 'Practice a little every day and stay ___.',
          optionItemIds: [
            'vocab-confidence',
            'vocab-achievement',
            'vocab-consistent',
            'vocab-progress',
          ],
        },
      ],
    },
    {
      type: 'grammar',
      questId: 'd089-grammar',
      lessonId: 'grammar-past-simple-vs-present-perfect',
    },
    {
      type: 'reading',
      questId: 'd089-reading',
      readingId: 'reading-small-steps',
    },
    {
      type: 'review',
      questId: 'd089-review',
      exercises: [
        {
          source: 'vocabulary',
          exercise: {
            kind: 'pickTranslation',
            id: 'd089-review-1',
            itemId: 'vocab-consistent',
            optionItemIds: [
              'vocab-effort',
              'vocab-consistent',
              'vocab-overcome',
              'vocab-confidence',
            ],
          },
        },
        {
          source: 'grammar',
          pointId: 'grammar-past-simple-vs-present-perfect.past-simple',
          exercise: {
            kind: 'choose',
            id: 'd089-review-2',
            sentence: 'I ___ her yesterday.',
            options: [
              {
                id: 'a',
                text: 'have seen',
              },
              {
                id: 'b',
                text: 'saw',
              },
            ],
            correctOptionId: 'b',
            explanation: '“Yesterday” is a finished time, so: Past Simple.',
          },
        },
        {
          source: 'reading',
          readingId: 'reading-small-steps',
          question: {
            id: 'd089-review-3',
            kind: 'mainIdea',
            question: 'What helped Kamila improve?',
            options: [
              {
                id: 'a',
                text: 'Lessons with a private teacher',
              },
              {
                id: 'b',
                text: 'A short English course',
              },
              {
                id: 'c',
                text: 'Ten minutes of English every morning',
              },
              {
                id: 'd',
                text: 'Talking to tourists every day',
              },
            ],
            correctOptionId: 'c',
            evidence: 'Her plan was ten minutes of English every morning on the bus.',
          },
        },
        {
          source: 'vocabulary',
          exercise: {
            kind: 'pickWordByDefinition',
            id: 'd089-review-4',
            itemId: 'vocab-overcome',
            optionItemIds: [
              'vocab-overcome',
              'vocab-achievement',
              'vocab-progress',
              'vocab-effort',
            ],
          },
        },
        {
          source: 'grammar',
          pointId: 'grammar-past-simple-vs-present-perfect.present-perfect',
          exercise: {
            kind: 'choose',
            id: 'd089-review-5',
            sentence: 'We ___ in this city since 2019.',
            options: [
              {
                id: 'a',
                text: 'lived',
              },
              {
                id: 'b',
                text: 'have lived',
              },
            ],
            correctOptionId: 'b',
            explanation: '“Since 2019” runs up to now, so: Present Perfect.',
          },
        },
        {
          source: 'vocabulary',
          exercise: {
            kind: 'fillGap',
            id: 'd089-review-6',
            itemId: 'vocab-confidence',
            sentence: 'Speaking in class every day gave him more ___.',
            optionItemIds: [
              'vocab-achievement',
              'vocab-consistent',
              'vocab-confidence',
              'vocab-overcome',
            ],
          },
        },
        {
          source: 'reading',
          readingId: 'reading-small-steps',
          snippet: {
            paragraphId: 'p5',
            sentence: 5,
          },
          question: {
            id: 'd089-review-7',
            kind: 'inference',
            question: 'How did Kamila feel after this conversation?',
            options: [
              {
                id: 'a',
                text: 'Embarrassed, as always',
              },
              {
                id: 'b',
                text: 'More confident than ever',
              },
              {
                id: 'c',
                text: 'Ready to give up',
              },
              {
                id: 'd',
                text: 'Angry with Rustam',
              },
            ],
            correctOptionId: 'b',
            evidence: '“That evening she felt more confident than ever.”',
          },
        },
        {
          source: 'grammar',
          pointId: 'grammar-past-simple-vs-present-perfect.present-perfect',
          exercise: {
            kind: 'meaning',
            id: 'd089-review-8',
            question: 'Which sentence is about experience up to now?',
            options: [
              {
                id: 'a',
                text: 'I met the new manager on Monday.',
              },
              {
                id: 'b',
                text: 'I’ve met the new manager twice.',
              },
            ],
            correctOptionId: 'b',
            explanation: '“Twice” counts up to now; “on Monday” is one finished time.',
          },
        },
      ],
    },
  ],
};
