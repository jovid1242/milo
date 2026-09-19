// babel-jest hoists the jest.mock calls below above these imports.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

import { STORAGE } from '@/constants/challenge';
import { playSound } from '@/services/audio/sound-manager';
import { playFeedback } from '@/services/feedback';
import { cancelHaptics, triggerHaptic } from '@/services/haptics/haptics';
import { useSettingsStore } from '@/stores/settings-store';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- the package's own jest mock
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const mockPlayer = {
  play: jest.fn(),
  seekTo: jest.fn(),
  remove: jest.fn(),
  currentTime: 0,
  volume: 1,
};
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => mockPlayer),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Soft: 'soft', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

beforeEach(() => {
  jest.clearAllMocks();
  cancelHaptics();
  useSettingsStore.setState({ soundEnabled: true, hapticsEnabled: true });
});

describe('sound', () => {
  it('plays only while sound effects are on — for every moment', () => {
    playSound('correct');
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    useSettingsStore.getState().setSoundEnabled(false);
    playSound('correct');
    playSound('wrong');
    playFeedback('dayComplete');
    playFeedback('achievementUnlock');
    expect(mockPlayer.play).toHaveBeenCalledTimes(1);

    useSettingsStore.getState().setSoundEnabled(true);
    playSound('questComplete');
    expect(mockPlayer.play).toHaveBeenCalledTimes(2);
  });
});

describe('haptics', () => {
  it('stay silent while haptics are off — through the one central helper', () => {
    triggerHaptic('press');
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);

    useSettingsStore.getState().setHapticsEnabled(false);
    triggerHaptic('press');
    triggerHaptic('dayComplete');
    playFeedback('correct');
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });
});

describe('persistence', () => {
  it('keeps sound and haptics off across a restart', async () => {
    useSettingsStore.getState().setSoundEnabled(false);
    useSettingsStore.getState().setHapticsEnabled(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stored = await AsyncStorage.getItem(STORAGE.settingsKey);
    expect(JSON.parse(stored ?? '{}').state).toEqual({
      soundEnabled: false,
      hapticsEnabled: false,
    });

    // "Restart": a fresh app (new modules) finds the same stored JSON at launch.
    let restarted: { soundEnabled: boolean; hapticsEnabled: boolean } | undefined;
    await jest.isolateModulesAsync(async () => {
      // The mock is a CommonJS module: the storage object itself, no `default`.
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module registry
      const module = require('@react-native-async-storage/async-storage');
      const storage = module.default ?? module;
      await storage.setItem(STORAGE.settingsKey, stored);
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh module registry
      const { useSettingsStore: fresh } = require('@/stores/settings-store');
      await fresh.persist.rehydrate();
      restarted = fresh.getState();
    });
    expect(restarted).toMatchObject({ soundEnabled: false, hapticsEnabled: false });
  });

  it('falls back safely when the stored preferences are corrupted', async () => {
    await AsyncStorage.setItem(
      STORAGE.settingsKey,
      JSON.stringify({ state: { soundEnabled: 'loud', hapticsEnabled: false }, version: 1 }),
    );
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({
      soundEnabled: true,
      hapticsEnabled: false,
    });

    await AsyncStorage.setItem(STORAGE.settingsKey, 'not json at all');
    await expect(useSettingsStore.persist.rehydrate()).resolves.toBeUndefined();
    expect(typeof useSettingsStore.getState().soundEnabled).toBe('boolean');
  });
});
