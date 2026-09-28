import type { Course } from '@/schemas';

import { CHAPTERS } from './chapters';
import { WEEK_01_EXAM } from './checkpoints/week-01';
import { WEEK_12_EXAM } from './checkpoints/week-12';
import { DAY_001 } from './days/day-001';
import { DAY_002 } from './days/day-002';
import { DAY_007 } from './days/day-007';
import { DAY_089 } from './days/day-089';
import { FINAL_CHALLENGE } from './final-challenge';
import { COURSE_META } from './meta';
import { buildCourseDays } from './plan';
import type { DayContent } from './types';

/**
 * The days written so far. The course is PARTIAL on purpose: its plan covers
 * all 90 days, and `npm run content:validate` reports which have content.
 */
const WRITTEN_DAYS: readonly DayContent[] = [DAY_001, DAY_002, DAY_007, DAY_089];

/**
 * The course as bundled with the app — plain data, exactly what an API would
 * send. Typed for authoring comfort only: `LocalCourseRepository` still
 * validates all of it at runtime before anything uses it.
 */
export const LOCAL_COURSE: Course = {
  ...COURSE_META,
  chapters: CHAPTERS,
  days: buildCourseDays(CHAPTERS, COURSE_META.totalDays),
  vocabulary: WRITTEN_DAYS.flatMap((day) => day.vocabulary),
  grammar: WRITTEN_DAYS.flatMap((day) => day.grammar),
  readings: WRITTEN_DAYS.flatMap((day) => day.readings),
  lessons: WRITTEN_DAYS.flatMap((day) => day.lessons),
  checkpoints: [WEEK_01_EXAM, WEEK_12_EXAM],
  finalChallenge: FINAL_CHALLENGE,
};
