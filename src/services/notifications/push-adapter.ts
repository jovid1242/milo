import type { Subscription } from './notification-adapter';

/**
 * The boundary between team notifications and the phone's push system — the
 * remote side of `expo-notifications`, apart from the local notifications the
 * daily reminder schedules. Everything above it is logic that tests drive
 * through a fake; nothing here ever sends a notification.
 */

/** What a notification carried, as the system hands it back. */
export type PushData = Record<string, unknown>;

/** A tap on a notification: which one (to act on it once), and what it carried. */
export type PushTap = { id: string; data: PushData };

export interface PushAdapter {
  /**
   * Whether this build can get a push token at all: an Android development or
   * store build with Firebase — not Expo Go, and not iOS until its push keys
   * are set up.
   */
  readonly supported: boolean;
  /** Android's channel for team news. Creating it asks the user nothing. */
  ensureChannel(): Promise<void>;
  /** This device's Expo push token. Expo's servers make it: it needs the network. */
  getToken(): Promise<string>;
  /** The system gave the app a new device token: the Expo token may have changed. */
  onTokenChange(listener: () => void): Subscription;
  /** A notification arrived while Milo is open. */
  onReceive(listener: (data: PushData) => void): Subscription;
  /** The user tapped a notification, Milo running or not. */
  onTap(listener: (tap: PushTap) => void): Subscription;
  /** The tap that opened Milo from nothing, if one did and it was not handled yet. */
  launchTap(): PushTap | null;
  /** That tap was handled: it does not come back on the next launch of this screen tree. */
  clearLaunchTap(): void;
}
