import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { TEAM_UPDATES_CHANNEL_ID } from '@/schemas';

import type { PushAdapter, PushData, PushTap } from './push-adapter';

/** The EAS project the Expo push tokens belong to (app config → `extra.eas.projectId`). */
function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const id = extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Why no token came back, in words for the switch. */
export class PushTokenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'PushTokenError';
  }
}

const isObject = (value: unknown): value is PushData =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What a notification carried. Expo's push service puts it in the FCM
 * message's `body` (a JSON string), which the module hands over as
 * `content.data`; a notification Android showed by itself while Milo was in
 * the background may still have it only in the remote message.
 */
function dataOf(request: Notifications.NotificationRequest): PushData {
  const data: unknown = request.content.data;
  if (isObject(data) && Object.keys(data).length > 0) return data;
  const trigger = request.trigger as { remoteMessage?: { data?: Record<string, unknown> } } | null;
  const body = trigger?.remoteMessage?.data?.['body'];
  if (typeof body !== 'string') return {};
  try {
    const parsed: unknown = JSON.parse(body);
    return isObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const toTap = (response: Notifications.NotificationResponse): PushTap => ({
  id: response.notification.request.identifier,
  data: dataOf(response.notification.request),
});

/**
 * `expo-notifications` for remote team notifications: Android only for now,
 * and never in Expo Go, which cannot receive them on Android.
 */
export function createExpoPushAdapter(): PushAdapter {
  const project = projectId();
  const supported = Platform.OS === 'android' && !isRunningInExpoGo() && project !== null;

  return {
    supported,
    async ensureChannel() {
      if (Platform.OS !== 'android') return;
      await Notifications.setNotificationChannelAsync(TEAM_UPDATES_CHANNEL_ID, {
        name: 'Team updates',
        description: 'A teammate joins or finishes their day, and your team streak.',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    },
    async getToken() {
      if (!supported || !project) throw new PushTokenError('Push is not available in this build.');
      try {
        return (await Notifications.getExpoPushTokenAsync({ projectId: project })).data;
      } catch (error) {
        throw new PushTokenError(
          Device.isDevice
            ? 'This phone could not get a push token (it needs Google Play services and a connection).'
            : 'This emulator could not get a push token: it needs Google Play services.',
          { cause: error },
        );
      }
    },
    onTokenChange(listener) {
      if (!supported) return { remove: () => undefined };
      const subscription = Notifications.addPushTokenListener(() => listener());
      return { remove: () => subscription.remove() };
    },
    onReceive(listener) {
      if (!supported) return { remove: () => undefined };
      const subscription = Notifications.addNotificationReceivedListener((notification) =>
        listener(dataOf(notification.request)),
      );
      return { remove: () => subscription.remove() };
    },
    onTap(listener) {
      if (!supported) return { remove: () => undefined };
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        listener(toTap(response));
      });
      return { remove: () => subscription.remove() };
    },
    launchTap() {
      if (!supported) return null;
      const response = Notifications.getLastNotificationResponse();
      if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER)
        return null;
      return toTap(response);
    },
    clearLaunchTap() {
      if (supported) Notifications.clearLastNotificationResponse();
    },
  };
}
