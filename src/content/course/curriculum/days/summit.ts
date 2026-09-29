import type { DayDraft } from '../types';

/**
 * Chapter 5 · Summit — Day 90. No new material: the Final Battle samples the
 * whole way up, by what it measures rather than by trying to ask about every
 * item. Its 20 questions reuse the daily quests' own kinds of exercise.
 */
export const SUMMIT: DayDraft = {
  day: 90,
  kind: 'summit',
  theme: { family: 'learning', title: 'The summit' },
  final: {
    objective:
      'Show what 90 days built: core vocabulary remembered, grammar used in context, everyday B1 texts understood, meaning worked out from context.',
    questions: 20,
    measures: {
      vocabularyRetention: 6,
      grammarApplication: 6,
      readingComprehension: 5,
      contextInference: 3,
    },
    // Context/inference is asked through the existing sections: one word in
    // context (vocabulary) and two inference questions (reading).
    sections: { vocabulary: 7, grammar: 6, reading: 7 },
    chapters: [
      { chapterId: 'beginning', questions: 3 },
      { chapterId: 'momentum', questions: 5 },
      { chapterId: 'habit', questions: 6 },
      { chapterId: 'growth', questions: 6 },
    ],
    grammarStrands: [
      {
        title: 'Present and past tenses',
        topics: [
          'present-simple',
          'present-continuous',
          'past-simple',
          'past-continuous',
          'past-perfect',
        ],
      },
      { title: 'Present Perfect', topics: ['present-perfect', 'present-perfect-continuous'] },
      { title: 'The future', topics: ['going-to', 'will-future'] },
      {
        title: 'Modals',
        topics: [
          'can-could',
          'should-advice',
          'have-to-must',
          'modals-possibility',
          'modals-deduction',
        ],
      },
      {
        title: 'Conditionals',
        topics: ['zero-conditional', 'first-conditional', 'second-conditional'],
      },
      {
        title: 'Complex sentences',
        topics: ['relative-clauses', 'passive', 'reported-speech', 'linkers'],
      },
    ],
    passages: 2,
  },
  revision:
    'The written Final Battle predates the curriculum: its source days do not match where material is taught (the Present Continuous on Day 15, “give up” on Day 23, comparatives on Day 52) and it is balanced V8 / G7 / R5. Re-source every question from the day map and rebalance to V7 / G6 / R7: 6 retention, 6 grammar, 5 comprehension, 3 context or inference.',
};
