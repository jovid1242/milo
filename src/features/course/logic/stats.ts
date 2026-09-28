import type { Course, DayNumber } from '@/schemas';

import { indexCourse } from './course-index';
import { dayId } from './ids';
import { formatIssue, type CourseIssue } from './validate';

/**
 * What the course holds, honestly counted: a course whose plan has ninety
 * days but only some of them written says so — `PARTIAL` — instead of
 * pretending to be complete.
 */
export type CourseStats = {
  status: 'COMPLETE' | 'PARTIAL';
  courseId: string;
  version: number;
  days: { total: number; written: number; regular: number; checkpoints: number; summit: number };
  chapters: number;
  quests: { total: number; written: number };
  vocabulary: number;
  grammarLessons: number;
  grammarPoints: number;
  readings: number;
  /** Practice items: vocabulary, grammar and review exercises, reading questions. */
  exercises: number;
  weeklyExams: { written: number; planned: number };
  examQuestions: number;
  finalQuestions: number;
  /** Days with at least one quest still without content. */
  unwrittenDays: DayNumber[];
};

export function courseStats(course: Course): CourseStats {
  const index = indexCourse(course);
  const hasContent = (id: string) => index.definitions.has(id) || index.exams.has(id);
  const quests = course.days.flatMap((day) => day.quests);
  const written = course.days.filter((day) => day.quests.every((quest) => hasContent(quest.id)));
  const unwrittenDays = course.days
    .filter((day) => !day.quests.every((quest) => hasContent(quest.id)))
    .map((day) => day.day);
  const exercises =
    course.lessons.reduce(
      (sum, definition) =>
        sum +
        (definition.type === 'vocabulary' || definition.type === 'review'
          ? definition.exercises.length
          : 0),
      0,
    ) +
    course.grammar.reduce((sum, lesson) => sum + lesson.exercises.length, 0) +
    course.readings.reduce((sum, reading) => sum + reading.questions.length, 0);

  return {
    status: unwrittenDays.length === 0 ? 'COMPLETE' : 'PARTIAL',
    courseId: course.id,
    version: course.version,
    days: {
      total: course.days.length,
      written: written.length,
      regular: course.days.filter((day) => day.kind === 'regular').length,
      checkpoints: course.days.filter((day) => day.kind === 'weeklyExam').length,
      summit: course.days.filter((day) => day.kind === 'summit').length,
    },
    chapters: course.chapters.length,
    quests: {
      total: quests.length,
      written: quests.filter((quest) => hasContent(quest.id)).length,
    },
    vocabulary: course.vocabulary.length,
    grammarLessons: course.grammar.length,
    grammarPoints: course.grammar.reduce((sum, lesson) => sum + lesson.rule.points.length, 0),
    readings: course.readings.length,
    exercises,
    weeklyExams: {
      written: course.checkpoints.length,
      planned: quests.filter((quest) => quest.type === 'weeklyExam').length,
    },
    examQuestions: course.checkpoints.reduce((sum, exam) => sum + exam.questions.length, 0),
    finalQuestions: course.finalChallenge?.questions.length ?? 0,
    unwrittenDays,
  };
}

/** Consecutive days as ranges: d003–d006, d008. */
function dayRanges(days: readonly DayNumber[]): string {
  const ranges: string[] = [];
  let start: DayNumber | null = null;
  let previous: DayNumber | null = null;
  const close = () => {
    if (start === null || previous === null) return;
    ranges.push(start === previous ? dayId(start) : `${dayId(start)}–${dayId(previous)}`);
  };
  for (const day of days) {
    if (previous !== null && day === previous + 1) {
      previous = day;
      continue;
    }
    close();
    start = day;
    previous = day;
  }
  close();
  return ranges.join(', ');
}

/** The report `npm run content:validate` prints. */
export function formatCourseReport(
  stats: CourseStats | null,
  issues: readonly CourseIssue[],
): string {
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const lines: string[] = [];
  if (stats) {
    lines.push(
      `COURSE ${stats.courseId} · version ${stats.version}`,
      `CONTENT STATUS: ${stats.status}`,
      '',
      `Days             ${stats.days.written} / ${stats.days.total} written  (regular ${stats.days.regular}, checkpoints ${stats.days.checkpoints}, summit ${stats.days.summit})`,
      `Quests           ${stats.quests.written} / ${stats.quests.total} with content`,
      `Chapters         ${stats.chapters}`,
      `Vocabulary       ${stats.vocabulary} words`,
      `Grammar          ${stats.grammarLessons} lessons, ${stats.grammarPoints} points`,
      `Reading          ${stats.readings} texts`,
      `Exercises        ${stats.exercises}`,
      `Weekly exams     ${stats.weeklyExams.written} / ${stats.weeklyExams.planned} written, ${stats.examQuestions} questions`,
      `Final Battle     ${stats.finalQuestions} questions`,
    );
    if (stats.unwrittenDays.length > 0) {
      lines.push('', `Not written yet: ${dayRanges(stats.unwrittenDays)}`);
    }
    lines.push('');
  }
  if (warnings.length > 0) {
    lines.push(`${warnings.length} warning(s):`, ...warnings.map(formatIssue), '');
  }
  lines.push(errors.length > 0 ? `${errors.length} error(s):` : 'No errors.');
  lines.push(...errors.map(formatIssue));
  return lines.join('\n');
}
