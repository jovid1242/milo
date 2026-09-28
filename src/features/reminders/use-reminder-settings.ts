import { useState, useSyncExternalStore } from 'react';
import { Linking } from 'react-native';

import { logger } from '@/lib/logger';
import { useSettingsStore } from '@/stores/settings-store';

import { reminders } from './instance';
import { enableStep, requestOutcome } from './logic/permission';

/** What the Reminders group has to explain before or after the system dialog. */
export type ReminderPrompt = 'explain' | 'denied' | 'blocked' | 'unavailable';

/**
 * The Reminders group's behavior, kept out of the screen: turning the reminder
 * on goes through the permission flow; everything else is a preference change.
 * Scheduling itself is never done here — `ReminderSync` follows the
 * preferences and the challenge wherever they change.
 */
export function useReminderSettings() {
  const enabled = useSettingsStore((state) => state.dailyReminderEnabled);
  const time = useSettingsStore((state) => state.dailyReminderTime);
  const setEnabled = useSettingsStore((state) => state.setDailyReminderEnabled);
  const setTime = useSettingsStore((state) => state.setDailyReminderTime);
  const report = useSyncExternalStore(reminders.subscribe, reminders.getLastReport);
  const [prompt, setPrompt] = useState<ReminderPrompt | null>(null);
  const [busy, setBusy] = useState(false);

  const turnOn = async () => {
    setBusy(true);
    try {
      const step = enableStep(await reminders.getPermissionStatus());
      // Already allowed: on at once. Otherwise a word first, never a bare system dialog.
      if (step === 'enable') setEnabled(true);
      else setPrompt(step);
    } finally {
      setBusy(false);
    }
  };

  const allow = async () => {
    setPrompt(null);
    setBusy(true);
    try {
      const outcome = requestOutcome(await reminders.requestPermission());
      // The switch turns on only for a real "allow" — it never pretends.
      if (outcome === 'enabled') setEnabled(true);
      else setPrompt(outcome);
    } finally {
      setBusy(false);
    }
  };

  return {
    enabled,
    time,
    prompt,
    busy,
    /** The last sync could not set everything up (it retries on the next one). */
    failed: enabled && report !== null && report.failures > 0,
    toggle(next: boolean) {
      if (next) {
        void turnOn();
      } else {
        setPrompt(null);
        setEnabled(false);
      }
    },
    allow() {
      void allow();
    },
    dismiss() {
      setPrompt(null);
    },
    openSystemSettings() {
      setPrompt(null);
      Linking.openSettings().catch((error: unknown) =>
        logger.warn('could not open the system settings', error),
      );
    },
    setTime,
  };
}
