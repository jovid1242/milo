import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { parseLocalDate } from '@/lib/dates';
import { logger } from '@/lib/logger';

import type {
  NotificationAdapter,
  NotificationData,
  NotificationPermission,
  NotificationRequest,
  SystemNotification,
} from './notification-adapter';

/** Android shows each app's notifications in named channels; reminders get their own. */
const ANDROID_CHANNEL_ID = 'daily-reminders';

const available = Platform.OS === 'ios' || Platform.OS === 'android';

function toPermission(
  response: Notifications.NotificationPermissionsStatus,
): NotificationPermission {
  const iosStatus = response.ios?.status;
  // iOS "provisional" and "ephemeral" deliver quietly — still delivered.
  if (
    response.granted ||
    iosStatus === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    iosStatus === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return { status: 'granted' };
  }
  if (response.status === Notifications.PermissionStatus.UNDETERMINED) {
    return { status: 'undetermined' };
  }
  return { status: 'denied', canAskAgain: response.canAskAgain };
}

function toData(value: unknown): NotificationData {
  if (typeof value !== 'object' || value === null) return {};
  const data: NotificationData = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
      data[key] = entry;
    }
  }
  return data;
}

function toSystem(request: Notifications.NotificationRequest): SystemNotification {
  return {
    id: request.identifier,
    title: request.content.title ?? '',
    body: request.content.body ?? '',
    data: toData(request.content.data),
  };
}

function toTrigger(
  trigger: NotificationRequest['trigger'],
): Notifications.SchedulableNotificationTriggerInput {
  if (trigger.type === 'afterSeconds') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: trigger.seconds,
      repeats: false,
      channelId: ANDROID_CHANNEL_ID,
    };
  }
  const date = parseLocalDate(trigger.date);
  if (Platform.OS === 'ios') {
    // No time zone on purpose: iOS then matches the components against the
    // phone's current zone, so 19:00 stays 19:00 after a flight.
    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: trigger.hour,
      minute: trigger.minute,
      repeats: false,
    };
  }
  // Android has no floating calendar trigger: the moment is fixed in the zone
  // of the moment it is planned in, and every sync (each app start or return)
  // plans it again in the current one.
  date.setHours(trigger.hour, trigger.minute, 0, 0);
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: date.getTime(),
    channelId: ANDROID_CHANNEL_ID,
  };
}

let channelReady: Promise<void> | null = null;
function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Daily reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  })
    .then(() => undefined)
    .catch((error: unknown) => {
      channelReady = null;
      throw error;
    });
  return channelReady;
}

/** `expo-notifications`, local notifications only: no push token is ever requested. */
export function createExpoNotificationAdapter(): NotificationAdapter {
  return {
    async getPermission() {
      if (!available) return { status: 'unavailable' };
      return toPermission(await Notifications.getPermissionsAsync());
    },
    async requestPermission() {
      if (!available) return { status: 'unavailable' };
      return toPermission(
        await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false },
        }),
      );
    },
    async schedule(request) {
      if (!available) throw new Error('Notifications are not available on this platform');
      await ensureAndroidChannel();
      await Notifications.scheduleNotificationAsync({
        identifier: request.id,
        content: { title: request.title, body: request.body, data: request.data, sound: true },
        trigger: toTrigger(request.trigger),
      });
    },
    async cancel(id) {
      if (!available) return;
      await Notifications.cancelScheduledNotificationAsync(id);
    },
    async getScheduled() {
      if (!available) return [];
      return (await Notifications.getAllScheduledNotificationsAsync()).map(toSystem);
    },
    async getPresented() {
      if (!available) return [];
      return (await Notifications.getPresentedNotificationsAsync()).map((notification) =>
        toSystem(notification.request),
      );
    },
    async dismiss(id) {
      if (!available) return;
      await Notifications.dismissNotificationAsync(id);
    },
    onTap(listener) {
      if (!available) return { remove: () => undefined };
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        listener(toData(response.notification.request.content.data));
      });
      return { remove: () => subscription.remove() };
    },
  };
}

/**
 * How a notification behaves when it arrives while Milo is open. A daily
 * reminder says nothing new to someone already here, so it stays quiet;
 * anything else (the developer test) shows as usual.
 */
export function configureForegroundPresentation(): void {
  if (!available) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const quiet = notification.request.content.data?.kind === 'dailyReminder';
        return {
          shouldShowBanner: !quiet,
          shouldShowList: !quiet,
          shouldPlaySound: !quiet,
          shouldSetBadge: false,
        };
      },
    });
  } catch (error: unknown) {
    logger.warn('notification handler could not be set', error);
  }
}
