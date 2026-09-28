import { createExpoNotificationAdapter } from '@/services/notifications/expo-notification-adapter';

import { createReminderService } from './reminder-service';

/** The app's notification system and the daily reminder over it — one of each. */
export const notificationAdapter = createExpoNotificationAdapter();
export const reminders = createReminderService(notificationAdapter);
