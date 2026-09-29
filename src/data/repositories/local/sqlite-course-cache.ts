import { getDatabase, writeDatabase } from '@/data/db/database';

import type { CachedCourse, CourseCache } from '../api/api-course-repository';

type Row = {
  course_id: string;
  version: number;
  schema_version: number;
  content_hash: string;
  document: string;
  saved_at: string;
};

/**
 * The downloaded course, in the app's own SQLite database (one row, replaced
 * whole): no second storage stack, and it survives restarts and offline
 * launches alike.
 */
export class SqliteCourseCache implements CourseCache {
  async read(): Promise<CachedCourse | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<Row>(
      'SELECT course_id, version, schema_version, content_hash, document, saved_at FROM course_cache WHERE slot = 1',
    );
    if (!row) return null;
    return {
      courseId: row.course_id,
      version: row.version,
      schemaVersion: row.schema_version,
      contentHash: row.content_hash,
      document: row.document,
      savedAt: row.saved_at,
    };
  }

  write(course: CachedCourse): Promise<void> {
    return writeDatabase(async (db) => {
      await db.runAsync(
        `INSERT OR REPLACE INTO course_cache
           (slot, course_id, version, schema_version, content_hash, document, saved_at)
         VALUES (1, ?, ?, ?, ?, ?, ?)`,
        [
          course.courseId,
          course.version,
          course.schemaVersion,
          course.contentHash,
          course.document,
          course.savedAt,
        ],
      );
    });
  }
}
