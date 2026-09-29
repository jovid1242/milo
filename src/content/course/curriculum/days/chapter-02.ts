import type { DayDraft } from '../types';

/**
 * Chapter 2 · Momentum — Days 11–30, A2+. From single sentences to events
 * and plans: the past in order, food and shopping, comparing, the future,
 * advice and rules — ending with stories that mix two past tenses.
 */
export const CHAPTER_02: DayDraft[] = [
  {
    day: 11,
    kind: 'regular',
    theme: { family: 'free-time', title: 'Last weekend' },
    vocabulary: {
      focus: 'Weekend activities and how they felt',
      examples: ['stay in', 'go out', 'relaxing'],
    },
    grammar: {
      topic: 'past-simple',
      stage: 'introduce',
      objective: 'Past Simple of be (was / were) with yesterday, last…, …ago',
    },
    reading: { genre: 'message', topic: 'How was your weekend? (chat)' },
  },
  {
    day: 12,
    kind: 'regular',
    theme: { family: 'work', title: 'A day at work' },
    vocabulary: {
      focus: 'Everyday work and study',
      examples: ['meeting', 'deadline', 'break'],
    },
    grammar: {
      topic: 'past-simple',
      stage: 'practice',
      objective: 'Regular verbs: -ed spelling and pronunciation',
    },
    reading: { genre: 'workSituation', topic: 'Aziza’s first week at a new office' },
  },
  {
    day: 13,
    kind: 'regular',
    theme: { family: 'travel', title: 'A trip to remember' },
    vocabulary: {
      focus: 'Travelling by train and bus',
      examples: ['ticket', 'luggage', 'miss (a train)'],
    },
    grammar: {
      topic: 'past-simple',
      stage: 'practice',
      objective: 'Common irregular verbs: went, saw, took, bought, had',
    },
    reading: { genre: 'travelNote', topic: 'A weekend in Samarkand: a travel diary' },
  },
  {
    day: 14,
    kind: 'weeklyExam',
    theme: { family: 'experience', title: 'Memories and moments' },
    vocabulary: {
      focus: 'Talking about memories',
      examples: ['memory', 'moment', 'surprise'],
    },
    objective:
      'Describe places, ask for help and get to know people; say what happened at the weekend, at work or on a trip.',
    mustRetain: [
      'There is / there are with prepositions of place',
      'can / could for ability, permission and requests',
      'Wh- questions with present tenses',
      'Past Simple: was / were, regular and common irregular verbs',
    ],
  },
  {
    day: 15,
    kind: 'regular',
    theme: { family: 'health', title: 'At the doctor’s' },
    vocabulary: {
      focus: 'Feeling ill and getting better',
      examples: ['headache', 'cough', 'medicine'],
    },
    grammar: {
      topic: 'past-simple',
      stage: 'practice',
      related: ['wh-questions'],
      objective: 'Questions and negatives: Did you…? I didn’t…; When did it start?',
    },
    reading: { genre: 'dialogue', topic: 'A visit to the doctor' },
  },
  {
    day: 16,
    kind: 'regular',
    theme: { family: 'problems', title: 'A bad day' },
    vocabulary: {
      focus: 'Small everyday problems',
      examples: ['lose', 'queue', 'battery'],
    },
    grammar: {
      topic: 'past-simple',
      stage: 'consolidate',
      objective: 'Telling a story in order: first, then, after that, finally',
    },
    reading: { genre: 'story', topic: 'Everything went wrong on Monday' },
  },
  {
    day: 17,
    kind: 'regular',
    theme: { family: 'food', title: 'In the kitchen' },
    vocabulary: {
      focus: 'Food and cooking',
      examples: ['ingredient', 'vegetables', 'fridge'],
    },
    grammar: {
      topic: 'quantifiers',
      stage: 'introduce',
      related: ['there-is-are'],
      objective: 'Countable and uncountable nouns; a / an, some, any (Is there any milk?)',
    },
    reading: { genre: 'informational', topic: 'A simple recipe: vegetable soup' },
  },
  {
    day: 18,
    kind: 'regular',
    theme: { family: 'shopping', title: 'At the market' },
    vocabulary: { focus: 'Buying and paying', examples: ['price', 'cash', 'receipt'] },
    grammar: {
      topic: 'quantifiers',
      stage: 'practice',
      objective: 'much / many / a lot of; How much…? How many…?',
    },
    reading: { genre: 'dialogue', topic: 'Buying fruit at the market' },
  },
  {
    day: 19,
    kind: 'regular',
    theme: { family: 'technology', title: 'Choosing a phone' },
    vocabulary: {
      focus: 'Describing products',
      examples: ['light (weight)', 'reliable', 'screen'],
    },
    grammar: {
      topic: 'comparatives',
      stage: 'introduce',
      objective: 'Comparatives: -er / more … than; better, worse',
    },
    reading: { genre: 'opinion', topic: 'Two customer reviews of two phones' },
  },
  {
    day: 20,
    kind: 'regular',
    theme: { family: 'city', title: 'The best places in town' },
    vocabulary: {
      focus: 'Sights and places to visit',
      examples: ['museum', 'crowded', 'famous'],
    },
    grammar: {
      topic: 'superlatives',
      stage: 'introduce',
      related: ['comparatives'],
      objective: 'Superlatives: the -est / the most; the best, the worst',
    },
    reading: { genre: 'blog', topic: 'The top three places in my city' },
  },
  {
    day: 21,
    kind: 'weeklyExam',
    theme: { family: 'decisions', title: 'Comparing and choosing' },
    vocabulary: {
      focus: 'Comparing options and choosing',
      examples: ['compare', 'prefer', 'option'],
    },
    objective:
      'Tell a short story in order and ask about the past; talk about food, shopping and choosing between things.',
    mustRetain: [
      'Past Simple questions and negatives',
      'Sequencing a story: first, then, after that, finally',
      'Countable and uncountable nouns with some / any / much / many',
      'Comparatives and superlatives',
    ],
  },
  {
    day: 22,
    kind: 'regular',
    theme: { family: 'future', title: 'Weekend plans' },
    vocabulary: { focus: 'Making plans', examples: ['invite', 'organise', 'picnic'] },
    grammar: {
      topic: 'going-to',
      stage: 'introduce',
      objective: 'be going to for plans and intentions',
    },
    reading: { genre: 'message', topic: 'Planning a picnic in a group chat' },
  },
  {
    day: 23,
    kind: 'regular',
    theme: { family: 'relationships', title: 'Making arrangements' },
    vocabulary: {
      focus: 'Arranging to meet',
      examples: ['book (a table)', 'cancel', 'available'],
    },
    grammar: {
      topic: 'present-continuous',
      stage: 'practice',
      related: ['going-to'],
      objective: 'Present Continuous for fixed arrangements: I’m meeting Sara on Friday',
    },
    reading: { genre: 'email', topic: 'Arranging to meet an old friend' },
  },
  {
    day: 24,
    kind: 'regular',
    theme: { family: 'communication', title: 'Offers and promises' },
    vocabulary: { focus: 'Helping each other', examples: ['offer', 'promise', 'lend'] },
    grammar: {
      topic: 'will-future',
      stage: 'introduce',
      objective: 'will for offers, promises and quick decisions: I’ll help you',
    },
    reading: { genre: 'dialogue', topic: 'Moving house: friends offer to help' },
  },
  {
    day: 25,
    kind: 'regular',
    theme: { family: 'nature', title: 'Weather and plans' },
    vocabulary: {
      focus: 'The weather',
      examples: ['forecast', 'temperature', 'storm'],
    },
    grammar: {
      topic: 'will-future',
      stage: 'contrast',
      related: ['going-to', 'present-continuous'],
      objective: 'will vs going to vs Present Continuous: predictions, plans, arrangements',
    },
    reading: { genre: 'informational', topic: 'The weekend weather forecast' },
  },
  {
    day: 26,
    kind: 'regular',
    theme: { family: 'health', title: 'Staying healthy' },
    vocabulary: { focus: 'Wellbeing', examples: ['sleep', 'stress', 'healthy'] },
    grammar: {
      topic: 'should-advice',
      stage: 'introduce',
      objective: 'should / shouldn’t for advice',
    },
    reading: { genre: 'problemSolution', topic: 'Advice column: “I’m always tired”' },
  },
  {
    day: 27,
    kind: 'regular',
    theme: { family: 'work', title: 'Rules at work' },
    vocabulary: {
      focus: 'People and rules at work',
      examples: ['colleague', 'manager', 'uniform'],
    },
    grammar: {
      topic: 'have-to-must',
      stage: 'introduce',
      objective: 'have to / don’t have to / must / mustn’t for rules and obligations',
    },
    reading: { genre: 'workSituation', topic: 'First-day rules at a café' },
  },
  {
    day: 28,
    kind: 'weeklyExam',
    theme: { family: 'future', title: 'Planning ahead' },
    vocabulary: {
      focus: 'Planning ahead and staying organised',
      examples: ['priority', 'reminder', 'schedule'],
    },
    objective: 'Talk about plans, arrangements and predictions; give advice and explain rules.',
    mustRetain: [
      'going to, will and the Present Continuous for the future',
      'should / shouldn’t for advice',
      'have to / don’t have to / must / mustn’t',
      'Words for plans, arrangements, weather, health and work',
    ],
  },
  {
    day: 29,
    kind: 'regular',
    theme: { family: 'experience', title: 'What were you doing?' },
    vocabulary: {
      focus: 'Sudden events',
      examples: ['suddenly', 'noise', 'power cut'],
    },
    grammar: {
      topic: 'past-continuous',
      stage: 'introduce',
      related: ['past-simple'],
      objective: 'Past Continuous for actions in progress in the past: I was reading when…',
    },
    reading: { genre: 'story', topic: 'The night the lights went out' },
  },
  {
    day: 30,
    kind: 'regular',
    theme: { family: 'travel', title: 'A travel problem' },
    vocabulary: {
      focus: 'Problems at the airport and station',
      examples: ['delay', 'passport', 'announcement'],
    },
    grammar: {
      topic: 'past-continuous',
      stage: 'contrast',
      related: ['past-simple'],
      objective: 'Past Continuous vs Past Simple with when / while',
    },
    reading: { genre: 'personalExperience', topic: 'The day I nearly missed my flight' },
  },
];
