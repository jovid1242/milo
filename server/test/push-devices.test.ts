import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AuthSessionSchema, type AuthSession } from '@/schemas';

import {
  bearer,
  PASSWORD,
  register,
  resetDatabase,
  startApp,
  TestClock,
  type TestApp,
} from './helpers';
import { FakeExpo, pushToken, registerDevice } from './push-fixtures';

/**
 * Which devices get team notifications: a signed-in session that registered
 * its Expo push token. The token is the session's alone, and ends with it.
 */

const clock = new TestClock(new Date('2026-09-01T10:00:00.000Z'));
let t: TestApp;

beforeAll(async () => {
  t = await startApp({ clock, pushTransport: new FakeExpo() });
});
afterAll(() => t.close());

beforeEach(async () => {
  await resetDatabase(t.prisma);
  clock.set('2026-09-01T10:00:00.000Z');
});

async function login(email: string): Promise<AuthSession> {
  const response = await request(t.http)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return AuthSessionSchema.parse(response.body);
}

const devicesOf = (userId: string) =>
  t.prisma.pushDevice.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });

const sessionOf = async (session: AuthSession) =>
  (
    await t.prisma.refreshToken.findFirstOrThrow({
      where: { session: { userId: session.user.id } },
      orderBy: { createdAt: 'desc' },
      select: { sessionId: true },
    })
  ).sessionId;

describe('registering a device', () => {
  it('ties the token to the signed-in session; registering again changes nothing', async () => {
    const ada = await register(t.http, 'ada@example.com');
    const token = pushToken();
    await registerDevice(t.http, ada, token);
    const [device] = await devicesOf(ada.user.id);
    expect(device).toMatchObject({
      userId: ada.user.id,
      sessionId: await sessionOf(ada),
      token,
      platform: 'android',
    });

    clock.advanceMinutes(5);
    await registerDevice(t.http, ada, token);
    const again = await devicesOf(ada.user.id);
    expect(again).toHaveLength(1);
    expect(again[0]?.id).toBe(device?.id);
    expect(again[0]?.updatedAt).toEqual(new Date('2026-09-01T10:05:00.000Z'));
  });

  it('is refused without a live session, and for anything but an Expo push token', async () => {
    const token = pushToken();
    await request(t.http)
      .put('/api/v1/push/devices/current')
      .send({ token, platform: 'android' })
      .expect(401);
    await request(t.http)
      .put('/api/v1/push/devices/current')
      .set('Authorization', 'Bearer not-a-token')
      .send({ token, platform: 'android' })
      .expect(401);

    const ada = await register(t.http, 'ada@example.com');
    for (const body of [
      { token: 'fcm-token-123', platform: 'android' },
      { token: 'ExponentPushToken[]', platform: 'android' },
      { token, platform: 'windows' },
      { token, platform: 'android', userId: ada.user.id },
      { token: `ExponentPushToken[${'a'.repeat(300)}]`, platform: 'android' },
    ]) {
      await request(t.http)
        .put('/api/v1/push/devices/current')
        .set('Authorization', bearer(ada))
        .send(body)
        .expect(400);
    }

    // A signed-out session's access token no longer registers anything.
    await request(t.http)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: ada.refreshToken })
      .expect(204);
    await request(t.http)
      .put('/api/v1/push/devices/current')
      .set('Authorization', bearer(ada))
      .send({ token, platform: 'android' })
      .expect(401);
    expect(await t.prisma.pushDevice.count()).toBe(0);
  });

  it('keeps one token per session: a new token from the system replaces the old one', async () => {
    const ada = await register(t.http, 'ada@example.com');
    await registerDevice(t.http, ada, pushToken());
    const rotated = pushToken();
    await registerDevice(t.http, ada, rotated);
    expect((await devicesOf(ada.user.id)).map((device) => device.token)).toEqual([rotated]);
  });

  it('gives each of a person’s devices its own registration', async () => {
    await register(t.http, 'ada@example.com');
    const phone = await login('ada@example.com');
    const tablet = await login('ada@example.com');
    const [phoneToken, tabletToken] = [pushToken(), pushToken()];
    await registerDevice(t.http, phone, phoneToken);
    await registerDevice(t.http, tablet, tabletToken);

    const devices = await devicesOf(phone.user.id);
    expect(devices.map((device) => device.token)).toEqual([phoneToken, tabletToken]);
    expect(new Set(devices.map((device) => device.sessionId)).size).toBe(2);
  });

  it('keeps at most ten devices per person — the least recently seen go', async () => {
    await register(t.http, 'ada@example.com');
    const tokens: string[] = [];
    for (let index = 0; index < 11; index += 1) {
      clock.advanceMinutes(1);
      const session = await login('ada@example.com');
      tokens.push(pushToken());
      await registerDevice(t.http, session, tokens[index] ?? '');
    }
    const devices = await t.prisma.pushDevice.findMany({ orderBy: { updatedAt: 'asc' } });
    expect(devices.map((device) => device.token)).toEqual(tokens.slice(1));
  });
});

describe('the end of a registration', () => {
  it('turning team notifications off removes this device, and only this one', async () => {
    await register(t.http, 'ada@example.com');
    const phone = await login('ada@example.com');
    const tablet = await login('ada@example.com');
    const tabletToken = pushToken();
    await registerDevice(t.http, phone, pushToken());
    await registerDevice(t.http, tablet, tabletToken);

    await request(t.http)
      .delete('/api/v1/push/devices/current')
      .set('Authorization', bearer(phone))
      .expect(204);
    expect((await devicesOf(phone.user.id)).map((device) => device.token)).toEqual([tabletToken]);
    // Again: nothing left to remove, the same answer.
    await request(t.http)
      .delete('/api/v1/push/devices/current')
      .set('Authorization', bearer(phone))
      .expect(204);
    await request(t.http).delete('/api/v1/push/devices/current').expect(401);
  });

  it('signing out ends it — the other devices keep theirs', async () => {
    await register(t.http, 'ada@example.com');
    const phone = await login('ada@example.com');
    const tablet = await login('ada@example.com');
    const tabletToken = pushToken();
    await registerDevice(t.http, phone, pushToken());
    await registerDevice(t.http, tablet, tabletToken);

    await request(t.http)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: phone.refreshToken })
      .expect(204);
    expect((await devicesOf(phone.user.id)).map((device) => device.token)).toEqual([tabletToken]);
  });

  it('a replayed refresh token ends the session — and its notifications', async () => {
    const ada = await register(t.http, 'ada@example.com');
    await registerDevice(t.http, ada, pushToken());
    const refresh = (refreshToken: string) =>
      request(t.http).post('/api/v1/auth/refresh').send({ refreshToken });
    const second = AuthSessionSchema.parse((await refresh(ada.refreshToken).expect(200)).body);
    await refresh(second.refreshToken).expect(200);
    // The first token again, after its successor was used: someone has a copy.
    await refresh(ada.refreshToken).expect(401);
    expect(await devicesOf(ada.user.id)).toEqual([]);
  });

  it('a phone signed out offline forgets its token later, without an account', async () => {
    const ada = await register(t.http, 'ada@example.com');
    const token = pushToken();
    await registerDevice(t.http, ada, token);

    await request(t.http).post('/api/v1/push/devices/unregister').send({ token }).expect(204);
    expect(await devicesOf(ada.user.id)).toEqual([]);
    // Unknown (or already forgotten): the same answer — it tells nothing.
    await request(t.http).post('/api/v1/push/devices/unregister').send({ token }).expect(204);
    await request(t.http)
      .post('/api/v1/push/devices/unregister')
      .send({ token: 'not-a-token' })
      .expect(400);
  });
});

describe('switching accounts on one phone', () => {
  it('moves the token to the account signed in now: the previous one gets nothing there', async () => {
    const ada = await register(t.http, 'ada@example.com');
    const token = pushToken();
    await registerDevice(t.http, ada, token);

    // Ada signs out without reaching the server; Bea signs in on the same phone.
    const bea = await register(t.http, 'bea@example.com');
    await registerDevice(t.http, bea, token);

    expect(await devicesOf(ada.user.id)).toEqual([]);
    expect(await devicesOf(bea.user.id)).toEqual([
      expect.objectContaining({ token, sessionId: await sessionOf(bea) }),
    ]);
  });

  it('Ada signing in again on it takes it back — as a new registration', async () => {
    const ada = await register(t.http, 'ada@example.com');
    const bea = await register(t.http, 'bea@example.com');
    const token = pushToken();
    await registerDevice(t.http, ada, token);
    const [first] = await devicesOf(ada.user.id);
    await registerDevice(t.http, bea, token);
    const again = await login('ada@example.com');
    await registerDevice(t.http, again, token);

    const [device] = await devicesOf(ada.user.id);
    expect(device?.id).not.toBe(first?.id);
    expect(await devicesOf(bea.user.id)).toEqual([]);
  });

  it('two sessions registering the same token at once: one registration, never two', async () => {
    const ada = await register(t.http, 'ada@example.com');
    const bea = await register(t.http, 'bea@example.com');
    const token = pushToken();
    await Promise.all([registerDevice(t.http, ada, token), registerDevice(t.http, bea, token)]);
    expect(await t.prisma.pushDevice.count({ where: { token } })).toBe(1);
  });
});
