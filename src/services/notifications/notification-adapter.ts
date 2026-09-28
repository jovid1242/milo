import type { LocalDate } from '@/schemas';

/**
 * The boundary between the app and the phone's notification system. Everything
 * above it — what to schedule, when, and what to cancel — is plain logic that
 * tests drive through a fake; everything below it is the platform.
 */

/** Whether the system lets the app post notifications. */
export type NotificationPermission =
  | { status: 'granted' }
  /** Never asked: the system dialog can still be shown. */
  | { status: 'undetermined' }
  /** Refused. `canAskAgain: false` means only the system Settings can change it. */
  | { status: 'denied'; canAskAgain: boolean }
  /** No notification system here (web, a missing native module, a failing call). */
  | { status: 'unavailable' };

export type NotificationData = Record<string, string | number | boolean>;

export type NotificationTrigger =
  /**
   * A wall-clock moment: `hour:minute` on `date`, in the device's time zone.
   * On iOS it floats — it fires at that clock time wherever the phone is.
   */
  | { type: 'localDateTime'; date: LocalDate; hour: number; minute: number }
  /** A delay from now (developer test notifications). */
  | { type: 'afterSeconds'; seconds: number };

export type NotificationRequest = {
  /** Stable identifier: scheduling it again replaces, never duplicates. */
  id: string;
  title: string;
  body: string;
  data: NotificationData;
  trigger: NotificationTrigger;
};

/** A notification as the system reports it: pending, or delivered and still shown. */
export type SystemNotification = {
  id: string;
  title: string;
  body: string;
  data: NotificationData;
};

export type Subscription = { remove: () => void };

export interface NotificationAdapter {
  getPermission(): Promise<NotificationPermission>;
  /** Shows the system dialog when it still can; otherwise reports the current state. */
  requestPermission(): Promise<NotificationPermission>;
  schedule(request: NotificationRequest): Promise<void>;
  cancel(id: string): Promise<void>;
  /** Everything waiting to be delivered. */
  getScheduled(): Promise<SystemNotification[]>;
  /** Delivered and still in Notification Center. */
  getPresented(): Promise<SystemNotification[]>;
  dismiss(id: string): Promise<void>;
  /** The user tapped a notification; `data` is what it was scheduled with. */
  onTap(listener: (data: NotificationData) => void): Subscription;
}
