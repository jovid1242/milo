import type { CourseMeta } from '@/schemas';

/**
 * The course's identity. `version` goes up whenever published content changes
 * in a way progress should know about; progress records the version it was
 * earned on.
 */
export const COURSE_META: CourseMeta = {
  id: 'milo-english-90',
  version: 1,
  title: '90 Day English Challenge',
  language: 'en',
  supportLanguage: 'ru',
  totalDays: 90,
};
