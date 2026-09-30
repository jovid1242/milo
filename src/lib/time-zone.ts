import type { LocalDate } from '@/schemas';

/**
 * Time zones by IANA name. The app counts challenge days on the device's
 * calendar; the server keeps the zone the challenge started in and counts
 * its days there.
 */

/** The device's time zone, e.g. `Asia/Tashkent`; `UTC` when the platform cannot tell. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Whether this runtime knows the zone. */
export function isKnownTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date of `instant` in `timeZone`, `YYYY-MM-DD`. */
export function localDateIn(timeZone: string, instant: Date): LocalDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: 'year' | 'month' | 'day') =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
