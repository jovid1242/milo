import { Writable } from 'node:stream';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PASSWORD, register, resetDatabase, startApp, type TestApp } from './helpers';

// nestjs-pino keeps one logger per process, built by the first app: this file
// starts the only app it has, with its log lines collected here.

describe('logging', () => {
  let logged: string;
  let app: TestApp;

  beforeAll(async () => {
    logged = '';
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        logged += chunk.toString();
        done();
      },
    });
    app = await startApp({ env: { LOG_LEVEL: 'info' }, logDestination: sink });
    await resetDatabase(app.prisma);
  });
  afterAll(() => app.close());

  it('logs each request as id, method, route, status and duration — never a secret', async () => {
    const session = await register(app.http, 'ada@example.com', PASSWORD);
    await request(app.http)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: session.refreshToken })
      .expect(200);
    await request(app.http)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);

    const lines = logged
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((line) => line['msg'] === 'request completed');
    expect(lines.map((line) => line['route'])).toEqual([
      '/api/v1/auth/register',
      '/api/v1/auth/refresh',
      '/api/v1/auth/me',
    ]);
    expect(lines[0]).toMatchObject({
      req: { id: expect.any(String), method: 'POST', path: '/api/v1/auth/register' },
      res: { statusCode: 201 },
      responseTime: expect.any(Number),
    });
    for (const secret of [PASSWORD, session.accessToken, session.refreshToken])
      expect(logged).not.toContain(secret);
  });
});
