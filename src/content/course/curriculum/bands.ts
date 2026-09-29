import type { BandProfile } from '@/schemas';

/**
 * The difficulty curve, band by band. Texts get longer and ask for more
 * inference; the review grows from six to eight exercises; Russian steps back
 * from a translation for everything to a hint behind English definitions.
 * Nothing jumps at once: each band moves one or two of these, never all.
 */
export const BAND_PROFILES: BandProfile[] = [
  {
    band: 'A2',
    level: 'A2',
    readingWords: { min: 50, max: 110 },
    readingQuestions: { min: 3, max: 3 },
    readingSkills: ['mainIdea', 'detail', 'inference'],
    review: { size: 6, today: 4 },
    support:
      'Every new word has a Russian translation; grammar is explained in simple English with Russian where it helps; texts are short and glossed.',
  },
  {
    band: 'A2+',
    level: 'A2',
    readingWords: { min: 90, max: 170 },
    readingQuestions: { min: 3, max: 4 },
    readingSkills: ['mainIdea', 'detail', 'inference'],
    review: { size: 8, today: 4 },
    support:
      'Russian translations for new words; English examples come first; Russian only for tricky grammar points.',
  },
  {
    band: 'B1-',
    level: 'B1',
    readingWords: { min: 150, max: 260 },
    readingQuestions: { min: 4, max: 4 },
    readingSkills: ['mainIdea', 'detail', 'inference', 'context'],
    review: { size: 8, today: 4 },
    support:
      'English definitions first, the Russian translation as a second hint; grammar explained in English; one word per text worked out from context.',
  },
  {
    band: 'B1',
    level: 'B1',
    readingWords: { min: 220, max: 400 },
    readingQuestions: { min: 4, max: 5 },
    readingSkills: ['mainIdea', 'detail', 'inference', 'context'],
    review: { size: 8, today: 4 },
    support:
      'English first: meaning from context and English definitions; Russian is kept for the translation of new words.',
  },
];
