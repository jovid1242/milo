import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STORAGE } from '@/constants/challenge';
import { DEFAULT_SETTINGS, SettingsSchema, type Settings } from '@/schemas';

type SettingsStore = Settings & {
  hasHydrated: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
};

/**
 * Global client preferences — the one thing Zustand owns here. Everything that
 * looks like data (progress, friends, achievements) belongs to TanStack Query.
 * Kept in AsyncStorage: two booleans, read synchronously by the sound and
 * haptics services.
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hasHydrated: false,
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
    }),
    {
      name: STORAGE.settingsKey,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ soundEnabled, hapticsEnabled }) => ({ soundEnabled, hapticsEnabled }),
      // Persisted values are untrusted input: validate, fall back to defaults.
      merge: (persisted, current) => {
        const parsed = SettingsSchema.partial().safeParse(persisted);
        return { ...current, ...(parsed.success ? parsed.data : {}) };
      },
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ hasHydrated: true });
      },
    },
  ),
);

export const useSoundEnabled = () => useSettingsStore((state) => state.soundEnabled);
export const useHapticsEnabled = () => useSettingsStore((state) => state.hapticsEnabled);

export const getSettings = (): Settings => {
  const { soundEnabled, hapticsEnabled } = useSettingsStore.getState();
  return { soundEnabled, hapticsEnabled };
};
