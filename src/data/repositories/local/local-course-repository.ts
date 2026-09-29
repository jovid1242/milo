import { LOCAL_COURSE } from '@/content/course';
import type { CourseRepository } from '@/data/repositories/types';
import type {
  Chapter,
  CourseDay,
  CourseOutline,
  DayNumber,
  FinalChallenge,
  QuestContent,
  WeeklyExam,
} from '@/schemas';

import { CourseReader, validatedCourse } from '../course/course-reader';

/** One validated copy per course document, however many repositories read it. */
const readers = new WeakMap<object, CourseReader>();

/**
 * The course bundled with the app. It is plain data — exactly what the API
 * sends — and it is treated like it: validated in full (shape, references,
 * rules across the course) before the first read, and a course that fails is
 * never used. `ApiCourseRepository` does the same with the downloaded
 * document, then keeps it for offline play.
 */
export class LocalCourseRepository implements CourseRepository {
  /** `source` is for tests: any course document, validated the same way. */
  constructor(private readonly source: object = LOCAL_COURSE) {}

  private reader(): CourseReader {
    let reader = readers.get(this.source);
    if (!reader) {
      reader = new CourseReader(validatedCourse(this.source));
      readers.set(this.source, reader);
    }
    return reader;
  }

  async getCourse(): Promise<CourseOutline> {
    return this.reader().outline();
  }

  async getChapters(): Promise<Chapter[]> {
    return this.reader().chapters();
  }

  async getDays(): Promise<CourseDay[]> {
    return this.reader().days();
  }

  async getDay(day: DayNumber): Promise<CourseDay> {
    return this.reader().day(day);
  }

  async getQuestContent(questId: string): Promise<QuestContent | null> {
    return this.reader().questContent(questId);
  }

  async getWeeklyExam(day: DayNumber): Promise<WeeklyExam | null> {
    return this.reader().weeklyExam(day);
  }

  async getFinalChallenge(): Promise<FinalChallenge | null> {
    return this.reader().finalChallenge();
  }
}
