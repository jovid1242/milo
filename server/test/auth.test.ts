import { createHmac } from 'node:crypto';

import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthSessionSchema, UserDtoSchema } from '@/schemas';

import { TokenService } from '../src/auth/token.service';
import {
  PASSWORD,
  argon2Parameters,
  bearer,
  register,
  resetDatabase,
  startApp,
  type TestApp,
} from './helpers';

let t: TestApp;

beforeAll(async () => {
  t = await startApp();
});
afterAll(() => t.close());
beforeEach(() => resetDatabase(t.prisma));

const api = () => request(t.http);
const refresh = (refreshToken: string) => api().post('/api/v1/auth/refresh').send({ refreshToken });
const logout = (refreshToken: string) => api().post('/api/v1/auth/logout').send({ refreshToken });
const me = (accessToken: string) =>
  api().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);

const errorBody = (code: string) => ({ code, message: expect.any(String) });

describe('POST /auth/register', () => {
  it('creates the account and signs in', async () => {
    const response = await api()
      .post('/api/v1/auth/register')
      .send({ email: '  Ada@Example.COM ', password: PASSWORD })
      .expect(201);
    const session = AuthSessionSchema.parse(response.body);
    expect(session.user).toMatchObject({ email: 'ada@example.com', displayName: null, goal: null });
    expect(response.body.user).not.toHaveProperty('passwordHash');
    // The access token lives for the configured 15 minutes.
    const lifetime = new Date(session.accessTokenExpiresAt).getTime() - Date.now();
    expect(lifetime).toBeGreaterThan(14 * 60_000);
    expect(lifetime).toBeLessThanOrEqual(15 * 60_000);
  });

  it('stores an argon2id hash and only a keyed hash of the refresh token', async () => {
    const session = await register(t.http);
    const user = await t.prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } });
    expect(argon2Parameters(user.passwordHash)).toEqual({ m: 19456, t: 2, p: 1 });
    expect(user.passwordHash).not.toContain(PASSWORD);

    const tokens = await t.prisma.refreshToken.findMany();
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.tokenHash).not.toContain(session.refreshToken);
    expect(tokens[0]?.tokenHash).toBe(
      createHmac('sha256', t.config.refreshToken.secret).update(session.refreshToken).digest('hex'),
    );
  });

  it('refuses an email that is taken, in any case', async () => {
    await register(t.http, 'ada@example.com');
    const response = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'ADA@example.com', password: PASSWORD })
      .expect(409);
    expect(response.body).toEqual(errorBody('EMAIL_TAKEN'));
  });

  it('refuses an invalid email', async () => {
    const response = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'ada@', password: PASSWORD })
      .expect(400);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: expect.any(String),
      details: [{ path: 'email', message: 'Enter a valid email address' }],
    });
  });

  it.each([
    ['too short', 'abc123', 'Use at least 8 characters'],
    ['no number', 'onlyletters', 'Include at least one number'],
    ['no letter', '1234567890', 'Include at least one letter'],
    ['too long', 'a1'.repeat(65), 'Use at most 128 characters'],
    ['not a string', 12345678, 'Invalid input: expected string, received number'],
  ])('refuses a weak or invalid password: %s', async (_, password, message) => {
    const response = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'ada@example.com', password })
      .expect(400);
    expect(response.body.details).toEqual([{ path: 'password', message }]);
    expect(await t.prisma.user.count()).toBe(0);
  });

  it('takes credentials only: the name comes from onboarding', async () => {
    const response = await api()
      .post('/api/v1/auth/register')
      .send({ email: 'ada@example.com', password: PASSWORD, displayName: 'Ada' })
      .expect(400);
    expect(response.body.details).toEqual([{ path: 'displayName', message: 'Unknown field' }]);
  });
});

describe('POST /auth/login', () => {
  it('signs in with the right password, as a new session', async () => {
    const registered = await register(t.http);
    const response = await api()
      .post('/api/v1/auth/login')
      .send({ email: ' ADA@example.com', password: PASSWORD })
      .expect(200);
    const session = AuthSessionSchema.parse(response.body);
    expect(session.user).toEqual(registered.user);
    expect(await t.prisma.refreshSession.count()).toBe(2);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    await register(t.http);
    const wrongPassword = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'ada@example.com', password: 'wrong-horse-7' })
      .expect(401);
    const unknownEmail = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'bob@example.com', password: PASSWORD })
      .expect(401);
    expect(wrongPassword.body).toEqual(errorBody('INVALID_CREDENTIALS'));
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates: each refresh returns the next token, which works in turn', async () => {
    const s0 = await register(t.http);
    const s1 = AuthSessionSchema.parse((await refresh(s0.refreshToken).expect(200)).body);
    expect(s1.refreshToken).not.toBe(s0.refreshToken);
    expect(s1.user).toEqual(s0.user);
    const s2 = AuthSessionSchema.parse((await refresh(s1.refreshToken).expect(200)).body);
    await me(s2.accessToken).expect(200);
    // One session, a chain of three tokens: two used, one live.
    expect(await t.prisma.refreshSession.count()).toBe(1);
    expect(await t.prisma.refreshToken.count({ where: { rotatedAt: null } })).toBe(1);
  });

  it('treats a used token presented again as a replay and ends the session', async () => {
    const s0 = await register(t.http);
    const s1 = (await refresh(s0.refreshToken).expect(200)).body;
    const s2 = (await refresh(s1.refreshToken).expect(200)).body;

    // s0 was exchanged, and what it was exchanged for was used: someone has a copy.
    expect((await refresh(s0.refreshToken).expect(401)).body).toEqual(
      errorBody('REFRESH_TOKEN_REUSED'),
    );
    // The whole session is gone, for the thief and the owner alike.
    expect((await refresh(s2.refreshToken).expect(401)).body).toEqual(
      errorBody('REFRESH_TOKEN_INVALID'),
    );
    await me(s2.accessToken).expect(401);
    const session = await t.prisma.refreshSession.findFirstOrThrow();
    expect(session.revokedReason).toBe('reuse');
  });

  it('lets a lost response be retried within the grace window', async () => {
    const s0 = await register(t.http);
    const lost = (await refresh(s0.refreshToken).expect(200)).body;
    const retry = (await refresh(s0.refreshToken).expect(200)).body;
    expect(retry.refreshToken).not.toBe(lost.refreshToken);

    // The retry's token is the one in use; the lost one is retired by it.
    await refresh(retry.refreshToken).expect(200);
    expect((await refresh(lost.refreshToken).expect(401)).body).toEqual(
      errorBody('REFRESH_TOKEN_REUSED'),
    );
  });

  it('treats a retry after the grace window as a replay', async () => {
    const s0 = await register(t.http);
    await refresh(s0.refreshToken).expect(200);
    await t.prisma.refreshToken.updateMany({
      where: { rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - t.config.refreshToken.reuseGraceMs - 1_000) },
    });
    expect((await refresh(s0.refreshToken).expect(401)).body).toEqual(
      errorBody('REFRESH_TOKEN_REUSED'),
    );
  });

  it('settles two refreshes racing with one token: the first used wins', async () => {
    const s0 = await register(t.http);
    const [a, b] = await Promise.all([refresh(s0.refreshToken), refresh(s0.refreshToken)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    await refresh(a.body.refreshToken).expect(200);
    await refresh(b.body.refreshToken).expect(401);
  });

  it('refuses an unknown, an expired or a malformed token', async () => {
    const s0 = await register(t.http);
    expect((await refresh('x'.repeat(43)).expect(401)).body).toEqual(
      errorBody('REFRESH_TOKEN_INVALID'),
    );

    await t.prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1_000) } });
    expect((await refresh(s0.refreshToken).expect(401)).body).toEqual(
      errorBody('REFRESH_TOKEN_INVALID'),
    );

    const malformed = await api().post('/api/v1/auth/refresh').send({ token: 'x' }).expect(400);
    expect(malformed.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session: its refresh and access tokens stop working', async () => {
    const session = await register(t.http);
    await logout(session.refreshToken).expect(204);
    expect((await refresh(session.refreshToken).expect(401)).body).toEqual(
      errorBody('REFRESH_TOKEN_INVALID'),
    );
    await me(session.accessToken).expect(401);
    expect((await t.prisma.refreshSession.findFirstOrThrow()).revokedReason).toBe('logout');
  });

  it('ends only this device’s session', async () => {
    const phone = await register(t.http);
    const tablet = (
      await api()
        .post('/api/v1/auth/login')
        .send({ email: 'ada@example.com', password: PASSWORD })
        .expect(200)
    ).body;
    await logout(phone.refreshToken).expect(204);
    await me(tablet.accessToken).expect(200);
    await refresh(tablet.refreshToken).expect(200);
  });

  it('is idempotent', async () => {
    const session = await register(t.http);
    await logout(session.refreshToken).expect(204);
    await logout(session.refreshToken).expect(204);
    await logout('y'.repeat(43)).expect(204);
  });
});

describe('GET /auth/me', () => {
  it('needs a valid access token', async () => {
    const session = await register(t.http);
    expect((await api().get('/api/v1/auth/me').expect(401)).body).toEqual(
      errorBody('UNAUTHORIZED'),
    );
    await me('not-a-jwt').expect(401);
    // Right shape, wrong signature.
    const [header, payload] = session.accessToken.split('.');
    await me(`${header}.${payload}.${'A'.repeat(43)}`).expect(401);
    // Expired: issued 20 minutes ago with a 15-minute lifetime.
    const tokens = t.app.get(TokenService);
    const auth = await tokens.verifyAccessToken(session.accessToken);
    const expired = await tokens.signAccessToken(auth, new Date(Date.now() - 20 * 60_000));
    await me(expired.token).expect(401);
  });

  it('returns the signed-in account', async () => {
    const session = await register(t.http);
    const response = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', bearer(session))
      .expect(200);
    expect(UserDtoSchema.parse(response.body)).toEqual(session.user);
  });
});

describe('rate limiting', () => {
  let limited: TestApp;
  beforeAll(async () => {
    limited = await startApp({ env: { AUTH_RATE_LIMIT: '3' } });
  });
  afterAll(() => limited.close());

  it('limits sign-in attempts per address', async () => {
    const attempt = () =>
      request(limited.http)
        .post('/api/v1/auth/login')
        .send({ email: 'ada@example.com', password: 'guess-number-1' });
    for (let i = 0; i < 3; i += 1) await attempt().expect(401);
    const blocked = await attempt().expect(429);
    expect(blocked.body).toEqual(errorBody('RATE_LIMITED'));
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
