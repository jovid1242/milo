import { z } from 'zod';

import { DayNumberSchema } from './common';

/**
 * Team notifications, pushed by the Milo API through Expo's push service
 * (Firebase Cloud Messaging on Android). The phone registers its Expo push
 * token for the signed-in session when the user turns Team Notifications on;
 * the server decides what to send, and when. The Daily Reminder is not one of
 * them: it stays a local notification, scheduled on the phone.
 */

/** Where a token was made. Only Android has push set up (iOS needs APNs first). */
export const PushPlatformSchema = z.enum(['android', 'ios']);
export type PushPlatform = z.infer<typeof PushPlatformSchema>;

/**
 * `ExponentPushToken[…]`, as `getExpoPushTokenAsync` returns it. It lets
 * anyone who has it notify the device through Milo's Expo project, so it is
 * never logged whole, anywhere.
 */
export const ExpoPushTokenSchema = z
  .string()
  .max(256)
  .regex(/^Expo(?:nent)?PushToken\[[^\]\s]{1,200}\]$/);
export type ExpoPushToken = z.infer<typeof ExpoPushTokenSchema>;

/** `PUT /push/devices/current`: this signed-in device wants team notifications. */
export const RegisterPushDeviceRequestSchema = z.strictObject({
  token: ExpoPushTokenSchema,
  platform: PushPlatformSchema,
});
export type RegisterPushDeviceRequest = z.infer<typeof RegisterPushDeviceRequestSchema>;

/**
 * `POST /push/devices/unregister`: a device that signed out forgets its token
 * — without an account, since the session may be gone by then.
 */
export const UnregisterPushTokenRequestSchema = z.strictObject({ token: ExpoPushTokenSchema });
export type UnregisterPushTokenRequest = z.infer<typeof UnregisterPushTokenRequestSchema>;

/** What a team notification is about. */
export const PUSH_KINDS = [
  'TEAM_MEMBER_JOINED',
  'TEAM_MEMBER_COMPLETED_DAY',
  'TEAM_YOUR_TURN',
  'TEAM_DAY_COMPLETE',
  'TEAM_STREAK_MILESTONE',
] as const;
export const PushKindSchema = z.enum(PUSH_KINDS);
export type PushKind = z.infer<typeof PushKindSchema>;

/** Team streak lengths worth a notification. */
export const TEAM_STREAK_MILESTONES = [7, 14, 30, 50, 90] as const;

/**
 * Android's notification channel for them: apart from the Daily Reminder's,
 * so either can be muted in the system settings without the other.
 */
export const TEAM_UPDATES_CHANNEL_ID = 'team-updates';

/**
 * What a team notification carries for the app, and nothing more: what
 * happened and in which team — never an email, an answer, an invite code or
 * anything else of anyone's. The words are the notification's own.
 */
export const PushPayloadSchema = z.object({
  kind: PushKindSchema,
  teamId: z.uuid(),
  /** The recipient's challenge day the news is about (day news only). */
  dayNumber: DayNumberSchema.optional(),
});
export type PushPayload = z.infer<typeof PushPayloadSchema>;
