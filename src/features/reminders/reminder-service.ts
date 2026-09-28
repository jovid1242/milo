import { toLocalDate } from '@/lib/dates';
import { logger } from '@/lib/logger';
import type {
  NotificationAdapter,
  NotificationPermission,
  SystemNotification,
} from '@/services/notifications/notification-adapter';

import type { ReminderCopy } from './copy';
import {
  TEST_REMINDER_ID,
  isDailyReminder,
  matchesPlan,
  planReminders,
  remindersActive,
  reminderDate,
  reminderId,
  type ReminderState,
} from './logic/plan';

/** What a sync did — for the UI (a failure to show) and the developer tools. */
export type SyncReport = {
  permission: NotificationPermission;
  /** Reminders that should be waiting after this sync. */
  planned: number;
  scheduled: number;
  cancelled: number;
  dismissed: number;
  /**
   * Setting reminders up failed somewhere (listing, cancelling, scheduling);
   * the next sync tries again. Shown in Settings while it is true.
   */
  failures: number;
  /** Tidying Notification Center failed — cosmetic, never shown as a problem. */
  tidyFailures: number;
};

export type ReminderInspection = {
  permission: NotificationPermission;
  reminders: { id: string; date: string; time: string; day: number; title: string }[];
  testPending: boolean;
  presented: number;
};

type Listener = () => void;

/**
 * The daily reminder, over a notification adapter. Its heart is one
 * operation, `syncDailyReminders`: work out which reminders should be waiting
 * (`planReminders`) and make the system match — cancel what is stale,
 * schedule what is missing, leave what is right alone. Every change (Settings,
 * a finished day, the summit, a new day, a permission revoked) goes through it,
 * so there is no second path that could leave a duplicate or a stray reminder
 * behind:
 *
 * - ids are per date (`milo.daily-reminder.2026-09-24`), so scheduling one
 *   again replaces it — a double enable cannot duplicate anything;
 * - syncs run one at a time, in order, so the last one requested wins;
 * - platform failures are caught and counted, never thrown: a broken
 *   notification system never takes the app down.
 */
export function createReminderService(
  adapter: NotificationAdapter,
  { now = () => new Date() }: { now?: () => Date } = {},
) {
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };

  let lastReport: SyncReport | null = null;
  const listeners = new Set<Listener>();
  const publish = (report: SyncReport) => {
    lastReport = report;
    for (const listener of listeners) listener();
  };

  /** Runs a platform call; a failure is logged and reported as `false`. */
  async function attempt(label: string, task: () => Promise<unknown>): Promise<boolean> {
    try {
      await task();
      return true;
    } catch (error: unknown) {
      logger.warn(`notifications: ${label} failed`, error);
      return false;
    }
  }

  async function read<T>(label: string, task: () => Promise<T>): Promise<T | null> {
    try {
      return await task();
    } catch (error: unknown) {
      logger.warn(`notifications: ${label} failed`, error);
      return null;
    }
  }

  async function getPermissionStatus(): Promise<NotificationPermission> {
    return (
      (await read('reading the permission', () => adapter.getPermission())) ?? {
        status: 'unavailable',
      }
    );
  }

  async function requestPermission(): Promise<NotificationPermission> {
    return (
      (await read('asking for permission', () => adapter.requestPermission())) ?? {
        status: 'unavailable',
      }
    );
  }

  /**
   * Delivered reminders that no longer apply leave Notification Center:
   * everything from earlier days, and today's once the day is done.
   */
  async function tidyPresented(
    keepId: string | null,
  ): Promise<{ dismissed: number; failures: number }> {
    const presented =
      (await read('listing delivered notifications', () => adapter.getPresented())) ?? [];
    let dismissed = 0;
    let failures = 0;
    for (const notification of presented) {
      if (!isDailyReminder(notification.id) || notification.id === keepId) continue;
      if (await attempt(`dismissing ${notification.id}`, () => adapter.dismiss(notification.id))) {
        dismissed += 1;
      } else {
        failures += 1;
      }
    }
    return { dismissed, failures };
  }

  function syncDailyReminders(state: ReminderState): Promise<SyncReport> {
    return serial(async () => {
      const permission = await getPermissionStatus();
      if (permission.status === 'unavailable') {
        // Nothing can be known or changed; whatever is scheduled stays as it is.
        const report: SyncReport = {
          permission,
          planned: 0,
          scheduled: 0,
          cancelled: 0,
          dismissed: 0,
          failures: 0,
          tidyFailures: 0,
        };
        publish(report);
        return report;
      }

      const plan = planReminders(state, permission.status, now());
      const wanted = new Map(plan.map((reminder) => [reminder.id, reminder]));
      let scheduled = 0;
      let cancelled = 0;
      let failures = 0;

      const existing: SystemNotification[] | null = await read(
        'listing scheduled notifications',
        () => adapter.getScheduled(),
      );
      if (existing === null) failures += 1;
      for (const notification of existing ?? []) {
        if (!isDailyReminder(notification.id)) continue;
        const planned = wanted.get(notification.id);
        if (planned && matchesPlan(notification, planned)) {
          wanted.delete(notification.id);
          continue;
        }
        if (await attempt(`cancelling ${notification.id}`, () => adapter.cancel(notification.id))) {
          cancelled += 1;
        } else {
          failures += 1;
        }
      }
      for (const reminder of wanted.values()) {
        if (await attempt(`scheduling ${reminder.id}`, () => adapter.schedule(reminder))) {
          scheduled += 1;
        } else {
          failures += 1;
        }
      }

      const today = toLocalDate(now());
      const keepToday =
        remindersActive(state, permission.status) && !state.isTodayComplete
          ? reminderId(today)
          : null;
      const tidy = await tidyPresented(keepToday);

      const report: SyncReport = {
        permission,
        planned: plan.length,
        scheduled,
        cancelled,
        dismissed: tidy.dismissed,
        failures,
        tidyFailures: tidy.failures,
      };
      publish(report);
      return report;
    });
  }

  /** Every daily reminder gone — scheduled and delivered. */
  function cancelDailyReminders(): Promise<SyncReport> {
    return serial(async () => {
      const permission = await getPermissionStatus();
      const existing =
        (await read('listing scheduled notifications', () => adapter.getScheduled())) ?? [];
      let cancelled = 0;
      let failures = 0;
      for (const notification of existing) {
        if (!isDailyReminder(notification.id)) continue;
        if (await attempt(`cancelling ${notification.id}`, () => adapter.cancel(notification.id))) {
          cancelled += 1;
        } else {
          failures += 1;
        }
      }
      const tidy = await tidyPresented(null);
      const report: SyncReport = {
        permission,
        planned: 0,
        scheduled: 0,
        cancelled,
        dismissed: tidy.dismissed,
        failures,
        tidyFailures: tidy.failures,
      };
      publish(report);
      return report;
    });
  }

  return {
    getPermissionStatus,
    requestPermission,
    syncDailyReminders,
    cancelDailyReminders,
    /** After the summit there is nothing left to remind about. */
    handleChallengeCompleted: cancelDailyReminders,

    /** Developer tools: one notification after `seconds`, apart from the daily ones. */
    async scheduleTestReminder(copy: ReminderCopy, seconds = 5): Promise<boolean> {
      return attempt('scheduling the test reminder', () =>
        adapter.schedule({
          id: TEST_REMINDER_ID,
          title: copy.title,
          body: copy.body,
          data: { kind: 'testReminder' },
          trigger: { type: 'afterSeconds', seconds },
        }),
      );
    },
    async cancelTestReminder(): Promise<boolean> {
      return attempt('cancelling the test reminder', () => adapter.cancel(TEST_REMINDER_ID));
    },

    /** What is really scheduled right now, as the system reports it. */
    async inspect(): Promise<ReminderInspection> {
      const permission = await getPermissionStatus();
      const scheduled =
        (await read('listing scheduled notifications', () => adapter.getScheduled())) ?? [];
      const presented =
        (await read('listing delivered notifications', () => adapter.getPresented())) ?? [];
      return {
        permission,
        reminders: scheduled
          .filter((notification) => isDailyReminder(notification.id))
          .map((notification) => ({
            id: notification.id,
            date: reminderDate(notification.id),
            time: String(notification.data.time ?? ''),
            day: Number(notification.data.day ?? 0),
            title: notification.title,
          }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        testPending: scheduled.some((notification) => notification.id === TEST_REMINDER_ID),
        presented: presented.filter((notification) => isDailyReminder(notification.id)).length,
      };
    },

    /** The last sync's report, for screens that show a problem only when one exists. */
    getLastReport: (): SyncReport | null => lastReport,
    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export type ReminderService = ReturnType<typeof createReminderService>;
