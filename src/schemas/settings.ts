import { z } from 'zod';

export const SettingsSchema = z.object({
  soundEnabled: z.boolean(),
  hapticsEnabled: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  soundEnabled: true,
  hapticsEnabled: true,
};
