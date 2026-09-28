/**
 * `npm run content:validate` — checks the bundled course exactly as the app
 * does before using it (shape, references, rules across the course), prints
 * what is written so far and fails on any error.
 *
 * Jest is only the TypeScript runner here: it already knows the `@/` paths and
 * the app's Babel setup. See jest.config.js next to this file.
 */
import { CHALLENGE } from '@/constants/challenge';
import { LOCAL_COURSE } from '@/content/course';
import { courseStats, formatCourseReport } from '@/features/course/logic/stats';
import { validateCourse } from '@/features/course/logic/validate';

test('course content', () => {
  const result = validateCourse(LOCAL_COURSE, { expectedTotalDays: CHALLENGE.totalDays });
  const stats = result.course ? courseStats(result.course) : null;
  console.log(formatCourseReport(stats, result.issues));
  if (!result.ok) throw new Error('The course has errors — see above.');
});
