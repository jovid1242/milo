import { z } from 'zod';

/**
 * A time of day on the device's clock. The daily reminder fires at it in
 * whatever time zone the phone is in — never at a fixed instant.
 */
export const ReminderTimeSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});
export type ReminderTime = z.infer<typeof ReminderTimeSchema>;

/**
 * The user's preferences — only settings that really do something. Stored on
 * the device; the sound, haptics and reminder services read them centrally.
 */
export const SettingsSchema = z.object({
  soundEnabled: z.boolean(),
  hapticsEnabled: z.boolean(),
  /**
   * The daily reminder, as chosen in Settings. Only ever `true` while the
   * system allows notifications: it is switched on after permission is
   * granted, and back off when the permission is taken away.
   */
  dailyReminderEnabled: z.boolean(),
  dailyReminderTime: ReminderTimeSchema,
});
export type Settings = z.infer<typeof SettingsSchema>;

/**
 * Safe defaults: feedback on, as the app is designed to feel. The reminder is
 * off: notification permission is never asked for without the user asking.
 */
export const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  hapticsEnabled: true,
  dailyReminderEnabled: false,
  dailyReminderTime: { hour: 19, minute: 0 },
};

/**
 * Stored preferences are untrusted input (an old version, a corrupted write):
 * every field is checked on its own, and anything unusable falls back to its
 * default — one bad value never resets the others, and nothing can crash.
 */
export function parseSettings(stored: unknown): Settings {
  const source = typeof stored === 'object' && stored !== null ? stored : {};
  const field = <K extends keyof Settings>(key: K): Settings[K] => {
    const parsed = SettingsSchema.shape[key].safeParse((source as Record<string, unknown>)[key]);
    return parsed.success ? (parsed.data as Settings[K]) : DEFAULT_SETTINGS[key];
  };
  return {
    soundEnabled: field('soundEnabled'),
    hapticsEnabled: field('hapticsEnabled'),
    dailyReminderEnabled: field('dailyReminderEnabled'),
    dailyReminderTime: field('dailyReminderTime'),
  };
}
