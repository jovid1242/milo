import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { toErrorResponse } from '../src/common/error-response';
import { UsersService } from '../src/users/users.service';
import { BODY_LIMIT } from '../src/create-app';
import { register, resetDatabase, startApp, type TestApp } from './helpers';

let t: TestApp;

beforeAll(async () => {
  t = await startApp();
});
afterAll(() => t.close());

describe('health', () => {
  it('GET /health: alive, and says whether the database is', async () => {
    const response = await request(t.http).get('/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('GET /ready: ready when the database and the course are', async () => {
    const response = await request(t.http).get('/ready').expect(200);
    expect(response.body).toEqual({
      status: 'ready',
      checks: { database: 'up', course: 'up' },
    });
  });

  it('lives outside the versioned API', async () => {
    await request(t.http).get('/api/v1/health').expect(404);
  });
});

describe('errors', () => {
  it('answers an unknown route in the one error format', async () => {
    const response = await request(t.http).get('/api/v1/nowhere').expect(404);
    expect(response.body).toEqual({ code: 'NOT_FOUND', message: 'Not found.' });
  });

  it('reads malformed JSON as a validation error', async () => {
    const response = await request(t.http)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "ada@example.com",')
      .expect(400);
    expect(response.body).toEqual({ code: 'VALIDATION_ERROR', message: expect.any(String) });
  });

  it(`refuses a body over ${BODY_LIMIT}`, async () => {
    const response = await request(t.http)
      .post('/api/v1/auth/login')
      .send({ email: 'ada@example.com', password: 'x'.repeat(200_000) })
      .expect(413);
    expect(response.body).toEqual({ code: 'PAYLOAD_TOO_LARGE', message: expect.any(String) });
  });

  it('never shows a stack trace or an internal message', async () => {
    await resetDatabase(t.prisma);
    const session = await register(t.http);
    const users = t.app.get(UsersService);
    const failure = new Error('connect ECONNREFUSED 10.0.0.7:5432 at /srv/milo/users.ts:12');
    vi.spyOn(users, 'getMe').mockRejectedValueOnce(failure);
    const response = await request(t.http)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(500);
    expect(response.body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong on our side.',
    });
    expect(toErrorResponse(failure).body).not.toHaveProperty('details');
  });
});

describe('security baseline', () => {
  it('sets protective headers and hides the framework', async () => {
    const response = await request(t.http).get('/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('sends no CORS headers to origins it does not know', async () => {
    const response = await request(t.http)
      .get('/api/v1/course/current')
      .set('Origin', 'https://evil.example');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('tags every response with a request id, keeping a sane one it is given', async () => {
    const fresh = await request(t.http).get('/api/v1/course/current');
    expect(fresh.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const given = await request(t.http)
      .get('/api/v1/course/current')
      .set('X-Request-Id', 'trace-42');
    expect(given.headers['x-request-id']).toBe('trace-42');
    const odd = await request(t.http).get('/api/v1/course/current').set('X-Request-Id', '<script>');
    expect(odd.headers['x-request-id']).not.toBe('<script>');
  });

  it('keeps personal responses out of HTTP caches; the course sets its own policy', async () => {
    await resetDatabase(t.prisma);
    const session = await register(t.http);
    const me = await request(t.http)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(me.headers['cache-control']).toBe('no-store');
    const manifest = await request(t.http).get('/api/v1/course/current').expect(200);
    expect(manifest.headers['cache-control']).toBe('no-cache');
  });

  it('serves no documentation unless it is enabled', async () => {
    await request(t.http).get('/api/docs').expect(404);
  });
});
