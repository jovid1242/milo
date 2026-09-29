import { createHash } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { LOCAL_COURSE } from '@/content/course';
import { validateCourse } from '@/features/course/logic/validate';
import {
  COURSE_SCHEMA_VERSION,
  CourseManifestSchema,
  CourseSchema,
  type Course,
  type CourseManifest,
} from '@/schemas';

import { startApp, type TestApp } from './helpers';

/** The raw response body, exactly as sent (after transfer decoding). */
const rawBody = (response: request.Response) => Buffer.from(response.text ?? '', 'utf8');

describe('the published course', () => {
  let t: TestApp;
  let manifest: CourseManifest;

  beforeAll(async () => {
    t = await startApp();
    const response = await request(t.http).get('/api/v1/course/current').expect(200);
    manifest = CourseManifestSchema.parse(response.body);
  });
  afterAll(() => t.close());

  it('has a small manifest: identity, version, content hash', async () => {
    expect(manifest).toMatchObject({
      courseId: LOCAL_COURSE.id,
      version: 1,
      schemaVersion: COURSE_SCHEMA_VERSION,
      totalDays: 90,
      documentPath: `/courses/${LOCAL_COURSE.id}/versions/1`,
    });
    const response = await request(t.http).get('/api/v1/course/current');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.text.length).toBeLessThan(1_000);
  });

  it('serves the document the app bundles, passing the app’s own validation', async () => {
    const response = await request(t.http)
      .get(`/api/v1${manifest.documentPath}`)
      .buffer(true)
      .expect(200)
      .expect('Content-Type', /application\/json/);
    const document: unknown = JSON.parse(response.text);
    const course: Course = CourseSchema.parse(document);
    expect(course.version).toBe(manifest.version);
    expect(validateCourse(document, { expectedTotalDays: 90 }).ok).toBe(true);
    // One course, not two copies: exactly the bundled definition.
    expect(course).toEqual(CourseSchema.parse(LOCAL_COURSE));
    expect(createHash('sha256').update(rawBody(response)).digest('hex')).toBe(manifest.contentHash);
  });

  it('is compressed for clients that accept gzip', async () => {
    const response = await request(t.http)
      .get(`/api/v1${manifest.documentPath}`)
      .set('Accept-Encoding', 'gzip')
      .expect(200);
    expect(response.headers['content-encoding']).toBe('gzip');
    expect(response.headers['vary']).toMatch(/Accept-Encoding/);
  });

  it('answers 304 when the cached copy is current', async () => {
    const first = await request(t.http).get(`/api/v1${manifest.documentPath}`).expect(200);
    expect(first.headers['etag']).toBe(`"${manifest.contentHash}"`);
    const again = await request(t.http)
      .get(`/api/v1${manifest.documentPath}`)
      .set('If-None-Match', first.headers['etag'] as string)
      .expect(304);
    expect(again.text ?? '').toBe('');
  });

  it('has no other course or version', async () => {
    for (const path of [
      `/api/v1/courses/${manifest.courseId}/versions/2`,
      `/api/v1/courses/${manifest.courseId}/versions/one`,
      '/api/v1/courses/another-course/versions/1',
    ]) {
      const response = await request(t.http).get(path).expect(404);
      expect(response.body).toEqual({ code: 'NOT_FOUND', message: expect.any(String) });
    }
  });
});

describe('an invalid course', () => {
  let t: TestApp;

  beforeAll(async () => {
    const broken = structuredClone(LOCAL_COURSE);
    // A quest reading a text that does not exist.
    const lesson = broken.lessons.find((item) => item.type === 'reading');
    if (!lesson || lesson.type !== 'reading') throw new Error('no reading lesson');
    lesson.readingId = 'reading-does-not-exist';
    t = await startApp({ course: broken });
  });
  afterAll(() => t.close());

  it('is never served', async () => {
    const current = await request(t.http).get('/api/v1/course/current').expect(503);
    expect(current.body).toEqual({ code: 'COURSE_UNAVAILABLE', message: expect.any(String) });
    await request(t.http).get(`/api/v1/courses/${LOCAL_COURSE.id}/versions/1`).expect(503);
  });

  it('makes the API not ready, while it stays alive', async () => {
    const ready = await request(t.http).get('/ready').expect(503);
    expect(ready.body).toEqual({
      status: 'not_ready',
      checks: { database: 'up', course: 'down' },
    });
    await request(t.http).get('/health').expect(200);
  });
});
