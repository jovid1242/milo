import { useState } from 'react';
import { Linking } from 'react-native';

import { reminders } from '@/features/reminders/instance';
import { useOnline } from '@/hooks/use-online';
import { logger } from '@/lib/logger';
import { usePushStore } from '@/stores/push-store';

import { teamNotifications } from './instance';
import {
  allowAndSwitchOn,
  switchOn,
  type SwitchDeps,
  type SwitchOutcome,
  type TeamNotificationNote,
  type TeamNotificationPrompt,
} from './logic/switch-flow';

export type { TeamNotificationNote, TeamNotificationPrompt } from './logic/switch-flow';

/**
 * The Team notifications switch, kept out of the screen. Turning it on goes
 * through the daily reminder's permission flow (`logic/switch-flow.ts`) —
 * only ever from here, never on its own at launch — then registers the device
 * with the server: on only once the server has it.
 */
export function useTeamNotificationSettings(owner: string) {
  const enabled = usePushStore((state) => state.enabled.includes(owner));
  const online = useOnline();
  const [prompt, setPrompt] = useState<TeamNotificationPrompt | null>(null);
  const [note, setNote] = useState<TeamNotificationNote | null>(null);
  const [busy, setBusy] = useState(false);

  const deps: SwitchDeps = {
    online,
    getPermission: () => reminders.getPermissionStatus(),
    requestPermission: () => reminders.requestPermission(),
    turnOn: () => teamNotifications.turnOn(owner),
  };

  const run = async (step: (deps: SwitchDeps) => Promise<SwitchOutcome>) => {
    setBusy(true);
    try {
      const outcome = await step(deps);
      setPrompt(outcome.kind === 'prompt' ? outcome.prompt : null);
      setNote(outcome.kind === 'note' ? outcome.note : null);
    } catch (error) {
      logger.warn('team notifications could not be turned on', error);
      setNote('failed');
    } finally {
      setBusy(false);
    }
  };

  return {
    enabled,
    prompt,
    note,
    busy,
    toggle(next: boolean) {
      setPrompt(null);
      setNote(null);
      if (next) {
        void run(switchOn);
        return;
      }
      teamNotifications
        .turnOff(owner)
        .catch((error: unknown) =>
          logger.warn('team notifications could not be turned off', error),
        );
    },
    allow() {
      setPrompt(null);
      void run(allowAndSwitchOn);
    },
    dismiss() {
      setPrompt(null);
    },
    openSystemSettings() {
      setPrompt(null);
      Linking.openSettings().catch((error: unknown) =>
        logger.warn('could not open the system settings', error),
      );
    },
  };
}
