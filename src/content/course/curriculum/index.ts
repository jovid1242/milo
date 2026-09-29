import type { CourseCurriculum } from '@/schemas';

import { BAND_PROFILES } from './bands';
import { CHAPTER_01 } from './days/chapter-01';
import { CHAPTER_02 } from './days/chapter-02';
import { CHAPTER_03 } from './days/chapter-03';
import { CHAPTER_04 } from './days/chapter-04';
import { SUMMIT } from './days/summit';
import { GRAMMAR_TOPICS } from './grammar-topics';
import { OUTCOMES } from './outcomes';
import { THEME_FAMILIES } from './themes';
import type { DayDraft } from './types';

/**
 * The 90-day curriculum: the learning design the course's content is written
 * against. Human-readable in docs/CURRICULUM_90_DAY.md (generated from this
 * data by `npm run curriculum:doc`), checked by `npm run content:validate`.
 */

/** The syllabus the days refer to. */
export const COURSE_CURRICULUM: CourseCurriculum = {
  bands: BAND_PROFILES,
  grammarTopics: GRAMMAR_TOPICS,
  themes: THEME_FAMILIES,
  outcomes: OUTCOMES,
};

/** One draft per day, Day 1 to Day 90. */
export const CURRICULUM_DAYS: readonly DayDraft[] = [
  ...CHAPTER_01,
  ...CHAPTER_02,
  ...CHAPTER_03,
  ...CHAPTER_04,
  SUMMIT,
];

export { attachCurriculum } from './build';
