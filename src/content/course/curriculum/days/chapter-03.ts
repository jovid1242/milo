import type { DayDraft } from '../types';

/**
 * Chapter 3 · Habit — Days 31–60, B1-. Early B1 structures, three new ones a
 * week at most: the Present Perfect, used to, verb patterns, possibility,
 * conditionals, relative clauses, the passive, linkers, indirect questions.
 * Texts reach 150–260 words; one word per text is worked out from context.
 */
export const CHAPTER_03: DayDraft[] = [
  {
    day: 31,
    kind: 'regular',
    theme: { family: 'experience', title: 'Have you ever…?' },
    vocabulary: { focus: 'Life experiences', examples: ['abroad', 'adventure', 'try'] },
    grammar: {
      topic: 'present-perfect',
      stage: 'introduce',
      related: ['past-simple'],
      objective: 'Present Perfect for experiences: Have you ever…? I’ve never…; been vs gone',
    },
    reading: { genre: 'blog', topic: 'Five things I’ve never done' },
  },
  {
    day: 32,
    kind: 'regular',
    theme: { family: 'work', title: 'Getting things done' },
    vocabulary: {
      focus: 'Tasks, lists and replies',
      examples: ['to-do list', 'reply', 'attachment'],
    },
    grammar: {
      topic: 'present-perfect',
      stage: 'practice',
      objective: 'just / already / yet with the Present Perfect',
    },
    reading: { genre: 'email', topic: 'A work email thread: “Have you sent it yet?”' },
  },
  {
    day: 33,
    kind: 'regular',
    theme: { family: 'self', title: 'Life changes' },
    vocabulary: {
      focus: 'Big changes in life',
      examples: ['grow up', 'move (house)', 'apartment'],
    },
    grammar: {
      topic: 'present-perfect',
      stage: 'practice',
      objective: 'for / since and How long…? with the Present Perfect',
    },
    reading: { genre: 'personalExperience', topic: 'A new life in a new city' },
  },
  {
    day: 34,
    kind: 'regular',
    theme: { family: 'learning', title: 'My English story' },
    vocabulary: {
      focus: 'Learning a language',
      examples: ['fluent', 'accent', 'course'],
    },
    grammar: {
      topic: 'present-perfect',
      stage: 'contrast',
      related: ['past-simple'],
      objective: 'Present Perfect vs Past Simple: finished time (last year, in 2020) vs up to now',
    },
    reading: {
      genre: 'story',
      topic: 'Kamila’s English story: how it started and where she is now',
    },
  },
  {
    day: 35,
    kind: 'weeklyExam',
    theme: { family: 'experience', title: 'Experience and change' },
    vocabulary: {
      focus: 'Describing change over time',
      examples: ['gradually', 'recently', 'develop'],
    },
    objective:
      'Tell stories with the Past Simple and Past Continuous; talk about experiences and life changes with the Present Perfect.',
    mustRetain: [
      'Past Continuous vs Past Simple with when / while',
      'Present Perfect: ever / never, just / already / yet, for / since',
      'Present Perfect vs Past Simple',
      'Words for sudden events, travel problems, experiences, tasks and life changes',
    ],
  },
  {
    day: 36,
    kind: 'regular',
    theme: { family: 'culture', title: 'How life used to be' },
    vocabulary: {
      focus: 'Life then and now',
      examples: ['childhood', 'village', 'traditional'],
    },
    grammar: {
      topic: 'used-to',
      stage: 'introduce',
      related: ['past-simple'],
      objective: 'used to / didn’t use to for past habits and states',
    },
    reading: { genre: 'informational', topic: 'How our city has changed in fifty years' },
  },
  {
    day: 37,
    kind: 'regular',
    theme: { family: 'free-time', title: 'Likes and dislikes' },
    vocabulary: {
      focus: 'Hobbies and preferences',
      examples: ['enjoy', 'avoid', 'hobby'],
    },
    grammar: {
      topic: 'verb-patterns',
      stage: 'introduce',
      objective: 'Verb + -ing (enjoy, avoid, mind) and verb + to (decide, hope, want)',
    },
    reading: { genre: 'opinion', topic: 'Forum: what do you enjoy doing after work?' },
  },
  {
    day: 38,
    kind: 'regular',
    theme: { family: 'decisions', title: 'Maybe, maybe not' },
    vocabulary: { focus: 'Being unsure', examples: ['possible', 'probably', 'guess'] },
    grammar: {
      topic: 'modals-possibility',
      stage: 'introduce',
      related: ['can-could'],
      objective: 'may / might / could for possibility',
    },
    reading: { genre: 'dialogue', topic: 'Friends deciding what to do on Saturday' },
  },
  {
    day: 39,
    kind: 'regular',
    theme: { family: 'relationships', title: 'Old friends' },
    vocabulary: {
      focus: 'Friendship over time',
      examples: ['classmate', 'keep in touch', 'get on (with)'],
    },
    grammar: {
      topic: 'used-to',
      stage: 'practice',
      related: ['past-simple'],
      objective: 'used to vs Past Simple; didn’t use to; Did you use to…?',
    },
    reading: {
      genre: 'message',
      topic: '“Remember when we used to…?” — messages between old friends',
    },
  },
  {
    day: 40,
    kind: 'regular',
    theme: { family: 'money', title: 'Spending and saving' },
    vocabulary: { focus: 'Spending and saving money', examples: ['spend', 'save', 'afford'] },
    grammar: {
      topic: 'verb-patterns',
      stage: 'practice',
      objective:
        'Verb patterns with money and plans: decide to, can’t afford to, avoid spending, would like to',
    },
    reading: { genre: 'personalExperience', topic: 'My no-spend month' },
  },
  {
    day: 41,
    kind: 'regular',
    theme: { family: 'free-time', title: 'Weekend options' },
    vocabulary: {
      focus: 'Things to do in your free time',
      examples: ['exhibition', 'concert', 'outdoor'],
    },
    grammar: {
      topic: 'modals-possibility',
      stage: 'practice',
      related: ['will-future'],
      objective: 'could / might for options and suggestions: We could…, It might be…',
    },
    reading: { genre: 'email', topic: 'Choosing between two weekend trips' },
  },
  {
    day: 42,
    kind: 'weeklyExam',
    theme: { family: 'decisions', title: 'Pros and cons' },
    vocabulary: {
      focus: 'Weighing up options',
      examples: ['advantage', 'disadvantage', 'worth'],
    },
    objective:
      'Talk about how life used to be, what you like and choose to do, and what might happen.',
    mustRetain: [
      'used to / didn’t use to vs the Past Simple',
      'Verb + -ing and verb + to-infinitive',
      'may / might / could for possibility and options',
      'Words for life then and now, hobbies, friendship, money and free time',
    ],
  },
  {
    day: 43,
    kind: 'regular',
    theme: { family: 'technology', title: 'How things work' },
    vocabulary: { focus: 'Using devices', examples: ['device', 'charge', 'app'] },
    grammar: {
      topic: 'zero-conditional',
      stage: 'introduce',
      related: ['present-simple'],
      objective: 'Zero conditional for facts and instructions: If you press…, it…',
    },
    reading: { genre: 'informational', topic: 'How to make your phone battery last longer' },
  },
  {
    day: 44,
    kind: 'regular',
    theme: { family: 'food', title: 'Eating well' },
    vocabulary: {
      focus: 'Diet and fitness',
      examples: ['diet', 'fitness', 'junk food'],
    },
    grammar: {
      topic: 'first-conditional',
      stage: 'introduce',
      related: ['zero-conditional', 'will-future'],
      objective: 'First conditional: If + Present Simple, will — real results in the future',
    },
    reading: { genre: 'problemSolution', topic: 'Small changes, big results' },
  },
  {
    day: 45,
    kind: 'regular',
    theme: { family: 'travel', title: 'Planning a trip' },
    vocabulary: {
      focus: 'Booking and arriving',
      examples: ['reservation', 'arrival', 'departure'],
    },
    grammar: {
      topic: 'first-conditional',
      stage: 'practice',
      objective: 'when / as soon as / unless / before / after + Present Simple for the future',
    },
    reading: { genre: 'notice', topic: 'Hotel information for arriving guests' },
  },
  {
    day: 46,
    kind: 'regular',
    theme: { family: 'work', title: 'People who help us' },
    vocabulary: {
      focus: 'Jobs that help others',
      examples: ['nurse', 'volunteer', 'customer'],
    },
    grammar: {
      topic: 'relative-clauses',
      stage: 'introduce',
      objective: 'Defining relative clauses with who / which / that',
    },
    reading: { genre: 'workSituation', topic: 'The people who keep our office running' },
  },
  {
    day: 47,
    kind: 'regular',
    theme: { family: 'city', title: 'Places with a story' },
    vocabulary: {
      focus: 'Describing places',
      examples: ['historic', 'local', 'atmosphere'],
    },
    grammar: {
      topic: 'relative-clauses',
      stage: 'practice',
      objective: 'where and whose; leaving out that and which',
    },
    reading: { genre: 'travelNote', topic: 'A street where every house has a story' },
  },
  {
    day: 48,
    kind: 'regular',
    theme: { family: 'nature', title: 'City or countryside?' },
    vocabulary: {
      focus: 'City and countryside',
      examples: ['countryside', 'pollution', 'fresh air'],
    },
    grammar: {
      topic: 'comparatives',
      stage: 'practice',
      related: ['superlatives'],
      objective: '(not) as … as; much / a bit / far + comparative',
    },
    reading: {
      genre: 'opinion',
      topic: 'Why I moved to the countryside — and why my sister didn’t',
    },
  },
  {
    day: 49,
    kind: 'weeklyExam',
    theme: { family: 'technology', title: 'Digital life' },
    vocabulary: {
      focus: 'Accounts, passwords and files',
      examples: ['account', 'password', 'download'],
    },
    objective:
      'Explain how things work and what will happen if…; describe people and places precisely; compare in more detail.',
    mustRetain: [
      'Zero and first conditionals, with when / as soon as / unless',
      'Defining relative clauses: who, which, that, where, whose',
      '(not) as … as and much / a bit + comparative',
      'Words for devices, food and fitness, trips, jobs, places and the countryside',
    ],
  },
  {
    day: 50,
    kind: 'regular',
    theme: { family: 'technology', title: 'Made in…' },
    vocabulary: {
      focus: 'How things are made',
      examples: ['factory', 'material', 'recycle'],
    },
    grammar: {
      topic: 'passive',
      stage: 'introduce',
      related: ['present-perfect'],
      objective: 'Present Simple passive: is made / are produced',
    },
    reading: { genre: 'informational', topic: 'How paper is made and recycled' },
  },
  {
    day: 51,
    kind: 'regular',
    theme: { family: 'culture', title: 'Great inventions' },
    vocabulary: { focus: 'Inventions', examples: ['invent', 'discover', 'century'] },
    grammar: {
      topic: 'passive',
      stage: 'practice',
      related: ['past-simple'],
      objective: 'Past Simple passive: was invented / were built (by…)',
    },
    reading: { genre: 'story', topic: 'Who invented the bicycle?' },
  },
  {
    day: 52,
    kind: 'regular',
    theme: { family: 'communication', title: 'Online or face to face?' },
    vocabulary: {
      focus: 'Talking and texting',
      examples: ['conversation', 'misunderstand', 'face to face'],
    },
    grammar: {
      topic: 'linkers',
      stage: 'introduce',
      objective: 'because / so / but / although / however: reasons, results and contrast',
    },
    reading: { genre: 'opinion', topic: 'Is texting better than talking?' },
  },
  {
    day: 53,
    kind: 'regular',
    theme: { family: 'money', title: 'At the bank' },
    vocabulary: {
      focus: 'Banking',
      examples: ['bank account', 'loan', 'cash machine'],
    },
    grammar: {
      topic: 'indirect-questions',
      stage: 'introduce',
      related: ['wh-questions'],
      objective: 'Indirect questions: Could you tell me where…? Do you know if…?',
    },
    reading: { genre: 'dialogue', topic: 'Polite questions at the bank' },
  },
  {
    day: 54,
    kind: 'regular',
    theme: { family: 'experience', title: 'Recent news' },
    vocabulary: { focus: 'News and events', examples: ['news', 'event', 'headline'] },
    grammar: {
      topic: 'present-perfect',
      stage: 'consolidate',
      related: ['past-simple'],
      objective:
        'Present Perfect for news, Past Simple for the details: Have you heard? It happened on…',
    },
    reading: { genre: 'message', topic: 'Catching up with an old friend' },
  },
  {
    day: 55,
    kind: 'regular',
    theme: { family: 'problems', title: 'Solving everyday problems' },
    vocabulary: {
      focus: 'Problems and solutions',
      examples: ['solution', 'repair', 'complaint'],
    },
    grammar: {
      topic: 'should-advice',
      stage: 'practice',
      related: ['modals-possibility', 'verb-patterns'],
      objective: 'Advice and suggestions: should, could, Why don’t you…?, How about + -ing?',
    },
    reading: { genre: 'problemSolution', topic: 'Forum: my neighbour is too loud' },
  },
  {
    day: 56,
    kind: 'weeklyExam',
    theme: { family: 'problems', title: 'Getting help' },
    vocabulary: {
      focus: 'Getting help with a problem',
      examples: ['contact', 'urgent', 'deal with'],
    },
    objective:
      'Describe how things are made and were invented, give reasons and contrast, ask politely and give advice.',
    mustRetain: [
      'Present and past passive',
      'because / so / although / however',
      'Indirect questions',
      'Present Perfect for news, Past Simple for the details',
      'Advice and suggestions: should, could, Why don’t you…?, How about…?',
    ],
  },
  {
    day: 57,
    kind: 'regular',
    theme: { family: 'learning', title: 'How long have you been learning?' },
    vocabulary: { focus: 'Learning a skill', examples: ['skill', 'method', 'revise'] },
    grammar: {
      topic: 'present-perfect-continuous',
      stage: 'introduce',
      related: ['present-perfect', 'present-continuous'],
      objective: 'Present Perfect Continuous: How long have you been…? I’ve been learning…',
    },
    reading: { genre: 'blog', topic: 'I’ve been learning the guitar for a year' },
  },
  {
    day: 58,
    kind: 'regular',
    theme: { family: 'work', title: 'Going back to studying' },
    vocabulary: {
      focus: 'Studying as an adult',
      examples: ['qualification', 'evening course', 'enrol'],
    },
    grammar: {
      topic: 'indirect-questions',
      stage: 'practice',
      objective:
        'Indirect questions in writing: I’d like to know whether…, Could you tell me when…?',
    },
    reading: { genre: 'email', topic: 'Asking about an evening course' },
  },
  {
    day: 59,
    kind: 'regular',
    theme: { family: 'future', title: 'Goals for next month' },
    vocabulary: {
      focus: 'Setting goals',
      examples: ['target', 'realistic', 'motivate'],
    },
    grammar: {
      topic: 'first-conditional',
      stage: 'consolidate',
      related: ['zero-conditional'],
      objective: 'Real conditionals in plans: if / unless / as soon as',
    },
    reading: { genre: 'personalExperience', topic: 'My plan for next month' },
  },
  {
    day: 60,
    kind: 'regular',
    theme: { family: 'growth', title: 'Halfway there' },
    vocabulary: {
      focus: 'Describing your progress',
      examples: ['realise', 'manage', 'get better (at)'],
    },
    grammar: {
      topic: 'linkers',
      stage: 'consolidate',
      related: ['present-perfect', 'present-perfect-continuous'],
      objective:
        'Linking ideas in a short paragraph: reasons, results, contrast and purpose (to, so that)',
    },
    reading: { genre: 'blog', topic: 'Sixty days of English: what worked for me' },
  },
];
