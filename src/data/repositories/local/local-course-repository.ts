import { CHALLENGE } from '@/constants/challenge';
import { LOCAL_COURSE } from '@/content/course';
import type { CourseRepository } from '@/data/repositories/types';
import { indexCourse, type CourseIndex } from '@/features/course/logic/course-index';
import { resolveQuestContent } from '@/features/course/logic/resolve';
import { formatIssue, validateCourse } from '@/features/course/logic/validate';
import {
  QuestContentSchema,
  type Chapter,
  type CourseDay,
  type CourseOutline,
  type DayNumber,
  type FinalChallenge,
  type QuestContent,
  type WeeklyExam,
} from '@/schemas';

type Loaded = { index: CourseIndex; contents: Map<string, QuestContent | null> };

/** One validated copy per course document, however many repositories read it. */
const cache = new WeakMap<object, Loaded>();

/**
 * The course bundled with the app. It is plain data — exactly what an API
 * would send — and it is treated like it: validated in full (shape, references,
 * rules across the course) before the first read, and a course that fails is
 * never used. An `ApiCourseRepository` will do the same with the downloaded
 * document, then keep it for offline play.
 */
export class LocalCourseRepository implements CourseRepository {
  /** `source` is for tests: any course document, validated the same way. */
  constructor(private readonly source: object = LOCAL_COURSE) {}

  private load(): Loaded {
    const cached = cache.get(this.source);
    if (cached) return cached;
    const result = validateCourse(this.source, { expectedTotalDays: CHALLENGE.totalDays });
    if (!result.ok || !result.course) {
      const errors = result.issues.filter((issue) => issue.severity === 'error');
      throw new Error(`The course is invalid:\n${errors.map(formatIssue).join('\n')}`);
    }
    const loaded: Loaded = { index: indexCourse(result.course), contents: new Map() };
    cache.set(this.source, loaded);
    return loaded;
  }

  async getCourse(): Promise<CourseOutline> {
    return this.load().index.outline;
  }

  async getChapters(): Promise<Chapter[]> {
    return this.load().index.outline.chapters;
  }

  async getDays(): Promise<CourseDay[]> {
    return this.load().index.outline.days;
  }

  async getDay(day: DayNumber): Promise<CourseDay> {
    const found = this.load().index.days.get(day);
    if (!found) throw new Error(`No course day ${day}`);
    return found;
  }

  async getQuestContent(questId: string): Promise<QuestContent | null> {
    const { index, contents } = this.load();
    if (!contents.has(questId)) {
      const resolved = resolveQuestContent(index, questId);
      // The boundary gameplay relies on: resolved content is parsed once more.
      contents.set(questId, resolved ? QuestContentSchema.parse(resolved) : null);
    }
    return contents.get(questId) ?? null;
  }

  async getWeeklyExam(day: DayNumber): Promise<WeeklyExam | null> {
    const exam = this.load().index.course.checkpoints.find((item) => item.day === day);
    return exam ?? null;
  }

  async getFinalChallenge(): Promise<FinalChallenge | null> {
    return this.load().index.course.finalChallenge;
  }
}
