import { Platform } from 'react-native';

import { reminders } from '@/features/reminders/instance';
import { openTab } from '@/lib/open-tab';
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

/** Taps open the team's news — or Today for "your turn" — from wherever the user is. */
export const tapRouter = createTapRouter({
  push: pushAdapter,
  openTab: (destination) => openTab(destination),
});
