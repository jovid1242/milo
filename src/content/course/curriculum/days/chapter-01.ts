import type { DayDraft } from '../types';

/**
 * Chapter 1 · Beginning — Days 1–10, A2 refresh. Present tenses and everyday
 * questions about the learner's own life; by Day 10: "I can already say
 * useful things."
 */
export const CHAPTER_01: DayDraft[] = [
  {
    day: 1,
    kind: 'regular',
    theme: { family: 'learning', title: 'Starting the journey' },
    vocabulary: {
      focus: 'Starting to learn: goals, habits and practice',
      examples: ['journey', 'habit', 'goal'],
    },
    grammar: {
      topic: 'present-simple',
      stage: 'introduce',
      objective: 'Present Simple for habits and facts; he / she / it takes -s',
    },
    reading: { genre: 'story', topic: 'Milo packs his backpack for the journey' },
  },
  {
    day: 2,
    kind: 'regular',
    theme: { family: 'routine', title: 'Morning routine' },
    vocabulary: {
      focus: 'A morning routine: getting ready and doing things together',
      examples: ['routine', 'prepare', 'usually'],
    },
    grammar: {
      topic: 'present-simple',
      stage: 'practice',
      objective: 'He, she, it: -s, -es or -ies (works, watches, studies)',
    },
    reading: { genre: 'story', topic: 'Milo’s morning at the camp' },
  },
  {
    day: 3,
    kind: 'regular',
    theme: { family: 'self', title: 'About me' },
    vocabulary: {
      focus: 'Personal information and simple personality words',
      examples: ['hometown', 'friendly', 'shy'],
    },
    grammar: {
      topic: 'present-simple',
      stage: 'practice',
      objective: 'Questions and negatives with do / does: Do you…? She doesn’t…',
    },
    reading: { genre: 'blog', topic: 'A new member’s “About me” post' },
  },
  {
    day: 4,
    kind: 'regular',
    theme: { family: 'routine', title: 'My week' },
    vocabulary: {
      focus: 'Days, times and how often things happen',
      examples: ['weekday', 'weekend', 'early'],
    },
    grammar: {
      topic: 'adverbs-of-frequency',
      stage: 'introduce',
      related: ['present-simple'],
      objective: 'always … never and time expressions (every day, on Mondays, at 7)',
    },
    reading: { genre: 'informational', topic: 'Sleep habits: what most people usually do' },
  },
  {
    day: 5,
    kind: 'regular',
    theme: { family: 'home', title: 'What’s happening now?' },
    vocabulary: { focus: 'Everyday actions at home', examples: ['cook', 'tidy', 'relax'] },
    grammar: {
      topic: 'present-continuous',
      stage: 'introduce',
      objective: 'Present Continuous for actions happening now: I’m cooking, she isn’t working',
    },
    reading: { genre: 'message', topic: 'A family group chat on Saturday morning' },
  },
  {
    day: 6,
    kind: 'regular',
    theme: { family: 'relationships', title: 'Family and friends' },
    vocabulary: {
      focus: 'Family members, friends and neighbours',
      examples: ['parents', 'cousin', 'neighbour'],
    },
    grammar: {
      topic: 'present-continuous',
      stage: 'contrast',
      related: ['present-simple', 'adverbs-of-frequency'],
      objective: 'Present Simple vs Present Continuous: usually vs now, this week',
    },
    reading: {
      genre: 'email',
      topic: 'An email to a friend: “My sister usually…, but this week…”',
    },
  },
  {
    day: 7,
    kind: 'weeklyExam',
    theme: { family: 'learning', title: 'Checking progress' },
    vocabulary: {
      focus: 'Talking about your own progress',
      examples: ['challenge', 'mistake', 'proud'],
    },
    objective: 'Talk about yourself, your routine and what is happening now with present tenses.',
    mustRetain: [
      'Present Simple, including he / she / it spelling and do / does questions',
      'Adverbs of frequency in the right place',
      'Present Simple vs Present Continuous',
      'Words for learning, routines, personal information, time, home and family',
    ],
    revision:
      'The Week 1 exam and the Day 7 review draw only on Days 1–2, the only days written so far: widen both to Days 1–6 once those days exist.',
  },
  {
    day: 8,
    kind: 'regular',
    theme: { family: 'city', title: 'Around town' },
    vocabulary: {
      focus: 'Places in town and where they are',
      examples: ['library', 'pharmacy', 'opposite'],
    },
    grammar: {
      topic: 'there-is-are',
      stage: 'introduce',
      objective: 'There is / there are with prepositions of place (next to, opposite, between)',
    },
    reading: { genre: 'travelNote', topic: 'Notes on my new neighbourhood' },
  },
  {
    day: 9,
    kind: 'regular',
    theme: { family: 'communication', title: 'Asking for help' },
    vocabulary: {
      focus: 'Asking for help and understanding each other',
      examples: ['repeat', 'spell', 'directions'],
    },
    grammar: {
      topic: 'can-could',
      stage: 'introduce',
      objective: 'can / can’t for ability and permission; Can / Could you…? for polite requests',
    },
    reading: { genre: 'notice', topic: 'Hostel information: what you can and can’t do' },
  },
  {
    day: 10,
    kind: 'regular',
    theme: { family: 'relationships', title: 'Meeting new people' },
    vocabulary: {
      focus: 'Starting a conversation with someone new',
      examples: ['introduce', 'stranger', 'chat'],
    },
    grammar: {
      topic: 'wh-questions',
      stage: 'introduce',
      related: ['present-simple', 'present-continuous'],
      objective: 'Wh- questions with present tenses: where, when, what time, how often, why',
    },
    reading: { genre: 'dialogue', topic: 'At a language café: getting to know someone' },
  },
];
