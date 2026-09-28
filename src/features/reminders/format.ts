import type { ReminderTime } from '@/schemas';

/** The reminder time as the phone shows times: "7:00 PM" or "19:00". */
export function formatReminderTime(time: ReminderTime): string {
  return toPickerDate(time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** A `Date` carrying the time, for the native picker (the date part is ignored). */
export function toPickerDate(time: ReminderTime): Date {
  return new Date(2000, 0, 1, time.hour, time.minute);
}

export function fromPickerDate(date: Date): ReminderTime {
  return { hour: date.getHours(), minute: date.getMinutes() };
}
