import type { Subscription } from '@/services/notifications/notification-adapter';
import type { PushAdapter, PushTap } from '@/services/notifications/push-adapter';

import { destinationOf, teamPayload, type PushDestination } from './logic/routing';

/**
 * Team notifications arriving: tapped — Milo running, in the background or
 * not running at all — or while it is open. Anything that is not team news
 * (the daily reminder) is left to its own handler.
 */

export function createTapRouter(deps: {
  push: PushAdapter;
  navigate: (destination: PushDestination) => void;
}) {
  /** Each notification opens once, however many times its tap is reported. */
  const handled = new Set<string>();

  function open(tap: PushTap, inChallenge: boolean): boolean {
    const payload = teamPayload(tap.data);
    // Signed out or before the challenge there is no team screen to open.
    if (!payload || !inChallenge || handled.has(tap.id)) return false;
    handled.add(tap.id);
    deps.navigate(destinationOf(payload));
    return true;
  }

  return {
    open,
    /** The tap that launched Milo, once its navigator is up — then it is forgotten. */
    openLaunchTap(inChallenge: boolean): void {
      const tap = deps.push.launchTap();
      if (tap && open(tap, inChallenge)) deps.push.clearLaunchTap();
    },
  };
}

/** Team news while Milo is open: the system shows it, and the team is fetched again. */
export function watchTeamNews(push: PushAdapter, refreshTeam: () => void): Subscription {
  return push.onReceive((data) => {
    if (teamPayload(data)) refreshTeam();
  });
}
