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
  const navigate = jest.fn();
  return { push, navigate, router: createTapRouter({ push, navigate }) };
}

describe('a tapped team notification', () => {
  it('opens the Friends tab — once, however often the tap is reported', () => {
    const { navigate, router } = taps();
    const tap = { id: 'n-1', data: news('TEAM_MEMBER_COMPLETED_DAY') };
    expect(router.open(tap, true)).toBe(true);
    expect(router.open(tap, true)).toBe(false);
    expect(navigate.mock.calls).toEqual([['/friends']]);
  });

  it('opens Today for "your turn", the Friends tab for the rest of the team’s news', () => {
    const { navigate, router } = taps();
    router.open({ id: 'n-1', data: news('TEAM_YOUR_TURN') }, true);
    router.open({ id: 'n-2', data: news('TEAM_DAY_COMPLETE') }, true);
    router.open({ id: 'n-3', data: news('TEAM_STREAK_MILESTONE') }, true);
    router.open({ id: 'n-4', data: { kind: 'TEAM_MEMBER_JOINED', teamId: TEAM } }, true);
    expect(navigate.mock.calls).toEqual([['/'], ['/friends'], ['/friends'], ['/friends']]);
  });

  it('leaves the daily reminder’s taps to it, and ignores anything malformed', () => {
    const { navigate, router } = taps();
    router.open({ id: 'r-1', data: { kind: 'dailyReminder', day: 12 } }, true);
    router.open({ id: 'x-1', data: { kind: 'TEAM_DAY_COMPLETE', teamId: 'not-a-team' } }, true);
    router.open({ id: 'x-2', data: {} }, true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('opens nothing while signed out or before the challenge', () => {
    const { navigate, router } = taps();
    expect(router.open({ id: 'n-1', data: news('TEAM_DAY_COMPLETE') }, false)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('that launched Milo opens once the navigator is up — and is forgotten after', () => {
    const { push, navigate, router } = taps();
    push.launch = { id: 'n-9', data: news('TEAM_YOUR_TURN') };
    // Signed out at launch: it stays for later.
    router.openLaunchTap(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(push.launch).not.toBeNull();

    router.openLaunchTap(true);
    router.openLaunchTap(true);
    expect(navigate.mock.calls).toEqual([['/']]);
    expect(push.launch).toBeNull();
  });

  it('arriving through the listener and as the launch tap still opens once', () => {
    const { push, navigate, router } = taps();
    const tap = { id: 'n-5', data: news('TEAM_MEMBER_JOINED') };
    push.launch = tap;
    const subscription = push.onTap((reported) => router.open(reported, true));
    push.tap(tap);
    router.openLaunchTap(true);
    subscription.remove();
    expect(navigate.mock.calls).toEqual([['/friends']]);
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
