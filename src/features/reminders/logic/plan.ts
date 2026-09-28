import { getChallengeDay } from '@/features/challenge/logic/calendar';
import { addDays, parseLocalDate, toLocalDate } from '@/lib/dates';
import type { DayKind, DayNumber, LocalDate, ReminderTime } from '@/schemas';
import type {
  NotificationPermission,
  NotificationRequest,
  SystemNotification,
} from '@/services/notifications/notification-adapter';

import { reminderCopy } from '../copy';

/** Every daily reminder's id starts with this; the date completes it. */
export const DAILY_REMINDER_PREFIX = 'milo.daily-reminder.';
export const TEST_REMINDER_ID = 'milo.test-reminder';

/**
 * How far ahead reminders are planned. Every app start and return extends the
 * window; someone who has stopped opening the app is not reminded forever.
 * Far below iOS's limit of 64 pending notifications per app.
 */
export const REMINDER_WINDOW_DAYS = 14;

/** Everything the plan depends on — preferences and the challenge as it stands. */
export type ReminderState = {
  /** What kind of day each course day is (a checkpoint, the summit) — from the course. */
  dayKinds: ReadonlyMap<DayNumber, DayKind>;
  /** The user's choice in Settings. */
  enabled: boolean;
  time: ReminderTime;
  onboarded: boolean;
  challengeStartDate: LocalDate;
  isTodayComplete: boolean;
  /** 90/90: the summit is reached, there is nothing left to remind about. */
  challengeCompleted: boolean;
};

export type PlannedReminder = NotificationRequest & { date: LocalDate; day: DayNumber };

const pad = (value: number) => String(value).padStart(2, '0');

/** `HH:MM`, 24-hour — the stored, locale-free form of a reminder time. */
export function toClock(time: ReminderTime): string {
  return `${pad(time.hour)}:${pad(time.minute)}`;
}

/** The instant `time` falls on `date`, on the device's clock. */
export function momentOf(date: LocalDate, time: ReminderTime): Date {
  const moment = parseLocalDate(date);
  moment.setHours(time.hour, time.minute, 0, 0);
  return moment;
}

export const reminderId = (date: LocalDate) => `${DAILY_REMINDER_PREFIX}${date}`;
export const isDailyReminder = (id: string) => id.startsWith(DAILY_REMINDER_PREFIX);
export const reminderDate = (id: string): LocalDate => id.slice(DAILY_REMINDER_PREFIX.length);

/** Whether reminders should exist at all right now. */
export function remindersActive(
  state: ReminderState,
  permission: NotificationPermission['status'],
): boolean {
  return state.enabled && permission === 'granted' && state.onboarded && !state.challengeCompleted;
}

/**
 * The reminders that should be waiting, one per day, starting today:
 *
 * - none while reminders are off, not permitted, before the challenge starts
 *   (onboarding) or after the summit;
 * - none today once today's day is complete — the next one is tomorrow's,
 *   for the next challenge day;
 * - none today if today's time has already passed.
 *
 * Each carries its challenge day, so its words fit it (a checkpoint, the
 * summit). Days past 90 stay Day 90 until the Final Battle is won, as the
 * challenge itself does.
 */
export function planReminders(
  state: ReminderState,
  permission: NotificationPermission['status'],
  now: Date,
  windowDays: number = REMINDER_WINDOW_DAYS,
): PlannedReminder[] {
  if (!remindersActive(state, permission)) return [];

  const today = toLocalDate(now);
  const clock = toClock(state.time);
  const planned: PlannedReminder[] = [];
  for (let offset = 0; offset < windowDays; offset += 1) {
    const date = addDays(today, offset);
    if (offset === 0 && (state.isTodayComplete || momentOf(date, state.time) <= now)) continue;
    const day = getChallengeDay(state.challengeStartDate, parseLocalDate(date));
    const copy = reminderCopy(day, state.dayKinds.get(day) ?? 'regular');
    planned.push({
      id: reminderId(date),
      date,
      day,
      title: copy.title,
      body: copy.body,
      // The zone's offset at that moment: after a flight or a DST change it
      // differs, and the reminder is planned again (Android fixes the instant).
      data: {
        kind: 'dailyReminder',
        date,
        day,
        time: clock,
        utcOffset: momentOf(date, state.time).getTimezoneOffset(),
      },
      trigger: { type: 'localDateTime', date, hour: state.time.hour, minute: state.time.minute },
    });
  }
  return planned;
}

/** Already scheduled exactly as planned: leave it alone. */
export function matchesPlan(existing: SystemNotification, planned: PlannedReminder): boolean {
  return (
    existing.title === planned.title &&
    existing.body === planned.body &&
    existing.data.date === planned.data.date &&
    existing.data.day === planned.data.day &&
    existing.data.time === planned.data.time &&
    existing.data.utcOffset === planned.data.utcOffset
  );
}
