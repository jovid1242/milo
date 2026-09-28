import type { NotificationPermission } from '@/services/notifications/notification-adapter';

/**
 * What turning the reminder on takes, given the permission as it stands:
 * nothing more (`enable`), a word of explanation before the system dialog
 * (`explain`), a trip to the system Settings (`blocked`), or it cannot work
 * here at all (`unavailable`).
 */
export type EnableStep = 'enable' | 'explain' | 'blocked' | 'unavailable';

export function enableStep(permission: NotificationPermission): EnableStep {
  switch (permission.status) {
    case 'granted':
      return 'enable';
    case 'undetermined':
      return 'explain';
    case 'denied':
      return permission.canAskAgain ? 'explain' : 'blocked';
    case 'unavailable':
      return 'unavailable';
  }
}

/** How the system dialog ended. */
export type RequestOutcome = 'enabled' | 'denied' | 'blocked' | 'unavailable';

export function requestOutcome(permission: NotificationPermission): RequestOutcome {
  switch (permission.status) {
    case 'granted':
      return 'enabled';
    // Dismissed without an answer: as good as "not now".
    case 'undetermined':
      return 'denied';
    case 'denied':
      return permission.canAskAgain ? 'denied' : 'blocked';
    case 'unavailable':
      return 'unavailable';
  }
}

/**
 * The preference says "on" but the system took the permission away (in iOS
 * Settings, or by resetting privacy). The switch must not pretend otherwise.
 * An `unavailable` read proves nothing — the preference survives it.
 */
export function permissionRevoked(enabled: boolean, permission: NotificationPermission): boolean {
  return enabled && (permission.status === 'denied' || permission.status === 'undetermined');
}
