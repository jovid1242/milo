import { logger } from '@/lib/logger';
import { COURSE_SCHEMA_VERSION, type DayNumber, type Timestamp } from '@/schemas';

import { CourseReader, validatedCourse } from '../course/course-reader';
import type { CourseOrigin, CourseRepository, CourseUpdateResult, CourseUpdates } from '../types';
import type { CourseApi } from './course-api';

/** One downloaded course, as it is kept on the device. */
export type CachedCourse = {
  courseId: string;
  version: number;
  schemaVersion: number;
  contentHash: string;
  /** The document exactly as downloaded. */
  document: string;
  savedAt: Timestamp;
};

/** Where the downloaded course is kept: SQLite in the app, memory in tests. */
export interface CourseCache {
  read(): Promise<CachedCourse | null>;
  write(course: CachedCourse): Promise<void>;
}

export class MemoryCourseCache implements CourseCache {
  constructor(public saved: CachedCourse | null = null) {}

  async read(): Promise<CachedCourse | null> {
    return this.saved;
  }

  async write(course: CachedCourse): Promise<void> {
    this.saved = course;
  }
}

export type ApiCourseRepositoryOptions = {
  api: CourseApi;
  cache: CourseCache;
  /** The course shipped with the app: used until a download has been saved. */
  bundled: object;
  /** SHA-256 of a text's UTF-8 bytes, as lowercase hex. */
  sha256: (text: string) => Promise<string>;
  now?: () => Date;
};

type Active = { reader: CourseReader; origin: CourseOrigin };

/**
 * The course from the API, built for playing offline:
 *
 *   API → hash check → JSON → full validation → SQLite cache → gameplay
 *
 * The course in use is chosen once per launch, without the network: the
 * saved download when it is still valid (and not older than the app's own),
 * else the course bundled with the app. `check()` then asks the server in the
 * background and saves a newer course for the next launch — a course never
 * changes under a running game.
 *
 * Last known good: a download that is broken, invalid or made for a newer
 * app is refused and the saved course stays exactly as it was.
 */
export class ApiCourseRepository implements CourseRepository, CourseUpdates {
  private active: Promise<Active> | null = null;
  private readonly now: () => Date;

  constructor(private readonly options: ApiCourseRepositoryOptions) {
    this.now = options.now ?? (() => new Date());
  }

  private load(): Promise<Active> {
    this.active ??= this.choose().catch((error: unknown) => {
      this.active = null; // the next read tries again
      throw error;
    });
    return this.active;
  }

  /** The bundled course's version, without validating it (it may not be needed). */
  private bundledVersion(): number {
    const version = (this.options.bundled as { version?: unknown }).version;
    return typeof version === 'number' ? version : 0;
  }

  private async choose(): Promise<Active> {
    let cached: CachedCourse | null = null;
    try {
      cached = await this.options.cache.read();
    } catch (error) {
      logger.warn('the saved course could not be read; using the bundled one', error);
    }
    if (cached) {
      try {
        if (cached.schemaVersion !== COURSE_SCHEMA_VERSION) throw new Error('another format');
        const course = validatedCourse(JSON.parse(cached.document));
        if (course.version < this.bundledVersion()) throw new Error('older than the bundled one');
        return {
          reader: new CourseReader(course),
          origin: {
            source: 'cache',
            courseId: course.id,
            version: course.version,
            contentHash: cached.contentHash,
            savedAt: cached.savedAt,
          },
        };
      } catch (error) {
        logger.warn('the saved course is unusable; using the bundled one', error);
      }
    }
    const course = validatedCourse(this.options.bundled);
    return {
      reader: new CourseReader(course),
      origin: {
        source: 'bundled',
        courseId: course.id,
        version: course.version,
        contentHash: null,
        savedAt: null,
      },
    };
  }

  async origin(): Promise<CourseOrigin> {
    return (await this.load()).origin;
  }

  async check(): Promise<CourseUpdateResult> {
    const manifest = await this.options.api.manifest();
    if (manifest.schemaVersion !== COURSE_SCHEMA_VERSION)
      return { status: 'unsupported', schemaVersion: manifest.schemaVersion };

    const saved = await this.options.cache.read().catch(() => null);
    if (
      saved?.courseId === manifest.courseId &&
      saved.version === manifest.version &&
      saved.contentHash === manifest.contentHash
    )
      return { status: 'current', version: manifest.version };

    const text = await this.options.api.document(manifest.documentPath);
    const rejected = (reason: string): CourseUpdateResult => {
      logger.warn(`course ${manifest.version} refused: ${reason}; the saved course stays`);
      return { status: 'rejected', reason };
    };
    if ((await this.options.sha256(text)) !== manifest.contentHash)
      return rejected('the document does not match its manifest');
    let document: unknown;
    try {
      document = JSON.parse(text);
    } catch {
      return rejected('the document is not JSON');
    }
    let course;
    try {
      course = validatedCourse(document);
    } catch (error) {
      return rejected(error instanceof Error ? error.message : 'the course is invalid');
    }
    if (course.id !== manifest.courseId || course.version !== manifest.version)
      return rejected('the document is not the course its manifest announced');

    await this.options.cache.write({
      courseId: course.id,
      version: course.version,
      schemaVersion: manifest.schemaVersion,
      contentHash: manifest.contentHash,
      document: text,
      savedAt: this.now().toISOString(),
    });
    return { status: 'saved', version: course.version };
  }

  async getCourse() {
    return (await this.load()).reader.outline();
  }

  async getChapters() {
    return (await this.load()).reader.chapters();
  }

  async getDays() {
    return (await this.load()).reader.days();
  }

  async getDay(day: DayNumber) {
    return (await this.load()).reader.day(day);
  }

  async getQuestContent(questId: string) {
    return (await this.load()).reader.questContent(questId);
  }

  async getWeeklyExam(day: DayNumber) {
    return (await this.load()).reader.weeklyExam(day);
  }

  async getFinalChallenge() {
    return (await this.load()).reader.finalChallenge();
  }
}
