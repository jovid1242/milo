import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STORAGE } from '@/constants/challenge';
import { DEFAULT_SETTINGS, parseSettings, type Settings } from '@/schemas';

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
  const { soundEnabled, hapticsEnabled } = useSettingsStore.getState();
  return { soundEnabled, hapticsEnabled };
};
