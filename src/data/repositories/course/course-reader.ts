import { CHALLENGE } from '@/constants/challenge';
import { indexCourse, type CourseIndex } from '@/features/course/logic/course-index';
import { resolveQuestContent } from '@/features/course/logic/resolve';
import { formatIssue, validateCourse, type CourseIssue } from '@/features/course/logic/validate';
import {
  QuestContentSchema,
  type Chapter,
  type Course,
  type CourseDay,
  type CourseOutline,
  type DayNumber,
  type FinalChallenge,
  type QuestContent,
  type WeeklyExam,
} from '@/schemas';

/** A course document this app cannot use, with every error found in it. */
export class InvalidCourseError extends Error {
  constructor(readonly errors: readonly CourseIssue[]) {
    super(`The course is invalid:\n${errors.map(formatIssue).join('\n')}`);
    this.name = 'InvalidCourseError';
  }
}

/**
 * Validates a course document in full — shape, references, the rules across
 * the course, this app's day count — wherever it came from: the bundle, a
 * download or the cache. Throws `InvalidCourseError`; never returns a course
 * with errors.
 */
export function validatedCourse(document: unknown): Course {
  const result = validateCourse(document, { expectedTotalDays: CHALLENGE.totalDays });
  if (!result.ok || !result.course) {
    throw new InvalidCourseError(result.issues.filter((issue) => issue.severity === 'error'));
  }
  return result.course;
}

/**
 * Answers every `CourseRepository` question from one validated course: the
 * part the bundled and the downloaded course have in common.
 */
export class CourseReader {
  private readonly index: CourseIndex;
  private readonly contents = new Map<string, QuestContent | null>();

  constructor(course: Course) {
    this.index = indexCourse(course);
  }

  outline(): CourseOutline {
    return this.index.outline;
  }

  chapters(): Chapter[] {
    return this.index.outline.chapters;
  }

  days(): CourseDay[] {
    return this.index.outline.days;
  }

  day(day: DayNumber): CourseDay {
    const found = this.index.days.get(day);
    if (!found) throw new Error(`No course day ${day}`);
    return found;
  }

  questContent(questId: string): QuestContent | null {
    if (!this.contents.has(questId)) {
      const resolved = resolveQuestContent(this.index, questId);
      // The boundary gameplay relies on: resolved content is parsed once more.
      this.contents.set(questId, resolved ? QuestContentSchema.parse(resolved) : null);
    }
    return this.contents.get(questId) ?? null;
  }

  weeklyExam(day: DayNumber): WeeklyExam | null {
    return this.index.course.checkpoints.find((item) => item.day === day) ?? null;
  }

  finalChallenge(): FinalChallenge | null {
    return this.index.course.finalChallenge;
  }
}
