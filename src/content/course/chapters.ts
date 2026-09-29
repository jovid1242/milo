import type { Chapter } from '@/schemas';

/**
 * The course's five chapters. Taglines match the lettering on the chapter
 * illustrations; ids are the art keys. Each chapter states its purpose and
 * its band on the difficulty curve — its days' level follows from the band.
 */
export const CHAPTERS = [
  {
    id: 'beginning',
    number: 1,
    title: 'Beginning',
    tagline: 'Small steps. Big progress.',
    band: 'A2',
    purpose:
      'Wake up the English you already have and build confidence: talk about yourself, your day and the people and places around you, in the present.',
    startDay: 1,
    endDay: 10,
  },
  {
    id: 'momentum',
    number: 2,
    title: 'Momentum',
    tagline: "Keep going. You're building it.",
    band: 'A2+',
    purpose:
      'Move from single sentences to connected descriptions: past events in order, plans and predictions, comparisons, advice and rules.',
    startDay: 11,
    endDay: 30,
  },
  {
    id: 'habit',
    number: 3,
    title: 'Habit',
    tagline: "It's becoming a part of you.",
    band: 'B1-',
    purpose:
      'Step into B1: experiences and change, past habits, possibility and real conditions, describing people, places and processes, opinions with reasons. Longer texts, meaning from context, less Russian.',
    startDay: 31,
    endDay: 60,
  },
  {
    id: 'growth',
    number: 4,
    title: 'Growth',
    tagline: "You're stronger than you think.",
    band: 'B1',
    purpose:
      'Consolidate B1: imaginary situations, deductions, narrative tenses, reported speech and linked paragraphs, with 220–400-word texts read for main idea, detail, inference and context.',
    startDay: 61,
    endDay: 89,
  },
  {
    id: 'summit',
    number: 5,
    title: 'Summit',
    tagline: 'You did it. A brighter you ahead.',
    band: 'B1',
    purpose:
      'No new material: the Final Battle shows what the learner can do across the whole course.',
    startDay: 90,
    endDay: 90,
  },
] satisfies Chapter[];
