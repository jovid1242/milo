import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STORAGE } from '@/constants/challenge';
import {
  DEFAULT_SETTINGS,
  ReminderTimeSchema,
  parseSettings,
  type ReminderTime,
  type Settings,
} from '@/schemas';

type SettingsStore = Settings & {
  hasHydrated: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  /** The preference only; scheduling follows it (`features/reminders`). */
  setDailyReminderEnabled: (enabled: boolean) => void;
  setDailyReminderTime: (time: ReminderTime) => void;
};

/**
 * Global client preferences — the one thing Zustand owns here. Everything that
 * looks like data (progress, friends, achievements) belongs to TanStack Query.
 * Kept in AsyncStorage: read synchronously by the sound, haptics and reminder
 * services.
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hasHydrated: false,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setDailyReminderEnabled: (dailyReminderEnabled) => set({ dailyReminderEnabled }),
      // A picker only produces valid times; the check keeps a bad caller from
      // persisting one anyway.
      setDailyReminderTime: (time) => set({ dailyReminderTime: ReminderTimeSchema.parse(time) }),
    }),
    {
      name: STORAGE.settingsKey,
      // v2: the daily reminder (enabled + time). Older data keeps its values and
      // gets the reminder defaults.
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ soundEnabled, hapticsEnabled, dailyReminderEnabled, dailyReminderTime }) => ({
        soundEnabled,
        hapticsEnabled,
        dailyReminderEnabled,
        dailyReminderTime,
      }),
      // An older stored version keeps whatever of it is still valid.
      migrate: (persisted) => parseSettings(persisted),
      // Persisted values are untrusted input: every field is validated, bad ones default.
      merge: (persisted, current) => ({ ...current, ...parseSettings(persisted) }),
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ hasHydrated: true });
      },
    },
  ),
);

export const useSoundEnabled = () => useSettingsStore((state) => state.soundEnabled);
export const useHapticsEnabled = () => useSettingsStore((state) => state.hapticsEnabled);

export const getSettings = (): Settings => {
  const { soundEnabled, hapticsEnabled, dailyReminderEnabled, dailyReminderTime } =
    useSettingsStore.getState();
  return { soundEnabled, hapticsEnabled, dailyReminderEnabled, dailyReminderTime };
};
