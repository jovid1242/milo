import type { GrammarTopic } from '@/schemas';

/**
 * The grammar syllabus, A2 → B1, in the order the course introduces it.
 * 32 topics for 77 Grammar quests: each topic is introduced once and then
 * practised, contrasted or consolidated on later days (the day map says
 * when). A topic is only introduced once its prerequisites have been.
 *
 * Deliberately out of scope (B2): the third conditional, modals in the past
 * (should have, must have), the passive beyond simple tenses and modals.
 */
const TOPICS = [
  // Chapter 1 — present foundations (A2 refresh)
  { id: 'present-simple', title: 'Present Simple', level: 'A1', prerequisites: [] },
  {
    id: 'adverbs-of-frequency',
    title: 'Adverbs of frequency',
    level: 'A2',
    prerequisites: ['present-simple'],
  },
  {
    id: 'present-continuous',
    title: 'Present Continuous',
    level: 'A1',
    prerequisites: ['present-simple'],
  },
  { id: 'there-is-are', title: 'There is / there are', level: 'A1', prerequisites: [] },
  {
    id: 'can-could',
    title: 'can / could: ability, permission, requests',
    level: 'A2',
    prerequisites: [],
  },
  {
    id: 'wh-questions',
    title: 'Questions: question words and word order',
    level: 'A2',
    prerequisites: ['present-simple'],
  },
  // Chapter 2 — past, quantity, comparing, future, modals (A2+)
  { id: 'past-simple', title: 'Past Simple', level: 'A2', prerequisites: ['present-simple'] },
  {
    id: 'quantifiers',
    title: 'Countable and uncountable nouns; some, any, much, many',
    level: 'A2',
    prerequisites: [],
  },
  { id: 'comparatives', title: 'Comparatives', level: 'A2', prerequisites: [] },
  { id: 'superlatives', title: 'Superlatives', level: 'A2', prerequisites: ['comparatives'] },
  { id: 'going-to', title: 'be going to', level: 'A2', prerequisites: [] },
  { id: 'will-future', title: 'will', level: 'A2', prerequisites: [] },
  { id: 'should-advice', title: 'should: advice', level: 'A2', prerequisites: [] },
  {
    id: 'have-to-must',
    title: 'have to / must: obligation and rules',
    level: 'A2',
    prerequisites: [],
  },
  {
    id: 'past-continuous',
    title: 'Past Continuous',
    level: 'A2',
    prerequisites: ['past-simple', 'present-continuous'],
  },
  // Chapter 3 — early B1 structures
  {
    id: 'present-perfect',
    title: 'Present Perfect',
    level: 'A2',
    prerequisites: ['past-simple'],
  },
  { id: 'used-to', title: 'used to', level: 'B1', prerequisites: ['past-simple'] },
  {
    id: 'verb-patterns',
    title: 'Verb + -ing / verb + to-infinitive',
    level: 'B1',
    prerequisites: [],
  },
  {
    id: 'modals-possibility',
    title: 'may / might / could: possibility',
    level: 'B1',
    prerequisites: ['can-could'],
  },
  {
    id: 'zero-conditional',
    title: 'Zero conditional',
    level: 'B1',
    prerequisites: ['present-simple'],
  },
  {
    id: 'first-conditional',
    title: 'First conditional',
    level: 'B1',
    prerequisites: ['zero-conditional', 'will-future'],
  },
  { id: 'relative-clauses', title: 'Relative clauses', level: 'B1', prerequisites: [] },
  { id: 'passive', title: 'The passive', level: 'B1', prerequisites: ['present-perfect'] },
  { id: 'linkers', title: 'Linking ideas', level: 'B1', prerequisites: [] },
  {
    id: 'indirect-questions',
    title: 'Indirect questions',
    level: 'B1',
    prerequisites: ['wh-questions'],
  },
  {
    id: 'present-perfect-continuous',
    title: 'Present Perfect Continuous',
    level: 'B1',
    prerequisites: ['present-perfect', 'present-continuous'],
  },
  // Chapter 4 — B1 consolidation
  {
    id: 'second-conditional',
    title: 'Second conditional',
    level: 'B1',
    prerequisites: ['first-conditional', 'past-simple'],
  },
  {
    id: 'modals-deduction',
    title: "must / might / can't: deduction",
    level: 'B1',
    prerequisites: ['modals-possibility'],
  },
  {
    id: 'past-perfect',
    title: 'Past Perfect',
    level: 'B1',
    prerequisites: ['past-simple', 'present-perfect'],
  },
  {
    id: 'reported-speech',
    title: 'Reported speech',
    level: 'B1',
    prerequisites: ['past-simple', 'will-future'],
  },
  {
    id: 'degree',
    title: 'too / enough / so / such',
    level: 'B1',
    prerequisites: ['quantifiers'],
  },
  { id: 'phrasal-verbs', title: 'Phrasal verbs', level: 'B1', prerequisites: [] },
] as const;

export type GrammarTopicId = (typeof TOPICS)[number]['id'];

export const GRAMMAR_TOPICS: GrammarTopic[] = TOPICS.map((topic) => ({
  ...topic,
  prerequisites: [...topic.prerequisites],
}));
