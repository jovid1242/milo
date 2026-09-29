import { LOCAL_COURSE } from '@/content/course';
import { COURSE_SCHEMA_VERSION, type Course, type CourseManifest } from '@/schemas';
import { ApiError } from '@/services/api/api-error';

import {
  ApiCourseRepository,
  MemoryCourseCache,
  type CachedCourse,
} from '../api-course-repository';
import type { CourseApi } from '../course-api';

// Jest runs in Node; the app's tsconfig has no Node types, so `crypto` is typed here.
declare const require: (id: 'crypto') => unknown;
const { createHash } = require('crypto') as {
  createHash: (algorithm: 'sha256') => {
    update: (text: string) => { digest: (encoding: 'hex') => string };
  };
};
const hashOf = (text: string) => createHash('sha256').update(text).digest('hex');
const sha256 = async (text: string) => hashOf(text);

const NOW = new Date('2026-09-29T09:00:00.000Z');
const VALID = JSON.stringify(LOCAL_COURSE);

const manifestFor = (text: string, overrides: Partial<CourseManifest> = {}): CourseManifest => ({
  courseId: LOCAL_COURSE.id,
  version: LOCAL_COURSE.version,
  schemaVersion: COURSE_SCHEMA_VERSION,
  title: LOCAL_COURSE.title,
  language: LOCAL_COURSE.language,
  supportLanguage: LOCAL_COURSE.supportLanguage,
  totalDays: LOCAL_COURSE.totalDays,
  contentHash: hashOf(text),
  documentPath: `/courses/${LOCAL_COURSE.id}/versions/${LOCAL_COURSE.version}`,
  ...overrides,
});

/** A server whose course can change between checks; counts downloads. */
function fakeServer(text = VALID, manifest = manifestFor(text)) {
  const state = { text, manifest, downloads: 0, offline: false };
  const api: CourseApi = {
    manifest: async () => {
      if (state.offline) throw new ApiError('NETWORK_ERROR', 'offline');
      return state.manifest;
    },
    document: async () => {
      if (state.offline) throw new ApiError('NETWORK_ERROR', 'offline');
      state.downloads += 1;
      return state.text;
    },
  };
  return {
    api,
    state,
    serve(next: string, overrides: Partial<CourseManifest> = {}) {
      state.text = next;
      state.manifest = manifestFor(next, overrides);
    },
  };
}

const launch = (api: CourseApi, cache: MemoryCourseCache, bundled: object = LOCAL_COURSE) =>
  new ApiCourseRepository({ api, cache, bundled, sha256, now: () => NOW });

/** A course that fails validation: a quest reading a text that does not exist. */
function invalidCourse(version: number): Course {
  const broken = structuredClone(LOCAL_COURSE);
  broken.version = version;
  const lesson = broken.lessons.find((item) => item.type === 'reading');
  if (!lesson || lesson.type !== 'reading') throw new Error('no reading lesson');
  lesson.readingId = 'reading-does-not-exist';
  return broken;
}

describe('ApiCourseRepository', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('accepts the server’s course: validated, saved, and used from the next launch', async () => {
    const server = fakeServer();
    const cache = new MemoryCourseCache();
    const first = launch(server.api, cache);

    await expect(first.origin()).resolves.toMatchObject({ source: 'bundled', version: 1 });
    await expect(first.check()).resolves.toEqual({ status: 'saved', version: 1 });
    expect(cache.saved).toMatchObject({
      courseId: LOCAL_COURSE.id,
      version: 1,
      schemaVersion: COURSE_SCHEMA_VERSION,
      contentHash: hashOf(VALID),
      savedAt: NOW.toISOString(),
    });
    // Never under a running game: this launch keeps the course it started with.
    await expect(first.origin()).resolves.toMatchObject({ source: 'bundled' });

    const next = launch(server.api, cache);
    await expect(next.origin()).resolves.toEqual({
      source: 'cache',
      courseId: LOCAL_COURSE.id,
      version: 1,
      contentHash: hashOf(VALID),
      savedAt: NOW.toISOString(),
    });
    await expect(next.getDay(1)).resolves.toMatchObject({ day: 1 });
    await expect(next.getQuestContent('d001-vocabulary')).resolves.toMatchObject({
      type: 'vocabulary',
    });
  });

  it('downloads the document only when the manifest says it changed', async () => {
    const server = fakeServer();
    const repository = launch(server.api, new MemoryCourseCache());
    await repository.check();
    await expect(repository.check()).resolves.toEqual({ status: 'current', version: 1 });
    await expect(repository.check()).resolves.toEqual({ status: 'current', version: 1 });
    expect(server.state.downloads).toBe(1);
  });

  it('keeps the last known good course whatever the server sends next', async () => {
    const server = fakeServer();
    const cache = new MemoryCourseCache();
    await launch(server.api, cache).check();
    const good = cache.saved;

    const refusals: [string, () => void][] = [
      ['broken JSON', () => server.serve('{"id": "milo-english-90", "days": [', { version: 2 })],
      ['an invalid course', () => server.serve(JSON.stringify(invalidCourse(2)), { version: 2 })],
      [
        'a document that is not the one announced',
        () => {
          server.serve(VALID, { version: 2 });
        },
      ],
      [
        'bytes that do not match the hash',
        () => {
          server.serve(JSON.stringify({ ...LOCAL_COURSE, version: 2 }), { version: 2 });
          server.state.manifest = {
            ...server.state.manifest,
            contentHash: hashOf('something else'),
          };
        },
      ],
    ];
    for (const [, serveBadCourse] of refusals) {
      serveBadCourse();
      warn.mockClear();
      const repository = launch(server.api, cache);
      await expect(repository.check()).resolves.toMatchObject({ status: 'rejected' });
      expect(cache.saved).toBe(good);
      // A controlled, logged refusal — never a crash.
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/course 2 refused/), '');
    }

    // The game still runs on the course it had.
    const next = launch(server.api, cache);
    await expect(next.origin()).resolves.toMatchObject({ source: 'cache', version: 1 });
    await expect(next.getWeeklyExam(7)).resolves.toMatchObject({ day: 7 });
  });

  it('leaves a course made for a newer app alone', async () => {
    const server = fakeServer();
    const cache = new MemoryCourseCache();
    await launch(server.api, cache).check();
    server.serve(VALID, { schemaVersion: COURSE_SCHEMA_VERSION + 1, version: 2 });
    await expect(launch(server.api, cache).check()).resolves.toEqual({
      status: 'unsupported',
      schemaVersion: COURSE_SCHEMA_VERSION + 1,
    });
    expect(server.state.downloads).toBe(1);
    expect(cache.saved?.version).toBe(1);
  });

  it('plays offline from the saved course', async () => {
    const server = fakeServer();
    const cache = new MemoryCourseCache();
    await launch(server.api, cache).check();
    server.state.offline = true;

    const offline = launch(server.api, cache);
    await expect(offline.check()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    await expect(offline.origin()).resolves.toMatchObject({ source: 'cache', version: 1 });
    await expect(offline.getQuestContent('d002-grammar')).resolves.toMatchObject({
      type: 'grammar',
    });
  });

  it('falls back to the bundled course when nothing usable is saved', async () => {
    const server = fakeServer();
    server.state.offline = true;
    // First launch, offline.
    await expect(launch(server.api, new MemoryCourseCache()).origin()).resolves.toMatchObject({
      source: 'bundled',
    });
    // A saved entry that no longer reads.
    const corrupt: CachedCourse = {
      courseId: LOCAL_COURSE.id,
      version: 1,
      schemaVersion: COURSE_SCHEMA_VERSION,
      contentHash: hashOf('{'),
      document: '{',
      savedAt: NOW.toISOString(),
    };
    const repository = launch(server.api, new MemoryCourseCache(corrupt));
    await expect(repository.origin()).resolves.toMatchObject({ source: 'bundled' });
    await expect(repository.getDays()).resolves.toHaveLength(90);
  });

  it('prefers an app update’s newer bundled course to an older download', async () => {
    const server = fakeServer();
    const cache = new MemoryCourseCache();
    await launch(server.api, cache).check();
    const updatedApp = { ...structuredClone(LOCAL_COURSE), version: 2 };
    await expect(launch(server.api, cache, updatedApp).origin()).resolves.toMatchObject({
      source: 'bundled',
      version: 2,
    });
  });
});
