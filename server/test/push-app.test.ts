import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { switchOn } from '@/features/push/logic/switch-flow';
import { createTeamNotifications } from '@/features/push/team-notifications';
import { FakePushAdapter, memoryPushState } from '@/features/push/__fixtures__/fake-push';
import { FakeNotificationAdapter } from '@/features/reminders/__fixtures__/fake-adapter';

import { resetDatabase, startApp, type TestApp } from './helpers';
import { Phone } from './phone';
import { FakeExpo } from './push-fixtures';

/**
 * The app's own team-notification code — the switch's flow, the registration
 * kept true to who is signed in, the offline sign-out — on a phone talking to
 * this server over HTTP. The push system is a fake: no token is asked of
 * Expo, no push is sent.
 */

let t: TestApp;
beforeAll(async () => {
  t = await startApp({ listen: true, pushTransport: new FakeExpo() });
});
afterAll(() => t.close());

const phones: Phone[] = [];
beforeEach(async () => {
  await resetDatabase(t.prisma);
});
afterEach(async () => {
  for (const item of phones.splice(0)) await item.close();
});

/** A phone with the app's team notifications on it. */
function phoneWithPush() {
  const device = new Phone(t.baseUrl);
  phones.push(device);
  const push = new FakePushAdapter();
  const permissions = new FakeNotificationAdapter();
  const state = memoryPushState();
  const team = createTeamNotifications({
    push,
    permissions,
    api: device.services.pushApi,
    state,
    platform: 'android',
  });
  const turnOn = (owner: string) =>
    switchOn({
      online: device.online,
      getPermission: () => permissions.getPermission(),
      requestPermission: () => permissions.requestPermission(),
      turnOn: () => team.turnOn(owner),
    });
  return { device, push, state, team, turnOn };
}

const serverDevices = async () =>
  (await t.prisma.pushDevice.findMany({ include: { user: { select: { email: true } } } })).map(
    (device) => ({ email: device.user.email, token: device.token }),
  );

describe('team notifications from the app, against the server', () => {
  it('on: the server has the phone for the account; a new token replaces the old one', async () => {
    const { device, push, team, turnOn } = phoneWithPush();
    const ada = await device.signUp('ada@example.com');
    expect(await turnOn(ada.owner)).toEqual({ kind: 'on' });
    expect(await serverDevices()).toEqual([{ email: 'ada@example.com', token: push.token }]);

    push.rotate('ExponentPushToken[phone-token-000000002]');
    team.tokenChanged();
    await team.sync(ada.owner);
    expect(await serverDevices()).toEqual([
      { email: 'ada@example.com', token: 'ExponentPushToken[phone-token-000000002]' },
    ]);

    await team.turnOff(ada.owner);
    expect(await serverDevices()).toEqual([]);
  });

  it('signing out ends it on the server — offline too, as soon as the phone is back', async () => {
    const { device, state, team, turnOn } = phoneWithPush();
    const ada = await device.signUp('ada@example.com');
    await turnOn(ada.owner);

    // Online: the logout itself ends the registration.
    await device.signOut(ada);
    await team.sync(null);
    expect(await serverDevices()).toEqual([]);

    // Offline: the logout never reaches the server; the phone remembers to forget.
    const again = await device.signIn('ada@example.com');
    await team.sync(again.owner);
    expect(await serverDevices()).toHaveLength(1);
    device.online = false;
    await device.signOut(again);
    await team.sync(null);
    expect(state.current.forget).toHaveLength(1);
    expect(await serverDevices()).toHaveLength(1);

    device.online = true;
    await team.sync(null);
    expect(await serverDevices()).toEqual([]);
    expect(state.current.forget).toEqual([]);
  });

  it('the next account on the phone never gets the previous one’s news — and can have its own', async () => {
    const { device, push, team, turnOn } = phoneWithPush();
    const ada = await device.signUp('ada@example.com');
    await turnOn(ada.owner);
    device.online = false;
    await device.signOut(ada);
    await team.sync(null);

    device.online = true;
    const bea = await device.signUp('bea@example.com');
    await team.sync(bea.owner);
    expect(await serverDevices()).toEqual([]);

    expect(await turnOn(bea.owner)).toEqual({ kind: 'on' });
    await team.sync(bea.owner);
    expect(await serverDevices()).toEqual([{ email: 'bea@example.com', token: push.token }]);
  });
});
