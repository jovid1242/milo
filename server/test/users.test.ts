import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { UserDtoSchema } from '@/schemas';

import { bearer, register, resetDatabase, startApp, type TestApp } from './helpers';

let t: TestApp;

beforeAll(async () => {
  t = await startApp();
});
afterAll(() => t.close());
beforeEach(() => resetDatabase(t.prisma));

const patch = (accessToken: string, body: object) =>
  request(t.http)
    .patch('/api/v1/users/me')
    .set('Authorization', `Bearer ${accessToken}`)
    .send(body);

describe('GET /users/me', () => {
  it('needs a token', async () => {
    const response = await request(t.http).get('/api/v1/users/me').expect(401);
    expect(response.body).toEqual({ code: 'UNAUTHORIZED', message: expect.any(String) });
  });

  it('returns the account without any secret', async () => {
    const session = await register(t.http);
    const response = await request(t.http)
      .get('/api/v1/users/me')
      .set('Authorization', bearer(session))
      .expect(200);
    expect(UserDtoSchema.parse(response.body)).toEqual(session.user);
    expect(Object.keys(response.body).sort()).toEqual([
      'createdAt',
      'displayName',
      'email',
      'goal',
      'id',
    ]);
  });
});

describe('PATCH /users/me', () => {
  it('updates the name (trimmed) and the goal', async () => {
    const session = await register(t.http);
    const response = await patch(session.accessToken, {
      displayName: '  Ada  ',
      goal: 'habit',
    }).expect(200);
    expect(response.body).toMatchObject({ displayName: 'Ada', goal: 'habit' });
    const stored = await t.prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(stored).toMatchObject({ displayName: 'Ada', goal: 'habit' });
  });

  it('changes only what it is given; the goal can be cleared', async () => {
    const session = await register(t.http);
    await patch(session.accessToken, { displayName: 'Ada', goal: 'vocabulary' }).expect(200);
    const response = await patch(session.accessToken, { goal: null }).expect(200);
    expect(response.body).toMatchObject({ displayName: 'Ada', goal: null });
  });

  it('refuses invalid values', async () => {
    const session = await register(t.http);
    const response = await patch(session.accessToken, {
      displayName: 'A',
      goal: 'fame',
    }).expect(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details.map((detail: { path: string }) => detail.path)).toEqual([
      'displayName',
      'goal',
    ]);
  });

  it('accepts no field but the profile’s own', async () => {
    const session = await register(t.http);
    const response = await patch(session.accessToken, {
      displayName: 'Ada',
      email: 'eve@example.com',
      passwordHash: 'x',
    }).expect(400);
    expect(response.body.details).toEqual([
      { path: 'email', message: 'Unknown field' },
      { path: 'passwordHash', message: 'Unknown field' },
    ]);
    const stored = await t.prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
    expect(stored).toMatchObject({ email: 'ada@example.com', displayName: null });
  });

  it('needs something to update', async () => {
    const session = await register(t.http);
    const response = await patch(session.accessToken, {}).expect(400);
    expect(response.body.details).toEqual([{ path: '', message: 'Nothing to update' }]);
  });

  it('needs a token', async () => {
    await request(t.http).patch('/api/v1/users/me').send({ displayName: 'Ada' }).expect(401);
  });
});
