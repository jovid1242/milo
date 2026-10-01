import type { Subscription } from '@/services/notifications/notification-adapter';
import type { PushAdapter, PushTap } from '@/services/notifications/push-adapter';

import { destinationOf, teamPayload, type PushDestination } from './logic/routing';

/**
 * Team notifications arriving: tapped — Milo running, in the background or
 * not running at all — or while it is open. Anything that is not team news
 * (the daily reminder) is left to its own handler.
 */

/** When a tap can be acted on: the navigation is mounted, and there is a challenge to show. */
export type TapReadiness = { navigation: boolean; inChallenge: boolean };

export function createTapRouter(deps: {
  push: PushAdapter;
  /** Shows the destination, from wherever the user is (see `lib/open-tab.ts`). */
  openTab: (destination: PushDestination) => void;
}) {
  /** Each notification opens once, however many times — and ways — its tap is reported. */
  const handled = new Set<string>();
  /** A tap waiting for the navigation (a cold start reads it before anything is mounted). */
  let pending: PushDestination | null = null;
  let readiness: TapReadiness = { navigation: false, inChallenge: false };

  function flush(): void {
    if (pending === null || !readiness.navigation) return;
    const destination = pending;
    pending = null;
    // Signed out or before the challenge there is no team screen: the tap is dropped.
    if (readiness.inChallenge) deps.openTab(destination);
  }

  /** A tap, as the system reports it: from the listener, or the one that launched Milo. */
  function receive(tap: PushTap): void {
    if (handled.has(tap.id)) return;
    const payload = teamPayload(tap.data);
    if (!payload) return;
    handled.add(tap.id);
    // Consumed: neither a remount nor a reload reads it as a launch tap again.
    deps.push.clearLaunchTap();
    pending = destinationOf(payload);
    flush();
  }

  return {
    receive,
    /** The tap that launched Milo, if any (a cold start may deliver it only here). */
    receiveLaunchTap(): void {
      const tap = deps.push.launchTap();
      if (tap) receive(tap);
    },
    /** The navigation mounted (or went away) and who is signed in: a waiting tap opens when it can. */
    setReadiness(next: TapReadiness): void {
      readiness = next;
      flush();
    },
  };
}

export type TapRouter = ReturnType<typeof createTapRouter>;

/** Team news while Milo is open: the system shows it, and the team is fetched again. */
export function watchTeamNews(push: PushAdapter, refreshTeam: () => void): Subscription {
  return push.onReceive((data) => {
    if (teamPayload(data)) refreshTeam();
  });
}
