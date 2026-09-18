import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { logger } from '@/lib/logger';
import { useSettingsStore } from '@/stores/settings-store';

type HapticStep =
  | { kind: 'impact'; style: Haptics.ImpactFeedbackStyle }
  | { kind: 'notification'; type: Haptics.NotificationFeedbackType }
  | { kind: 'selection' }
  | { kind: 'wait'; ms: number };

export type HapticPattern =
  | 'press'
  | 'selection'
  | 'answerSelect'
  | 'correct'
  | 'wrong'
  | 'questComplete'
  | 'streakUp'
  | 'achievementUnlock'
  | 'dayComplete'
  | 'finalVictory';

const { Light, Medium, Soft, Heavy } = Haptics.ImpactFeedbackStyle;
const { Success, Warning, Error: ErrorFeedback } = Haptics.NotificationFeedbackType;

/** Subtle by default; only the Day 90 victory uses a heavy sequence. */
const PATTERNS: Record<HapticPattern, readonly HapticStep[]> = {
  press: [{ kind: 'impact', style: Light }],
  selection: [{ kind: 'selection' }],
  answerSelect: [{ kind: 'impact', style: Soft }],
  correct: [{ kind: 'notification', type: Success }],
  wrong: [{ kind: 'notification', type: ErrorFeedback }],
  questComplete: [
    { kind: 'impact', style: Light },
    { kind: 'wait', ms: 90 },
    { kind: 'notification', type: Success },
  ],
  streakUp: [
    { kind: 'impact', style: Soft },
    { kind: 'wait', ms: 80 },
    { kind: 'impact', style: Medium },
  ],
  achievementUnlock: [
    { kind: 'impact', style: Medium },
    { kind: 'wait', ms: 110 },
    { kind: 'notification', type: Success },
  ],
  dayComplete: [
    { kind: 'impact', style: Medium },
    { kind: 'wait', ms: 120 },
    { kind: 'impact', style: Medium },
    { kind: 'wait', ms: 160 },
    { kind: 'notification', type: Success },
  ],
  finalVictory: [
    { kind: 'impact', style: Light },
    { kind: 'wait', ms: 90 },
    { kind: 'impact', style: Medium },
    { kind: 'wait', ms: 110 },
    { kind: 'impact', style: Heavy },
    { kind: 'wait', ms: 220 },
    { kind: 'notification', type: Success },
  ],
};

export const WARNING_FEEDBACK = Warning;

let timers: ReturnType<typeof setTimeout>[] = [];

function perform(step: Exclude<HapticStep, { kind: 'wait' }>): void {
  const run = async () => {
    switch (step.kind) {
      case 'impact':
        return Haptics.impactAsync(step.style);
      case 'notification':
        return Haptics.notificationAsync(step.type);
      case 'selection':
        return Haptics.selectionAsync();
    }
  };
  run().catch((error: unknown) => logger.debug('haptics unavailable', error));
}

/** Cancels a running multi-step pattern (patterns never overlap). */
export function cancelHaptics(): void {
  for (const timer of timers) clearTimeout(timer);
  timers = [];
}

export function triggerHaptic(pattern: HapticPattern): void {
  if (Platform.OS === 'web') return;
  if (!useSettingsStore.getState().hapticsEnabled) return;

  cancelHaptics();
  let delay = 0;
  for (const step of PATTERNS[pattern]) {
    if (step.kind === 'wait') {
      delay += step.ms;
      continue;
    }
    if (delay === 0) perform(step);
    else timers.push(setTimeout(() => perform(step), delay));
  }
}

export const HAPTIC_PATTERNS = Object.keys(PATTERNS) as HapticPattern[];
