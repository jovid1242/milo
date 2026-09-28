import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { AppState } from 'react-native';

import { useCourseOutline } from '@/features/course/queries';
import { useUser } from '@/features/profile/queries';
import { useProgressState } from '@/features/progress/queries';
import { logger } from '@/lib/logger';
import { configureForegroundPresentation } from '@/services/notifications/expo-notification-adapter';
import type { NotificationData } from '@/services/notifications/notification-adapter';
import { useSettingsStore } from '@/stores/settings-store';

import { notificationAdapter, reminders } from '../instance';
import { permissionRevoked } from '../logic/permission';

/**
 * Keeps the scheduled reminders true to the app, from the root, with no
 * screen of its own. It follows everything a reminder depends on — the
 * preference and its time, onboarding, the challenge day, today finished,
 * the summit reached — and syncs whenever any of it changes, whatever changed
 * it (a quest, an exam, Settings, the developer tools). Returning to the app
 * syncs too: a new day may have begun, or the permission changed in iOS
 * Settings.
 *
 * Gameplay never calls into reminders, and reminders never touch gameplay.
 */
export function ReminderSync({ onboarded }: { onboarded: boolean }) {
  const progress = useProgressState();
  const user = useUser();
  const outline = useCourseOutline();
  const hydrated = useSettingsStore((state) => state.hasHydrated);
  const enabled = useSettingsStore((state) => state.dailyReminderEnabled);
  const hour = useSettingsStore((state) => state.dailyReminderTime.hour);
  const minute = useSettingsStore((state) => state.dailyReminderTime.minute);
  const setEnabled = useSettingsStore((state) => state.setDailyReminderEnabled);
  const [returns, setReturns] = useState(0);

  useEffect(() => {
    configureForegroundPresentation();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') setReturns((count) => count + 1);
    });
    return () => subscription.remove();
  }, []);

  // A tapped reminder opens today's journey — or, after the summit, the
  // finished Home; `/` is both. `dismissTo` returns to the Home that is
  // already there, closing whatever was left open above it (its progress is
  // saved); `navigate` would stack a second Home on top of it.
  const openToday = useEffectEvent((data: NotificationData) => {
    if (!onboarded) return;
    if (data.kind === 'dailyReminder' || data.kind === 'testReminder') router.dismissTo('/');
  });
  useEffect(() => {
    const subscription = notificationAdapter.onTap((data) => openToday(data));
    return () => subscription.remove();
  }, []);

  // The system took the permission away: the preference follows, so Settings
  // never shows a switch that cannot work.
  const followPermission = useEffectEvent((permission: Parameters<typeof permissionRevoked>[1]) => {
    if (permissionRevoked(enabled, permission)) setEnabled(false);
  });

  const state = progress.data;
  const startDate = user.data?.challengeStartDate;
  const currentDay = state?.currentDay;
  const isTodayComplete = state?.isTodayComplete ?? false;
  const challengeCompleted = (state?.challengeCompletion ?? null) !== null;
  // Checkpoints and the summit get their own words: the course says which days they are.
  const courseDays = outline.data?.days;
  const ready =
    hydrated && state !== undefined && startDate !== undefined && courseDays !== undefined;

  useEffect(() => {
    if (!ready || startDate === undefined || courseDays === undefined) return;
    let current = true;
    reminders
      .syncDailyReminders({
        dayKinds: new Map(courseDays.map((day) => [day.day, day.kind])),
        enabled,
        time: { hour, minute },
        onboarded,
        challengeStartDate: startDate,
        isTodayComplete,
        challengeCompleted,
      })
      .then((report) => {
        if (current) followPermission(report.permission);
      })
      .catch((error: unknown) => logger.warn('reminder sync failed', error));
    return () => {
      current = false;
    };
    // `currentDay` and `returns` only schedule a new sync: a new day shifts
    // the plan, a return may bring a changed permission.
  }, [
    ready,
    enabled,
    hour,
    minute,
    onboarded,
    startDate,
    currentDay,
    isTodayComplete,
    challengeCompleted,
    courseDays,
    returns,
  ]);

  return null;
}
