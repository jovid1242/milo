import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';

import { CHALLENGE } from '@/constants/challenge';
import { CourseReader } from '@/data/repositories/course/course-reader';
import { formatIssue, validateCourse } from '@/features/course/logic/validate';
import { COURSE_SCHEMA_VERSION, type CourseManifest } from '@/schemas';

import { ApiException } from '../common/api-exception';
import { CourseContent } from '../progress/challenge-work';

/** The course document to publish: the app's version-controlled course unless a test swaps it. */
export const COURSE_SOURCE = Symbol('COURSE_SOURCE');

/** A validated course, serialized once: the bytes every client downloads. */
export type PublishedCourse = {
  manifest: CourseManifest;
  /** Strong ETag: the document's SHA-256. */
  etag: string;
  json: Buffer;
  gzip: Buffer;
};

const unavailable = () =>
  new ApiException(503, 'COURSE_UNAVAILABLE', 'The course is not available right now.');

/**
 * Publishes the same course definition the app bundles — one source, in the
 * repository, never a copy in the database. It is validated exactly as the
 * app validates it (shape, references, rules across the course) when the
 * server starts; a course that fails is never served.
 */
@Injectable()
export class CourseService implements OnModuleInit {
  private readonly logger = new Logger(CourseService.name);
  private published: PublishedCourse | null = null;
  private contents: CourseContent | null = null;

  constructor(@Inject(COURSE_SOURCE) private readonly source: unknown) {}

  onModuleInit(): void {
    const result = validateCourse(this.source, { expectedTotalDays: CHALLENGE.totalDays });
    if (!result.ok || !result.course) {
      const errors = result.issues.filter((issue) => issue.severity === 'error');
      this.logger.error(
        { errors: errors.slice(0, 20).map(formatIssue), total: errors.length },
        'The course is invalid and will not be served',
      );
      return;
    }
    const course = result.course;
    const json = Buffer.from(JSON.stringify(course));
    const contentHash = createHash('sha256').update(json).digest('hex');
    this.published = {
      manifest: {
        courseId: course.id,
        version: course.version,
        schemaVersion: COURSE_SCHEMA_VERSION,
        title: course.title,
        language: course.language,
        supportLanguage: course.supportLanguage,
        totalDays: course.totalDays,
        contentHash,
        documentPath: `/courses/${course.id}/versions/${course.version}`,
      },
      etag: `"${contentHash}"`,
      json,
      gzip: gzipSync(json),
    };
    this.contents = new CourseContent(course.id, course.version, new CourseReader(course));
    this.logger.log(
      {
        courseId: course.id,
        version: course.version,
        bytes: json.length,
        gzipBytes: this.published.gzip.length,
      },
      'Course published',
    );
  }

  get available(): boolean {
    return this.published !== null;
  }

  /** The published course's content: what progress is checked against. */
  content(): CourseContent {
    if (!this.contents) throw unavailable();
    return this.contents;
  }

  manifest(): CourseManifest {
    if (!this.published) throw unavailable();
    return this.published.manifest;
  }

  /** One exact version. Only the current one is published; any other id or version is a 404. */
  document(courseId: string, version: string): PublishedCourse {
    if (!this.published) throw unavailable();
    const { manifest } = this.published;
    if (courseId !== manifest.courseId || version !== String(manifest.version))
      throw new ApiException(404, 'NOT_FOUND', 'No such course version.');
    return this.published;
  }
}
