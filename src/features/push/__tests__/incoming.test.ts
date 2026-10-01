import { LOCAL_COURSE } from '@/content/course';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { FakeNotificationAdapter } from '@/features/reminders/__fixtures__/fake-adapter';
import { REMINDER_WINDOW_DAYS } from '@/features/reminders/logic/plan';
import { createReminderService } from '@/features/reminders/reminder-service';

import { createTapRouter, watchTeamNews } from '../incoming';
import { createTeamNotifications } from '../team-notifications';
import { FakePushAdapter, FakePushServer, memoryPushState } from '../__fixtures__/fake-push';

// Jest runs this file in Node; the app's tsconfig carries no Node types (the
// app never runs there), so the little of `fs` and `path` used here is typed
// for this file only — as in the dev-tools boundary test.
declare const require: (id: 'fs' | 'path') => unknown;
declare const __dirname: string;
const { readFileSync, readdirSync, statSync } = require('fs') as {
  readFileSync: (path: string, encoding: 'utf8') => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
};
const { join } = require('path') as { join: (...parts: string[]) => string };

/**
 * Team notifications arriving: tapped (Milo running, in the background, or
 * launched by the tap) or while Milo is open — and the daily reminder, which
 * stays what it was: local, scheduled on the phone, on its own.
 */

const TEAM = '11111111-1111-4111-8111-111111111111';
const news = (kind: string, extra: Record<string, unknown> = {}) => ({
  kind,
  teamId: TEAM,
  dayNumber: 12,
  ...extra,
});

function taps() {
  const push = new FakePushAdapter();
  const openTab = jest.fn();
  const cleared = jest.spyOn(push, 'clearLaunchTap');
  const router = createTapRouter({ push, openTab });
  // The listener, as PushSync subscribes it.
  push.onTap((tap) => router.receive(tap));
  return { push, openTab, cleared, router };
}

const ready = { navigation: true, inChallenge: true };

describe('a tapped team notification', () => {
  it('Milo open: opens the Friends tab at once', () => {
    const { push, openTab, router } = taps();
    router.setReadiness(ready);
    push.tap({ id: 'n-1', data: news('TEAM_MEMBER_JOINED', { dayNumber: undefined }) });
    expect(openTab.mock.calls).toEqual([['/friends']]);
  });

  it('Milo in the background: the listener opens it the same way', () => {
    const { push, openTab, router } = taps();
    router.setReadiness(ready);
    push.tap({ id: 'n-2', data: news('TEAM_MEMBER_COMPLETED_DAY') });
    expect(openTab.mock.calls).toEqual([['/friends']]);
  });

  it('opens Today for "your turn", the Friends tab for all other team news', () => {
    const { push, openTab, router } = taps();
    router.setReadiness(ready);
    push.tap({ id: 'n-1', data: news('TEAM_YOUR_TURN') });
    push.tap({ id: 'n-2', data: news('TEAM_DAY_COMPLETE') });
    push.tap({ id: 'n-3', data: news('TEAM_STREAK_MILESTONE') });
    push.tap({ id: 'n-4', data: { kind: 'TEAM_MEMBER_JOINED', teamId: TEAM } });
    push.tap({ id: 'n-5', data: news('TEAM_MEMBER_COMPLETED_DAY') });
    expect(openTab.mock.calls).toEqual([
      ['/'],
      ['/friends'],
      ['/friends'],
      ['/friends'],
      ['/friends'],
    ]);
  });

  it('Milo not running: the launch tap waits for the navigation, then opens once', () => {
    const { push, openTab, cleared, router } = taps();
    push.launch = { id: 'n-9', data: news('TEAM_YOUR_TURN') };
    router.receiveLaunchTap();
    // Nothing is mounted yet: nothing can open.
    expect(openTab).not.toHaveBeenCalled();
    router.setReadiness({ navigation: false, inChallenge: true });
    expect(openTab).not.toHaveBeenCalled();
    router.setReadiness(ready);
    router.setReadiness(ready);
    expect(openTab.mock.calls).toEqual([['/']]);
    // Consumed: no later launch or reload reads it again.
    expect(cleared).toHaveBeenCalledTimes(1);
    expect(push.launch).toBeNull();
  });

  it('a tap reported before the navigation is ready opens as soon as it is', () => {
    const { push, openTab, router } = taps();
    push.tap({ id: 'n-3', data: news('TEAM_DAY_COMPLETE') });
    expect(openTab).not.toHaveBeenCalled();
    router.setReadiness(ready);
    expect(openTab.mock.calls).toEqual([['/friends']]);
  });

  it('the same tap through the listener and as the launch tap — or twice — opens once', () => {
    const { push, openTab, router } = taps();
    const tap = { id: 'n-5', data: news('TEAM_MEMBER_JOINED') };
    push.launch = tap;
    push.tap(tap);
    router.receiveLaunchTap();
    push.tap(tap);
    router.setReadiness(ready);
    push.tap(tap);
    expect(openTab.mock.calls).toEqual([['/friends']]);
  });

  it('ignores malformed or foreign data — and leaves a launch tap that is not its own', () => {
    const { push, openTab, cleared, router } = taps();
    router.setReadiness(ready);
    push.tap({ id: 'x-1', data: { kind: 'TEAM_DAY_COMPLETE', teamId: 'not-a-team' } });
    push.tap({ id: 'x-2', data: {} });
    push.tap({ id: 'x-3', data: { kind: 'SOMETHING_ELSE', teamId: TEAM } });
    push.launch = { id: 'r-1', data: { kind: 'dailyReminder', day: 12 } };
    router.receiveLaunchTap();
    expect(openTab).not.toHaveBeenCalled();
    expect(cleared).not.toHaveBeenCalled();
    expect(push.launch).not.toBeNull();
  });

  it('leaves the daily reminder’s taps to the reminder (which opens Home itself)', () => {
    const { push, openTab, router } = taps();
    router.setReadiness(ready);
    push.tap({ id: 'r-1', data: { kind: 'dailyReminder', day: 12 } });
    push.tap({ id: 'r-2', data: { kind: 'testReminder' } });
    expect(openTab).not.toHaveBeenCalled();
  });

  it('signed out or before the challenge: the tap is dropped — not opened after sign-in', () => {
    const { push, openTab, router } = taps();
    router.setReadiness({ navigation: true, inChallenge: false });
    push.tap({ id: 'n-1', data: news('TEAM_DAY_COMPLETE') });
    router.setReadiness(ready);
    expect(openTab).not.toHaveBeenCalled();
  });

  it('a later tap opens even after an earlier one waited and opened', () => {
    const { push, openTab, router } = taps();
    push.tap({ id: 'n-1', data: news('TEAM_MEMBER_JOINED') });
    router.setReadiness(ready);
    push.tap({ id: 'n-2', data: news('TEAM_YOUR_TURN') });
    expect(openTab.mock.calls).toEqual([['/friends'], ['/']]);
  });
});

describe('a team notification while Milo is open', () => {
  it('fetches the team again — the daily reminder does not', () => {
    const push = new FakePushAdapter();
    const refresh = jest.fn();
    const subscription = watchTeamNews(push, refresh);
    push.receive(news('TEAM_MEMBER_COMPLETED_DAY'));
    push.receive({ kind: 'dailyReminder', day: 12 });
    expect(refresh).toHaveBeenCalledTimes(1);
    subscription.remove();
    push.receive(news('TEAM_DAY_COMPLETE'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

describe('the daily reminder', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps scheduling locally, whatever team notifications do — offline or not', async () => {
    const NOW = new Date(2026, 8, 24, 10, 0);
    const system = new FakeNotificationAdapter();
    const reminders = createReminderService(system, { now: () => NOW });
    const reminderState = {
      dayKinds: new Map(LOCAL_COURSE.days.map((day) => [day.day, day.kind])),
      enabled: true,
      time: { hour: 19, minute: 0 },
      onboarded: true,
      challengeStartDate: getStartDateForDay(12, NOW),
      isTodayComplete: false,
      challengeCompleted: false,
    };
    await reminders.syncDailyReminders(reminderState);
    const scheduled = [...system.pending.keys()];
    expect(scheduled).toHaveLength(REMINDER_WINDOW_DAYS);

    // Team notifications on the same phone, sharing its permission: on, the
    // server gone, signed out offline, back again.
    const server = new FakePushServer();
    let signedIn: string | null = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const team = createTeamNotifications({
      push: new FakePushAdapter(),
      permissions: system,
      api: server.api(() => signedIn),
      state: memoryPushState(),
      platform: 'android',
    });
    await team.turnOn('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    server.online = false;
    signedIn = null;
    await team.sync(null);
    await reminders.syncDailyReminders(reminderState);

    expect([...system.pending.keys()]).toEqual(scheduled);
    expect(system.calls.cancel).toBe(0);
  });

  it('never goes through the server: its code knows nothing of push or the API', () => {
    const root = join(__dirname, '..', '..', 'reminders');
    const files = (function walk(dir: string): string[] {
      return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    })(root).filter((path) => /\.(ts|tsx)$/.test(path));
    expect(files.length).toBeGreaterThan(5);
    for (const path of files) {
      const code = readFileSync(path, 'utf8');
      expect(code).not.toMatch(/features\/push|push-adapter|repositories\/api|api-client|fetch\(/);
      expect(code).not.toMatch(/getExpoPushTokenAsync|getDevicePushTokenAsync/);
    }
  });
});
