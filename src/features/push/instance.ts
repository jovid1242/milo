import { router } from 'expo-router';
import { Platform } from 'react-native';

import { reminders } from '@/features/reminders/instance';
import { deviceServices } from '@/providers/app-session';
import { createExpoPushAdapter } from '@/services/notifications/expo-push-adapter';
import { pushStateStore } from '@/stores/push-store';

import { createTapRouter } from './incoming';
import { createTeamNotifications } from './team-notifications';

/** The phone's push system, and team notifications over it — one of each. */
export const pushAdapter = createExpoPushAdapter();

export const teamNotifications = createTeamNotifications({
  push: pushAdapter,
  // One permission for the reminder and team news, read the way the reminder reads it.
  permissions: { getPermission: () => reminders.getPermissionStatus() },
  api: deviceServices.pushApi,
  state: pushStateStore,
  platform: Platform.OS === 'ios' ? 'ios' : 'android',
});

/**
 * Taps open the team's news — or Today for "your turn". `dismissTo` returns to
 * the screen that is already there, closing whatever was open above it (as a
 * tapped reminder does); `navigate` would stack a second copy on top.
 */
export const tapRouter = createTapRouter({
  push: pushAdapter,
  navigate: (destination) => router.dismissTo(destination),
});
