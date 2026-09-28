import { LOCAL_COURSE } from '@/content/course';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { addDays, toLocalDate } from '@/lib/dates';
import { DEFAULT_SETTINGS, parseSettings } from '@/schemas';

import { reminderCopy } from '../copy';
import {
  REMINDER_WINDOW_DAYS,
  TEST_REMINDER_ID,
  matchesPlan,
  momentOf,
  planReminders,
  reminderId,
  type ReminderState,
} from '../logic/plan';
import { enableStep, permissionRevoked, requestOutcome } from '../logic/permission';
import { createReminderService } from '../reminder-service';
import { FakeNotificationAdapter } from '../__fixtures__/fake-adapter';

/** 24 September, 10:00 on the device's clock: Day 12 of the challenge. */
const NOW = new Date(2026, 8, 24, 10, 0);
const TODAY = toLocalDate(NOW);
const TOMORROW = addDays(TODAY, 1);

// Platform failures are logged on purpose; the tests that cause them expect it.
beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.restoreAllMocks();
});

function setup(now: Date = NOW) {
  const adapter = new FakeNotificationAdapter();
  const service = createReminderService(adapter, { now: () => now });
  return { adapter, service };
}

/** What each day is, as the course declares it. */
const KINDS = new Map(LOCAL_COURSE.days.map((day) => [day.day, day.kind]));
const copyFor = (day: number) => reminderCopy(day, KINDS.get(day) ?? 'regular');

function state(overrides: Partial<ReminderState> = {}): ReminderState {
  return {
    dayKinds: KINDS,
    enabled: true,
    time: { hour: 19, minute: 0 },
    onboarded: true,
    challengeStartDate: getStartDateForDay(12, NOW),
    isTodayComplete: false,
    challengeCompleted: false,
    ...overrides,
  };
}

describe('daily reminders', () => {
  it('schedule nothing while switched off', async () => {
    const { adapter, service } = setup();
    const report = await service.syncDailyReminders(state({ enabled: false }));

    expect(report.planned).toBe(0);
    expect(adapter.pending.size).toBe(0);
  });

  it('switched on with permission: one a day from today, at the chosen time', async () => {
    const { adapter, service } = setup();
    const report = await service.syncDailyReminders(state());

    expect(report.scheduled).toBe(REMINDER_WINDOW_DAYS);
    const first = adapter.pending.get(reminderId(TODAY));
    expect(first?.data).toMatchObject({
      kind: 'dailyReminder',
      date: TODAY,
      day: 12,
      time: '19:00',
    });
    expect(adapter.pending.get(reminderId(TOMORROW))?.data.day).toBe(13);
    expect(new Set(adapter.times())).toEqual(new Set(['19:00']));
  });

  it('follow the phone’s clock, not a fixed instant', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());

    // A wall-clock trigger: iOS fires it at 19:00 in whatever zone the phone is in.
    expect(adapter.pending.get(reminderId(TODAY))?.trigger).toEqual({
      type: 'localDateTime',
      date: TODAY,
      hour: 19,
      minute: 0,
    });
  });

  it('are planned again when the phone’s time zone changes', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());
    const [planned] = planReminders(state(), 'granted', NOW);
    const existing = adapter.pending.get(reminderId(TODAY));
    if (!planned || !existing) throw new Error('expected a reminder for today');

    expect(matchesPlan(existing, planned)).toBe(true);
    // The same 19:00, seen from another zone (a flight, a DST switch).
    const moved = {
      ...existing,
      data: { ...existing.data, utcOffset: Number(existing.data.utcOffset) + 60 },
    };
    expect(matchesPlan(moved, planned)).toBe(false);
  });

  it('start tomorrow when today’s time has already passed', async () => {
    const { adapter, service } = setup(new Date(2026, 8, 24, 19, 30));
    await service.syncDailyReminders(state());

    expect(adapter.pending.has(reminderId(TODAY))).toBe(false);
    expect(adapter.pending.has(reminderId(TOMORROW))).toBe(true);
  });

  it('switched on but denied: nothing is scheduled and the switch stays off', async () => {
    const { adapter, service } = setup();
    adapter.permission = { status: 'undetermined' };
    adapter.answer = { status: 'denied', canAskAgain: false };

    expect(enableStep(await service.getPermissionStatus())).toBe('explain');
    const outcome = requestOutcome(await service.requestPermission());
    expect(outcome).toBe('blocked');
    // The preference is only set on 'enabled'; the switch never pretends.
    const report = await service.syncDailyReminders(state({ enabled: outcome === 'enabled' }));
    expect(report.planned).toBe(0);
    expect(adapter.pending.size).toBe(0);
  });

  it('replace every reminder when the time changes — never add to them', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());
    const report = await service.syncDailyReminders(state({ time: { hour: 21, minute: 15 } }));

    expect(report.cancelled).toBe(REMINDER_WINDOW_DAYS);
    expect(report.scheduled).toBe(REMINDER_WINDOW_DAYS);
    expect(adapter.pending.size).toBe(REMINDER_WINDOW_DAYS);
    expect(new Set(adapter.times())).toEqual(new Set(['21:15']));
  });

  it('cancel everything when switched off, delivered ones included', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());
    adapter.deliver(reminderId(TODAY));

    await service.syncDailyReminders(state({ enabled: false }));
    expect(adapter.pending.size).toBe(0);
    expect(adapter.delivered.size).toBe(0);
  });

  it('go quiet for a finished day: the next one is tomorrow’s, for the next day', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());

    await service.syncDailyReminders(state({ isTodayComplete: true }));
    expect(adapter.pending.has(reminderId(TODAY))).toBe(false);
    const next = adapter.pending.get(reminderId(TOMORROW));
    expect(next?.data.day).toBe(13);
    expect(next?.title).toBe(copyFor(13).title);
  });

  it('take a delivered reminder away once the day is done, not before', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());
    adapter.deliver(reminderId(TODAY));

    await service.syncDailyReminders(state());
    expect(adapter.delivered.has(reminderId(TODAY))).toBe(true);

    await service.syncDailyReminders(state({ isTodayComplete: true }));
    expect(adapter.delivered.has(reminderId(TODAY))).toBe(false);
  });

  it('end with the summit: 90/90 cancels them all', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());

    const report = await service.syncDailyReminders(state({ challengeCompleted: true }));
    expect(report.planned).toBe(0);
    expect(adapter.pending.size).toBe(0);

    await service.syncDailyReminders(state());
    await service.handleChallengeCompleted();
    expect(adapter.pending.size).toBe(0);
  });

  it('call Day 90 the summit, and days after it too until the summit is reached', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state({ challengeStartDate: getStartDateForDay(88, NOW) }));

    const days = [...adapter.pending.values()].map((request) => request.data.day);
    expect(days.slice(0, 4)).toEqual([88, 89, 90, 90]);
    expect(adapter.pending.get(reminderId(addDays(TODAY, 2)))?.title).toBe('The summit is waiting');
  });

  it('never duplicate: enabling twice changes nothing the second time', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());
    const again = await service.syncDailyReminders(state());

    expect(again.scheduled).toBe(0);
    expect(again.cancelled).toBe(0);
    expect(adapter.calls.schedule).toBe(REMINDER_WINDOW_DAYS);
    expect(adapter.pending.size).toBe(REMINDER_WINDOW_DAYS);
  });

  it('survive a restart: a new service finds everything already in place', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());

    const restarted = createReminderService(adapter, { now: () => NOW });
    const report = await restarted.syncDailyReminders(state());
    expect(report).toMatchObject({ scheduled: 0, cancelled: 0, failures: 0 });
  });

  it('stop when the permission is taken away in the system Settings', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());
    adapter.permission = { status: 'denied', canAskAgain: false };

    const report = await service.syncDailyReminders(state());
    expect(report.cancelled).toBe(REMINDER_WINDOW_DAYS);
    expect(permissionRevoked(true, report.permission)).toBe(true);
  });

  it('wait for onboarding: no challenge, no reminders', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state({ onboarded: false }));
    expect(adapter.pending.size).toBe(0);
  });

  it('never throw on platform failures, and heal on the next sync', async () => {
    const { adapter, service } = setup();
    adapter.failing.add('schedule');
    const broken = await service.syncDailyReminders(state());
    expect(broken.failures).toBe(REMINDER_WINDOW_DAYS);
    expect(adapter.pending.size).toBe(0);

    adapter.failing.delete('schedule');
    const healed = await service.syncDailyReminders(state());
    expect(healed.scheduled).toBe(REMINDER_WINDOW_DAYS);

    adapter.failing.add('cancel');
    await expect(service.syncDailyReminders(state({ enabled: false }))).resolves.toMatchObject({
      failures: REMINDER_WINDOW_DAYS,
    });
  });

  it('never call a failed tidy-up a setup problem', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());
    adapter.deliver(reminderId(TODAY));
    adapter.failing.add('dismiss');

    const report = await service.syncDailyReminders(state({ isTodayComplete: true }));
    expect(report.failures).toBe(0);
    expect(report.tidyFailures).toBe(1);
  });

  it('keep 19:00 on the clock across a daylight-saving change', async () => {
    // Late October: the window crosses the European (25 Oct) and North
    // American (1 Nov) switches. Run under any TZ, the wall clock must hold.
    const autumn = new Date(2026, 9, 24, 10, 0);
    const { adapter, service } = setup(autumn);
    await service.syncDailyReminders(state({ challengeStartDate: getStartDateForDay(12, autumn) }));

    for (const request of adapter.pending.values()) {
      if (request.trigger.type !== 'localDateTime')
        throw new Error('expected a wall-clock trigger');
      const moment = momentOf(request.trigger.date, { hour: 19, minute: 0 });
      expect([moment.getHours(), moment.getMinutes()]).toEqual([19, 0]);
      expect(request.data.utcOffset).toBe(moment.getTimezoneOffset());
    }
  });

  it('leave everything alone when the permission cannot even be read', async () => {
    const { adapter, service } = setup();
    await service.syncDailyReminders(state());
    adapter.failing.add('getPermission');

    const report = await service.syncDailyReminders(state());
    expect(report.permission).toEqual({ status: 'unavailable' });
    expect(adapter.pending.size).toBe(REMINDER_WINDOW_DAYS);
    // An unreadable permission proves nothing: the preference survives it.
    expect(permissionRevoked(true, report.permission)).toBe(false);
  });

  it('keep the developer test notification apart from the daily ones', async () => {
    const { adapter, service } = setup();
    await service.scheduleTestReminder(copyFor(12), 5);
    await service.syncDailyReminders(state({ enabled: false }));

    expect(adapter.pending.get(TEST_REMINDER_ID)?.trigger).toEqual({
      type: 'afterSeconds',
      seconds: 5,
    });
    await service.cancelTestReminder();
    expect(adapter.pending.has(TEST_REMINDER_ID)).toBe(false);
  });

  it('report what is really scheduled', async () => {
    const { service } = setup();
    await service.syncDailyReminders(state());

    const inspection = await service.inspect();
    expect(inspection.permission).toEqual({ status: 'granted' });
    expect(inspection.reminders).toHaveLength(REMINDER_WINDOW_DAYS);
    expect(inspection.reminders[0]).toMatchObject({ date: TODAY, time: '19:00', day: 12 });
    expect(service.getLastReport()?.planned).toBe(REMINDER_WINDOW_DAYS);
  });
});

describe('the permission flow', () => {
  it('asks only after explaining, and sends a refusal to the system Settings', () => {
    expect(enableStep({ status: 'granted' })).toBe('enable');
    expect(enableStep({ status: 'undetermined' })).toBe('explain');
    expect(enableStep({ status: 'denied', canAskAgain: true })).toBe('explain');
    expect(enableStep({ status: 'denied', canAskAgain: false })).toBe('blocked');
    expect(enableStep({ status: 'unavailable' })).toBe('unavailable');
  });

  it('turns the answer into what the switch should do', () => {
    expect(requestOutcome({ status: 'granted' })).toBe('enabled');
    expect(requestOutcome({ status: 'undetermined' })).toBe('denied');
    expect(requestOutcome({ status: 'denied', canAskAgain: true })).toBe('denied');
    expect(requestOutcome({ status: 'denied', canAskAgain: false })).toBe('blocked');
  });
});

describe('reminder words', () => {
  const everyDay = Array.from({ length: 90 }, (_, index) => copyFor(index + 1));

  it('invite, never threaten', () => {
    for (const { title, body } of everyDay) {
      expect(title.length).toBeGreaterThan(0);
      expect(body.length).toBeGreaterThan(0);
      expect(`${title} ${body}`).not.toMatch(
        /\b(lose|lost|die|dying|miss|don'?t|don’t|streak|hurry|last chance)\b/i,
      );
    }
  });

  it('fit the day the course says it is: checkpoints, the summit', () => {
    expect(copyFor(7).title).toBe('Checkpoint day');
    expect(copyFor(84).title).toBe('Checkpoint day');
    expect(copyFor(90).title).toBe('The summit is waiting');
    expect(copyFor(12)).toEqual(copyFor(12));
    // The words follow the course's kind, not the day number.
    expect(reminderCopy(12, 'weeklyExam').title).toBe('Checkpoint day');
  });
});

describe('the stored reminder preference', () => {
  it('is off at 19:00 until the user turns it on', () => {
    expect(DEFAULT_SETTINGS.dailyReminderEnabled).toBe(false);
    expect(DEFAULT_SETTINGS.dailyReminderTime).toEqual({ hour: 19, minute: 0 });
  });

  it('falls back safely from a broken stored time', () => {
    expect(parseSettings({ dailyReminderTime: { hour: 25, minute: 0 } }).dailyReminderTime).toEqual(
      { hour: 19, minute: 0 },
    );
    expect(parseSettings({ dailyReminderTime: '7pm' }).dailyReminderTime).toEqual({
      hour: 19,
      minute: 0,
    });
    expect(
      parseSettings({ dailyReminderTime: { hour: 8.5, minute: 0 } }).dailyReminderTime,
    ).toEqual({ hour: 19, minute: 0 });
    expect(parseSettings({ dailyReminderEnabled: 'yes' }).dailyReminderEnabled).toBe(false);
  });

  it('survives a restart as it was saved', () => {
    const saved = {
      soundEnabled: true,
      hapticsEnabled: false,
      dailyReminderEnabled: true,
      dailyReminderTime: { hour: 7, minute: 45 },
    };
    expect(parseSettings(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('reaches old stored settings without breaking them', () => {
    expect(parseSettings({ soundEnabled: false, hapticsEnabled: true })).toEqual({
      ...DEFAULT_SETTINGS,
      soundEnabled: false,
    });
  });
});
