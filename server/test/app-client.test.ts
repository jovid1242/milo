import { createHash } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_COURSE } from '@/content/course';
import { ApiAuthRepository } from '@/data/repositories/api/api-auth-repository';
import {
  ApiCourseRepository,
  MemoryCourseCache,
} from '@/data/repositories/api/api-course-repository';
import { HttpCourseApi } from '@/data/repositories/api/course-api';
import { AuthSessionSchema, CourseManifestSchema, type AuthSession } from '@/schemas';
import { ApiClient } from '@/services/api/api-client';
import { AuthSessionManager } from '@/services/auth/auth-session';
import { MemorySessionStore } from '@/services/auth/stored-session';

import { resetDatabase, startApp, type TestApp } from './helpers';

/**
 * The app's own clients — not a re-implementation — against this server over
 * real HTTP: what the phone runs is what these tests run.
 */

const sha256 = (text: string) => Promise.resolve(createHash('sha256').update(text).digest('hex'));

let t: TestApp;

beforeAll(async () => {
  t = await startApp({ listen: true });
});
afterAll(() => t.close());

describe('the app’s ApiCourseRepository', () => {
  const launch = (cache: MemoryCourseCache, baseUrl = t.baseUrl) =>
    new ApiCourseRepository({
      api: new HttpCourseApi(new ApiClient({ baseUrl })),
      cache,
      bundled: LOCAL_COURSE,
      sha256,
    });

  it('accepts the server’s course: validated, saved, and in use from the next launch', async () => {
    const manifest = CourseManifestSchema.parse(
      (await request(t.http).get('/api/v1/course/current').expect(200)).body,
    );
    const cache = new MemoryCourseCache();
    await expect(launch(cache).check()).resolves.toEqual({ status: 'saved', version: 1 });
    expect(cache.saved).toMatchObject({ version: 1, contentHash: manifest.contentHash });

    const next = launch(cache);
    await expect(next.origin()).resolves.toMatchObject({
      source: 'cache',
      version: 1,
      contentHash: manifest.contentHash,
    });
    await expect(next.getCourse()).resolves.toMatchObject({ id: LOCAL_COURSE.id, version: 1 });
    await expect(next.getQuestContent('d001-reading')).resolves.toMatchObject({ type: 'reading' });
    // Nothing new on the server: nothing downloaded again.
    await expect(next.check()).resolves.toEqual({ status: 'current', version: 1 });
  });

  it('keeps its saved course when the server has no valid course to give', async () => {
    const cache = new MemoryCourseCache();
    await launch(cache).check();
    const saved = cache.saved;

    const broken = structuredClone(LOCAL_COURSE);
    const lesson = broken.lessons.find((item) => item.type === 'reading');
    if (!lesson || lesson.type !== 'reading') throw new Error('no reading lesson');
    lesson.readingId = 'reading-does-not-exist';
    const failing = await startApp({ listen: true, course: broken });
    try {
      await expect(launch(cache, failing.baseUrl).check()).rejects.toMatchObject({
        code: 'COURSE_UNAVAILABLE',
        status: 503,
      });
      expect(cache.saved).toBe(saved);
      await expect(launch(cache, failing.baseUrl).origin()).resolves.toMatchObject({
        source: 'cache',
      });
    } finally {
      await failing.close();
    }
  });
});

describe('the app’s auth client', () => {
  beforeEach(() => resetDatabase(t.prisma));

  function device() {
    const store = new MemorySessionStore();
    const session: AuthSessionManager = new AuthSessionManager({
      store,
      refresh: (refreshToken): Promise<AuthSession> =>
        client.request({
          method: 'POST',
          path: '/auth/refresh',
          body: { refreshToken },
          schema: AuthSessionSchema,
        }),
    });
    const client: ApiClient = new ApiClient({ baseUrl: t.baseUrl, tokens: session });
    return { auth: new ApiAuthRepository(client, session), session, store };
  }

  it('signs up, fills in the profile, survives a refused token, and logs out', async () => {
    const phone = device();
    const account = await phone.auth.register({
      email: 'ada@example.com',
      password: 'correct-horse-7',
    });
    expect(account).toMatchObject({ email: 'ada@example.com', displayName: null });

    await expect(
      phone.auth.updateProfile({ displayName: 'Ada', goal: 'habit' }),
    ).resolves.toMatchObject({ displayName: 'Ada', goal: 'habit' });

    // The access token is refused: the client refreshes on its own and retries.
    const saved = phone.store.saved;
    if (!saved) throw new Error('no session saved');
    await phone.session.start({ ...saved, accessToken: 'refused.access.token' });
    await expect(phone.auth.fetchAccount()).resolves.toMatchObject({ displayName: 'Ada' });
    expect(phone.store.saved?.refreshToken).not.toBe(saved.refreshToken);

    // A second launch restores the session from the store.
    const relaunched = device();
    relaunched.store.saved = phone.store.saved;
    await expect(relaunched.auth.restoreSession()).resolves.toMatchObject({
      email: 'ada@example.com',
    });

    const refreshToken = phone.store.saved?.refreshToken;
    await phone.auth.logout();
    expect(phone.store.saved).toBeNull();
    const refused = await request(t.http).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refused.status).toBe(401);
    expect(refused.body.code).toBe('REFRESH_TOKEN_INVALID');
  });

  it('signs out once when the server ends the session', async () => {
    const phone = device();
    await phone.auth.register({ email: 'ada@example.com', password: 'correct-horse-7' });
    const ended = vi.fn();
    phone.auth.onSessionEnded(ended);
    // The session is revoked elsewhere (a replayed token, say).
    await t.prisma.refreshSession.updateMany({ data: { revokedAt: new Date() } });

    const attempts = await Promise.allSettled(
      Array.from({ length: 5 }, () => phone.auth.fetchAccount()),
    );
    expect(attempts.every((attempt) => attempt.status === 'rejected')).toBe(true);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(phone.store.saved).toBeNull();
  });
});
