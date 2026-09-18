import type { Chapter } from '@/schemas';

/** Taglines match the lettering on the chapter illustrations. */
export const CHAPTERS = [
  {
    id: 'beginning',
    number: 1,
    title: 'Beginning',
    tagline: 'Small steps. Big progress.',
    startDay: 1,
    endDay: 10,
  },
  {
    id: 'momentum',
    number: 2,
    title: 'Momentum',
    tagline: "Keep going. You're building it.",
    startDay: 11,
    endDay: 30,
  },
  {
    id: 'habit',
    number: 3,
    title: 'Habit',
    tagline: "It's becoming a part of you.",
    startDay: 31,
    endDay: 60,
  },
  {
    id: 'growth',
    number: 4,
    title: 'Growth',
    tagline: "You're stronger than you think.",
    startDay: 61,
    endDay: 89,
  },
  {
    id: 'summit',
    number: 5,
    title: 'Summit',
    tagline: 'You did it. A brighter you ahead.',
    startDay: 90,
    endDay: 90,
  },
] as const satisfies readonly Chapter[];
