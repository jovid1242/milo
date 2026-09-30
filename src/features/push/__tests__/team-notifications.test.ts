import { FakeNotificationAdapter } from '@/features/reminders/__fixtures__/fake-adapter';

import { allowAndSwitchOn, switchOn, type SwitchDeps } from '../logic/switch-flow';
import { createTeamNotifications } from '../team-notifications';
import { FakePushAdapter, FakePushServer, memoryPushState } from '../__fixtures__/fake-push';

/**
 * Team notifications on the phone: the switch, the permission, the token and
 * the server's registration — kept true to the switch and to who is signed in.
 * Nothing here sends a push: the push system and the server are fakes.
 */

const ADA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BEA = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NEW_TOKEN = 'ExponentPushToken[phone-token-000000002]';

// Refusals are logged on purpose; the tests that cause them expect it.
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

function phone() {
  const push = new FakePushAdapter();
  const permissions = new FakeNotificationAdapter();
  const server = new FakePushServer();
  const state = memoryPushState();
  let signedIn: string | null = null;
  const launch = () =>
    createTeamNotifications({
      push,
      permissions,
      api: server.api(() => signedIn),
      state,
      platform: 'android',
    });
  const device = {
    push,
    permissions,
    server,
    state,
    service: launch(),
    signIn(owner: string | null) {
      signedIn = owner;
    },
    /** The app is closed and opened again: what the Keychain kept is all that is left. */
    relaunch() {
      device.service = launch();
    },
    /** The switch as the Settings screen flips it. */
    switchDeps(owner: string, online = true): SwitchDeps {
      return {
        online,
        getPermission: () => permissions.getPermission(),
        requestPermission: () => permissions.requestPermission(),
        turnOn: () => device.service.turnOn(owner),
      };
    },
  };
  return device;
}

/** Signed in as `owner`, with team notifications on. */
async function withTeamNotifications(owner = ADA) {
  const device = phone();
  device.signIn(owner);
  expect(await switchOn(device.switchDeps(owner))).toEqual({ kind: 'on' });
  return device;
}

describe('the switch and the permission', () => {
  it('asks for nothing on its own: launching and syncing never show the system dialog', async () => {
    const device = phone();
    device.permissions.permission = { status: 'undetermined' };
    device.signIn(ADA);
    await device.service.sync(ADA);
    await device.service.sync(null);
    expect(device.permissions.calls.request).toBe(0);
    expect(device.push.tokenRequests).toBe(0);
    expect(device.server.devices.size).toBe(0);
  });

  it('already allowed: on at once — the server has this phone for the account', async () => {
    const device = await withTeamNotifications();
    expect(device.permissions.calls.request).toBe(0);
    expect(device.server.notifies(device.push.token)).toBe(ADA);
    expect(device.service.isOn(ADA)).toBe(true);
    // The Android channel exists before anything can arrive on it.
    expect(device.push.channels).toBe(1);
  });

  it('not asked yet: a word first, then the system dialog — on only for a real yes', async () => {
    const device = phone();
    device.signIn(ADA);
    device.permissions.permission = { status: 'undetermined' };

    expect(await switchOn(device.switchDeps(ADA))).toEqual({ kind: 'prompt', prompt: 'explain' });
    expect(device.permissions.calls.request).toBe(0);
    expect(device.server.devices.size).toBe(0);

    device.permissions.answer = { status: 'granted' };
    expect(await allowAndSwitchOn(device.switchDeps(ADA))).toEqual({ kind: 'on' });
    expect(device.permissions.calls.request).toBe(1);
    expect(device.server.notifies(device.push.token)).toBe(ADA);
  });

  it('refused: the switch stays off — and after "don’t ask again" the way is Settings', async () => {
    const device = phone();
    device.signIn(ADA);
    device.permissions.permission = { status: 'undetermined' };
    device.permissions.answer = { status: 'denied', canAskAgain: true };
    expect(await allowAndSwitchOn(device.switchDeps(ADA))).toEqual({
      kind: 'prompt',
      prompt: 'denied',
    });
    expect(device.service.isOn(ADA)).toBe(false);

    device.permissions.permission = { status: 'denied', canAskAgain: false };
    expect(await switchOn(device.switchDeps(ADA))).toEqual({ kind: 'prompt', prompt: 'blocked' });
    expect(device.permissions.calls.request).toBe(1);
    expect(device.server.devices.size).toBe(0);
    expect(device.push.tokenRequests).toBe(0);
  });

  it('offline, unreachable or refused: off, with a word — never on without the server', async () => {
    const device = phone();
    device.signIn(ADA);
    expect(await switchOn(device.switchDeps(ADA, false))).toEqual({
      kind: 'note',
      note: 'offline',
    });

    device.server.online = false;
    expect(await switchOn(device.switchDeps(ADA))).toEqual({ kind: 'note', note: 'offline' });
    device.server.online = true;
    device.server.refuseRegister = true;
    expect(await switchOn(device.switchDeps(ADA))).toEqual({ kind: 'note', note: 'failed' });
    device.server.refuseRegister = false;
    device.push.tokenFails = true;
    expect(await switchOn(device.switchDeps(ADA))).toEqual({ kind: 'note', note: 'failed' });

    expect(device.service.isOn(ADA)).toBe(false);
    expect(device.server.devices.size).toBe(0);
  });

  it('a permission taken away in the system settings turns the switch off — the server stops too', async () => {
    const device = await withTeamNotifications();
    device.permissions.permission = { status: 'denied', canAskAgain: false };
    await device.service.sync(ADA);
    expect(device.service.isOn(ADA)).toBe(false);
    expect(device.server.devices.size).toBe(0);
  });
});

describe('the token', () => {
  it('a new token from the system replaces the old one on the server', async () => {
    const device = await withTeamNotifications();
    const old = device.push.token;
    device.push.rotate(NEW_TOKEN);
    device.service.tokenChanged();
    await device.service.sync(ADA);
    expect(device.server.notifies(NEW_TOKEN)).toBe(ADA);
    expect(device.server.notifies(old)).toBeNull();
    expect(device.state.current.registration).toEqual({ owner: ADA, token: NEW_TOKEN });
  });

  it('is registered once a launch — each new launch confirms it again', async () => {
    const device = await withTeamNotifications();
    await device.service.sync(ADA);
    await device.service.sync(ADA);
    expect(device.server.calls.register).toBe(1);

    device.relaunch();
    await device.service.sync(ADA);
    await device.service.sync(ADA);
    expect(device.server.calls.register).toBe(2);
    expect(device.server.notifies(device.push.token)).toBe(ADA);
  });
});

describe('turning it off, and signing out', () => {
  it('off: the server stops at once', async () => {
    const device = await withTeamNotifications();
    await device.service.turnOff(ADA);
    expect(device.service.isOn(ADA)).toBe(false);
    expect(device.server.devices.size).toBe(0);
    expect(device.state.current.registration).toBeNull();
  });

  it('off while offline: the server hears of it when the connection is back', async () => {
    const device = await withTeamNotifications();
    device.server.online = false;
    await device.service.turnOff(ADA);
    expect(device.service.isOn(ADA)).toBe(false);
    expect(device.server.notifies(device.push.token)).toBe(ADA);

    device.server.online = true;
    await device.service.sync(ADA);
    expect(device.server.devices.size).toBe(0);
  });

  it('signing out: this phone is forgotten on the server; signing in again brings it back', async () => {
    const device = await withTeamNotifications();
    device.signIn(null);
    await device.service.sync(null);
    expect(device.server.devices.size).toBe(0);
    expect(device.state.current).toMatchObject({ registration: null, forget: [] });

    // The account's choice stays with the phone.
    device.signIn(ADA);
    await device.service.sync(ADA);
    expect(device.server.notifies(device.push.token)).toBe(ADA);
  });

  it('signing out offline: forgotten as soon as the server can be told — after a restart too', async () => {
    const device = await withTeamNotifications();
    device.server.online = false;
    device.signIn(null);
    await device.service.sync(null);
    expect(device.state.current.forget).toEqual([device.push.token]);
    expect(device.server.notifies(device.push.token)).toBe(ADA);

    device.relaunch();
    device.server.online = true;
    await device.service.sync(null);
    expect(device.server.devices.size).toBe(0);
    expect(device.state.current.forget).toEqual([]);
  });
});

describe('switching accounts on one phone', () => {
  it('the next account never gets the previous one’s news', async () => {
    const device = await withTeamNotifications(ADA);
    // Ada signs out without reaching the server; Bea signs in once it can be reached.
    device.server.online = false;
    device.signIn(null);
    await device.service.sync(null);
    device.server.online = true;
    device.signIn(BEA);
    await device.service.sync(BEA);

    expect(device.server.devices.size).toBe(0);
    expect(device.service.isOn(BEA)).toBe(false);
    // Ada's choice is Ada's: it waits for her, on this phone.
    expect(device.service.isOn(ADA)).toBe(true);
  });

  it('the next account turning it on gets the phone — forgetting the last one never undoes that', async () => {
    const device = await withTeamNotifications(ADA);
    device.server.online = false;
    device.signIn(null);
    await device.service.sync(null);

    // The server is back but busy forgetting; registering works.
    device.server.online = true;
    device.server.forgetFails = true;
    device.signIn(BEA);
    expect(await switchOn(device.switchDeps(BEA))).toEqual({ kind: 'on' });
    expect(device.server.notifies(device.push.token)).toBe(BEA);
    expect(device.state.current.forget).toEqual([]);

    device.server.forgetFails = false;
    await device.service.sync(BEA);
    await device.service.sync(BEA);
    expect(device.server.notifies(device.push.token)).toBe(BEA);
  });

  it('switching straight from one account to the other releases the first', async () => {
    const device = await withTeamNotifications(ADA);
    device.signIn(BEA);
    await device.service.sync(BEA);
    expect(device.server.devices.size).toBe(0);
    expect(device.state.current.registration).toBeNull();
  });
});
