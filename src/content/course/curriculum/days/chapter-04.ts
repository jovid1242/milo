import type { DayDraft } from '../types';

/**
 * Chapter 4 · Growth — Days 61–89, B1. Six last new topics (second
 * conditional, deduction, Past Perfect, reported speech, degree, phrasal
 * verbs), then revisits in real-life contexts; the last days only
 * consolidate. Texts reach 220–400 words, read for main idea, detail,
 * inference and context.
 */
export const CHAPTER_04: DayDraft[] = [
  {
    day: 61,
    kind: 'regular',
    theme: { family: 'decisions', title: 'If I could…' },
    vocabulary: { focus: 'Dreams and wishes', examples: ['dream', 'imagine', 'freedom'] },
    grammar: {
      topic: 'second-conditional',
      stage: 'introduce',
      related: ['first-conditional', 'past-simple'],
      objective: 'Second conditional for imaginary situations: If I had…, I would…',
    },
    reading: { genre: 'blog', topic: 'If I had a year off' },
  },
  {
    day: 62,
    kind: 'regular',
    theme: { family: 'work', title: 'A big decision' },
    vocabulary: {
      focus: 'Job choices',
      examples: ['opportunity', 'consider', 'salary'],
    },
    grammar: {
      topic: 'second-conditional',
      stage: 'contrast',
      related: ['first-conditional'],
      objective: 'Real or imaginary? The first vs the second conditional',
    },
    reading: { genre: 'dialogue', topic: 'Should I take the job in another city?' },
  },
  {
    day: 63,
    kind: 'weeklyExam',
    theme: { family: 'decisions', title: 'Making decisions' },
    vocabulary: {
      focus: 'Being sure and unsure',
      examples: ['doubt', 'certain', 'hesitate'],
    },
    objective:
      'Say how long you have been doing things, plan with real conditions, link ideas, and imagine situations with the second conditional.',
    mustRetain: [
      'Present Perfect Continuous',
      'Indirect questions in writing',
      'Real conditionals in plans: if / unless / as soon as',
      'Linking reasons, results, contrast and purpose',
      'Second conditional; first vs second',
    ],
  },
  {
    day: 64,
    kind: 'regular',
    theme: { family: 'real-life', title: 'Everyday mysteries' },
    vocabulary: {
      focus: 'Guessing and explaining',
      examples: ['clue', 'obvious', 'strange'],
    },
    grammar: {
      topic: 'modals-deduction',
      stage: 'introduce',
      related: ['modals-possibility'],
      objective: 'must / might / can’t for deductions about the present',
    },
    reading: { genre: 'story', topic: 'The mystery of the missing keys' },
  },
  {
    day: 65,
    kind: 'regular',
    theme: { family: 'challenges', title: 'Just in time' },
    vocabulary: { focus: 'Timing', examples: ['rush', 'in time', 'eventually'] },
    grammar: {
      topic: 'past-perfect',
      stage: 'introduce',
      related: ['past-simple', 'present-perfect'],
      objective: 'Past Perfect: had + past participle for the earlier past',
    },
    reading: { genre: 'personalExperience', topic: 'By the time I got to the station…' },
  },
  {
    day: 66,
    kind: 'regular',
    theme: { family: 'success', title: 'Success and failure' },
    vocabulary: {
      focus: 'Trying, failing and succeeding',
      examples: ['succeed', 'attempt', 'failure'],
    },
    grammar: {
      topic: 'past-perfect',
      stage: 'consolidate',
      related: ['past-simple', 'past-continuous'],
      objective: 'Narrative tenses together: Past Simple, Past Continuous and Past Perfect',
    },
    reading: { genre: 'story', topic: 'The athlete who never gave up' },
  },
  {
    day: 67,
    kind: 'regular',
    theme: { family: 'communication', title: 'What did they say?' },
    vocabulary: {
      focus: 'Reporting what people say',
      examples: ['mention', 'complain', 'admit'],
    },
    grammar: {
      topic: 'reported-speech',
      stage: 'introduce',
      related: ['past-simple', 'will-future'],
      objective: 'Reported statements: said / told me that…, with the tense moving back',
    },
    reading: { genre: 'workSituation', topic: 'What was said at the team meeting' },
  },
  {
    day: 68,
    kind: 'regular',
    theme: { family: 'work', title: 'The job interview' },
    vocabulary: {
      focus: 'Job interviews',
      examples: ['interview', 'strength', 'weakness'],
    },
    grammar: {
      topic: 'reported-speech',
      stage: 'practice',
      related: ['indirect-questions'],
      objective: 'Reported questions and requests: asked me if / why…; asked me to…',
    },
    reading: { genre: 'personalExperience', topic: 'They asked me why I wanted the job' },
  },
  {
    day: 69,
    kind: 'regular',
    theme: { family: 'growth', title: 'Growing as a person' },
    vocabulary: {
      focus: 'Personal growth',
      examples: ['attitude', 'potential', 'mindset'],
    },
    grammar: {
      topic: 'modals-possibility',
      stage: 'practice',
      related: ['will-future'],
      objective:
        'How sure are you? will probably, might, may not, definitely won’t — about your future',
    },
    reading: { genre: 'blog', topic: 'Where will I be in five years?' },
  },
  {
    day: 70,
    kind: 'weeklyExam',
    theme: { family: 'challenges', title: 'Learning from mistakes' },
    vocabulary: {
      focus: 'Mistakes and second chances',
      examples: ['regret', 'recover', 'warning'],
    },
    objective:
      'Make deductions, tell stories with narrative tenses, report what people said and asked, and talk about the future with degrees of certainty.',
    mustRetain: [
      'must / might / can’t for deduction',
      'Past Perfect and narrative tenses',
      'Reported statements, questions and requests',
      'will probably / might / may not for certainty',
      'Words for mysteries, timing, success, reporting, interviews and personal growth',
    ],
  },
  {
    day: 71,
    kind: 'regular',
    theme: { family: 'future', title: 'The world in 2050' },
    vocabulary: {
      focus: 'The future of the world',
      examples: ['predict', 'population', 'electric'],
    },
    grammar: {
      topic: 'will-future',
      stage: 'consolidate',
      related: ['going-to', 'present-continuous', 'modals-possibility'],
      objective: 'Future forms review: plans, arrangements, predictions and how sure you are',
    },
    reading: { genre: 'informational', topic: 'Five predictions about life in 2050' },
  },
  {
    day: 72,
    kind: 'regular',
    theme: { family: 'city', title: 'Changing cities' },
    vocabulary: {
      focus: 'Changes in a city',
      examples: ['public transport', 'pedestrian', 'construction'],
    },
    grammar: {
      topic: 'passive',
      stage: 'practice',
      related: ['will-future', 'can-could'],
      objective: 'Passive with will and can: will be built, can be used',
    },
    reading: { genre: 'notice', topic: 'City announcement: changes to the city centre' },
  },
  {
    day: 73,
    kind: 'regular',
    theme: { family: 'culture', title: 'Traditions and festivals' },
    vocabulary: {
      focus: 'Traditions and celebrations',
      examples: ['tradition', 'celebrate', 'custom'],
    },
    grammar: {
      topic: 'relative-clauses',
      stage: 'practice',
      objective: 'Non-defining relative clauses with which / who and commas',
    },
    reading: { genre: 'travelNote', topic: 'My first Navruz in Tashkent' },
  },
  {
    day: 74,
    kind: 'regular',
    theme: { family: 'habits', title: 'Building better habits' },
    vocabulary: {
      focus: 'Building and keeping habits',
      examples: ['reward', 'stick to', 'track'],
    },
    grammar: {
      topic: 'present-perfect-continuous',
      stage: 'contrast',
      related: ['present-perfect'],
      objective: 'Present Perfect Continuous vs Simple: I’ve been reading vs I’ve read',
    },
    reading: { genre: 'blog', topic: 'I’ve been tracking my habits for thirty days' },
  },
  {
    day: 75,
    kind: 'regular',
    theme: { family: 'challenges', title: 'Under pressure' },
    vocabulary: {
      focus: 'Stress and difficulty',
      examples: ['pressure', 'cope', 'tough'],
    },
    grammar: {
      topic: 'degree',
      stage: 'introduce',
      related: ['quantifiers'],
      objective: 'too / enough, and so / such … that',
    },
    reading: { genre: 'personalExperience', topic: 'The hardest week of my job' },
  },
  {
    day: 76,
    kind: 'regular',
    theme: { family: 'growth', title: 'Confidence and skills' },
    vocabulary: {
      focus: 'Speaking in front of people',
      examples: ['nervous', 'presentation', 'public speaking'],
    },
    grammar: {
      topic: 'verb-patterns',
      stage: 'practice',
      objective: '-ing after prepositions and as a subject: good at speaking; Learning English is…',
    },
    reading: {
      genre: 'problemSolution',
      topic: 'How to feel less nervous before a presentation',
    },
  },
  {
    day: 77,
    kind: 'weeklyExam',
    theme: { family: 'culture', title: 'A changing world' },
    vocabulary: {
      focus: 'Society and change',
      examples: ['society', 'generation', 'influence'],
    },
    objective:
      'Talk about the future and changing cities, describe traditions, habits and pressure, and use -ing forms confidently.',
    mustRetain: [
      'Future forms review, with how sure you are',
      'Passive with will and can',
      'Non-defining relative clauses',
      'Present Perfect Simple vs Continuous',
      'too / enough; so / such … that',
      '-ing after prepositions and as a subject',
    ],
  },
  {
    day: 78,
    kind: 'regular',
    theme: { family: 'real-life', title: 'At the hotel reception' },
    vocabulary: {
      focus: 'Hotels and services',
      examples: ['check out', 'refund', 'facilities'],
    },
    grammar: {
      topic: 'indirect-questions',
      stage: 'practice',
      related: ['wh-questions'],
      objective: 'Polite questions in services: Could you tell me…? I was wondering if…',
    },
    reading: { genre: 'dialogue', topic: 'Checking in: a problem with the booking' },
  },
  {
    day: 79,
    kind: 'regular',
    theme: { family: 'work', title: 'Rules and responsibilities' },
    vocabulary: {
      focus: 'Responsibilities at work',
      examples: ['permission', 'require', 'policy'],
    },
    grammar: {
      topic: 'have-to-must',
      stage: 'consolidate',
      related: ['should-advice'],
      objective: 'Obligation, necessity and advice: must, have to, need to, don’t need to, should',
    },
    reading: { genre: 'email', topic: 'New rules for working from home' },
  },
  {
    day: 80,
    kind: 'regular',
    theme: { family: 'relationships', title: 'Giving advice' },
    vocabulary: {
      focus: 'Getting on with people',
      examples: ['apologise', 'trust', 'forgive'],
    },
    grammar: {
      topic: 'second-conditional',
      stage: 'practice',
      related: ['should-advice'],
      objective: 'If I were you, I’d…: advice with the second conditional',
    },
    reading: { genre: 'problemSolution', topic: 'Advice column: my best friend is angry with me' },
  },
  {
    day: 81,
    kind: 'regular',
    theme: { family: 'communication', title: 'Passing on messages' },
    vocabulary: {
      focus: 'Messages and instructions',
      examples: ['remind', 'confirm', 'forward'],
    },
    grammar: {
      topic: 'reported-speech',
      stage: 'consolidate',
      objective: 'Passing on messages and instructions: told me to…, asked if…, said that…',
    },
    reading: { genre: 'workSituation', topic: 'A message from the manager' },
  },
  {
    day: 82,
    kind: 'regular',
    theme: { family: 'health', title: 'Healthy lifestyle' },
    vocabulary: { focus: 'Lifestyle', examples: ['lifestyle', 'benefit', 'effect'] },
    grammar: {
      topic: 'comparatives',
      stage: 'consolidate',
      related: ['superlatives', 'degree'],
      objective: 'The more…, the better; comparing options in detail',
    },
    reading: { genre: 'opinion', topic: 'The more you move, the better you feel?' },
  },
  {
    day: 83,
    kind: 'regular',
    theme: { family: 'home', title: 'A busy Saturday' },
    vocabulary: {
      focus: 'Everyday phrasal verbs',
      examples: ['pick up', 'find out', 'look after'],
    },
    grammar: {
      topic: 'phrasal-verbs',
      stage: 'introduce',
      objective: 'Common phrasal verbs; separable ones with pronouns: turn it off, pick her up',
    },
    reading: { genre: 'message', topic: 'Messages between flatmates' },
  },
  {
    day: 84,
    kind: 'weeklyExam',
    theme: { family: 'real-life', title: 'Everyday situations' },
    vocabulary: {
      focus: 'Sorting things out',
      examples: ['arrange', 'sort out', 'on the way'],
    },
    objective:
      'Handle real-life situations: polite questions, rules and responsibilities, advice, passing on messages, comparing lifestyles and everyday phrasal verbs.',
    mustRetain: [
      'Polite indirect questions',
      'must / have to / need to / should',
      'If I were you, I’d…',
      'Reported speech in messages and instructions',
      'The more…, the more…',
      'Common phrasal verbs',
    ],
    revision:
      'The Week 12 exam predates the curriculum: it tests the Present Perfect Continuous, the first conditional, used to and verb patterns with learning vocabulary — topics of Days 36–57, not Days 78–83. Rewrite it for the objectives above and add materialIds.',
  },
  {
    day: 85,
    kind: 'regular',
    theme: { family: 'culture', title: 'Different points of view' },
    vocabulary: {
      focus: 'Discussing opinions',
      examples: ['convince', 'fair', 'compromise'],
    },
    grammar: {
      topic: 'linkers',
      stage: 'consolidate',
      objective:
        'Organising an argument: first of all, on the other hand, in addition, in conclusion',
    },
    reading: { genre: 'opinion', topic: 'Should everyone learn a second language? Two views' },
  },
  {
    day: 86,
    kind: 'regular',
    theme: { family: 'habits', title: 'Keep going' },
    vocabulary: {
      focus: 'Phrasal verbs for goals and habits',
      examples: ['give up', 'put off', 'catch up'],
    },
    grammar: {
      topic: 'phrasal-verbs',
      stage: 'practice',
      objective: 'Phrasal verbs for habits and goals: give up, keep on, put off, catch up',
    },
    reading: { genre: 'blog', topic: 'How I stopped putting things off' },
  },
  {
    day: 87,
    kind: 'regular',
    theme: { family: 'challenges', title: 'Real-life challenges' },
    vocabulary: {
      focus: 'Difficult situations',
      examples: ['emergency', 'calm down', 'rescue'],
    },
    grammar: {
      topic: 'modals-deduction',
      stage: 'consolidate',
      related: ['can-could', 'have-to-must', 'should-advice', 'modals-possibility'],
      objective: 'Modals review: ability, obligation, advice, possibility and deduction',
    },
    reading: { genre: 'travelNote', topic: 'A difficult journey home' },
  },
  {
    day: 88,
    kind: 'regular',
    theme: { family: 'self', title: 'Who I am now' },
    vocabulary: {
      focus: 'Describing character',
      examples: ['ambitious', 'honest', 'independent'],
    },
    grammar: {
      topic: 'present-perfect-continuous',
      stage: 'consolidate',
      related: ['present-simple', 'present-continuous', 'present-perfect'],
      objective: 'Present tenses review: simple, continuous, perfect and perfect continuous',
    },
    reading: { genre: 'personalExperience', topic: 'Three months that changed me' },
  },
  {
    day: 89,
    kind: 'regular',
    theme: { family: 'learning', title: 'Looking back and ahead' },
    vocabulary: {
      focus: 'Achievement and progress',
      examples: ['achievement', 'progress', 'overcome'],
    },
    grammar: {
      topic: 'present-perfect',
      stage: 'consolidate',
      related: ['past-simple', 'used-to', 'will-future', 'going-to'],
      objective: 'Your story in tenses: used to, Past Simple, Present Perfect and the future',
    },
    reading: { genre: 'story', topic: 'Small steps: Kamila looks back on her English' },
    revision:
      'Grammar: the written lesson introduces Present Perfect vs Past Simple as new material; in the curriculum that contrast is Day 34, and Day 89 consolidates tenses across the whole story (used to → Past Simple → Present Perfect → future). Move the contrast lesson to Day 34 and write a consolidation lesson here. Review: add recent (Days 87, 82) and older (Day 68) material once those days exist.',
  },
];
