import { enableStep, requestOutcome } from '@/features/reminders/logic/permission';
import type { NotificationPermission } from '@/services/notifications/notification-adapter';

import type { TurnOnResult } from '../team-notifications';

/** What the switch has to explain before or after the system dialog — the reminder's steps. */
export type TeamNotificationPrompt = 'explain' | 'denied' | 'blocked' | 'unavailable';

/** Why the switch did not turn on, when the permission was not the reason. */
export type TeamNotificationNote = 'offline' | 'failed';

export type SwitchOutcome =
  | { kind: 'on' }
  | { kind: 'prompt'; prompt: TeamNotificationPrompt }
  | { kind: 'note'; note: TeamNotificationNote };

export type SwitchDeps = {
  online: boolean;
  getPermission: () => Promise<NotificationPermission>;
  requestPermission: () => Promise<NotificationPermission>;
  /** Token, then the server (`TeamNotifications.turnOn`). */
  turnOn: () => Promise<TurnOnResult>;
};

async function register(deps: SwitchDeps): Promise<SwitchOutcome> {
  const result = await deps.turnOn();
  if (result === 'on') return { kind: 'on' };
  if (result === 'unavailable') return { kind: 'prompt', prompt: 'unavailable' };
  return { kind: 'note', note: result };
}

/**
 * The switch flipped on. Already allowed: on at once. Otherwise a word first,
 * never a bare system dialog — the same steps as the daily reminder's. The
 * server has to hear of it, so offline there is nothing to ask for.
 */
export async function switchOn(deps: SwitchDeps): Promise<SwitchOutcome> {
  if (!deps.online) return { kind: 'note', note: 'offline' };
  const step = enableStep(await deps.getPermission());
  if (step !== 'enable') return { kind: 'prompt', prompt: step };
  return register(deps);
}

/** "Allow" in the explanation: the system dialog — and only a real yes goes on to the server. */
export async function allowAndSwitchOn(deps: SwitchDeps): Promise<SwitchOutcome> {
  const outcome = requestOutcome(await deps.requestPermission());
  if (outcome !== 'enabled') return { kind: 'prompt', prompt: outcome };
  return register(deps);
}
