/**
 * `npm run content:validate` — checks the bundled course exactly as the app
 * does before using it (shape, references, rules across the course), then its
 * curriculum (the learning design), prints what is written and planned, and
 * fails on any error.
 *
 * Jest is only the TypeScript runner here: it already knows the `@/` paths and
 * the app's Babel setup. See jest.config.js next to this file.
 */
import { CHALLENGE } from '@/constants/challenge';
import { LOCAL_COURSE } from '@/content/course';
import {
  curriculumStats,
  formatCurriculumReport,
  validateCurriculum,
} from '@/features/course/logic/curriculum';
import { courseStats, formatCourseReport } from '@/features/course/logic/stats';
import { validateCourse } from '@/features/course/logic/validate';

test('course content', () => {
  const result = validateCourse(LOCAL_COURSE, { expectedTotalDays: CHALLENGE.totalDays });
  const stats = result.course ? courseStats(result.course) : null;
  const curriculum = result.course ? validateCurriculum(result.course) : [];
  const report = [formatCourseReport(stats, result.issues)];
  if (result.course)
    report.push('', formatCurriculumReport(curriculumStats(result.course), curriculum));
  console.log(report.join('\n'));
  const failed = !result.ok || curriculum.some((issue) => issue.severity === 'error');
  if (failed) throw new Error('The course has errors — see above.');
});
