import { z } from 'zod';

/**
 * The user's preferences — only settings that really do something. Stored on
 * the device; the sound and haptics services read them centrally.
 */
export const SettingsSchema = z.object({
  soundEnabled: z.boolean(),
  hapticsEnabled: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

/** Safe defaults: feedback on, as the app is designed to feel. */
export const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  hapticsEnabled: true,
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
  return { soundEnabled: field('soundEnabled'), hapticsEnabled: field('hapticsEnabled') };
}
