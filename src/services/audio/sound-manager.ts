import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { sounds, type SoundKey } from '@/constants/assets';
import { logger } from '@/lib/logger';
import { useSettingsStore } from '@/stores/settings-store';

export type SoundName = SoundKey;

export const SOUND_NAMES = Object.keys(sounds) as SoundName[];

/**
 * Per-sound level trim. `tapSoft` is clipped and ~15 dB louder than the rest of
 * the set (see ASSET_MANIFEST.md → AUDIO_REVIEW_REQUIRED), so it is turned down
 * until the source file is replaced.
 */
const VOLUME: Partial<Record<SoundName, number>> = {
  tapSoft: 0.3,
  finalBattle: 0.9,
  summitVictory: 0.9,
};

/**
 * One player per sound, created once and reused — no MP3 is decoded again on
 * re-render. Sound effects mix with other apps' audio and respect the iOS
 * ring/silent switch.
 */
class SoundManager {
  private readonly players = new Map<SoundName, AudioPlayer>();
  private configured = false;

  async configure(): Promise<void> {
    if (this.configured) return;
    await setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: 'mixWithOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
    });
    this.configured = true;
  }

  async preload(names: readonly SoundName[] = SOUND_NAMES): Promise<void> {
    await this.configure();
    for (const name of names) this.player(name);
  }

  play(name: SoundName): void {
    if (!useSettingsStore.getState().soundEnabled) return;
    try {
      const player = this.player(name);
      if (player.currentTime > 0) void player.seekTo(0);
      player.play();
    } catch (error) {
      logger.warn(`could not play sound "${name}"`, error);
    }
  }

  /** Releases native players (app teardown / dev reset). */
  release(): void {
    for (const player of this.players.values()) player.remove();
    this.players.clear();
    this.configured = false;
  }

  private player(name: SoundName): AudioPlayer {
    const existing = this.players.get(name);
    if (existing) return existing;
    const player = createAudioPlayer(sounds[name].source);
    player.volume = VOLUME[name] ?? 1;
    this.players.set(name, player);
    return player;
  }
}

export const soundManager = new SoundManager();

/** `playSound('questComplete')` — the single entry point for UI sound effects. */
export function playSound(name: SoundName): void {
  soundManager.play(name);
}
