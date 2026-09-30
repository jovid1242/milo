import type { PushApi } from '@/data/repositories/api/push-api';
import { logger } from '@/lib/logger';
import type { PushPlatform } from '@/schemas';
import { ApiError } from '@/services/api/api-error';
import type { NotificationAdapter } from '@/services/notifications/notification-adapter';
import type { PushAdapter } from '@/services/notifications/push-adapter';

/**
 * Team notifications on this device: the Settings switch, per account, and
 * the server's registration kept true to it. Pushes come from the Milo API
 * (through Expo and Firebase); this only says where to send them. The daily
 * reminder has nothing to do with it — it stays local, on its own.
 *
 * - The server registers a token for a signed-in session only. The switch is
 *   on once the server has it, never before.
 * - A registration belongs to the account signed in. Whenever another one is
 *   (or none), it is released: the token is forgotten on the server — at once
 *   when it can be reached, later when it cannot (signing out offline) — so
 *   one account's news never reaches the next account on the phone.
 * - Everything runs one step at a time: forgetting a token can never overtake
 *   the next account registering the same one.
 */

/** What the device keeps about it (with the push token in it: kept like a secret). */
export type PushState = {
  /** Accounts that turned team notifications on, on this device. */
  enabled: string[];
  /** The registration the server has, as far as this device knows. */
  registration: { owner: string; token: string } | null;
  /** Tokens to forget on the server: their account signed out before it could be told. */
  forget: string[];
};

export const EMPTY_PUSH_STATE: PushState = { enabled: [], registration: null, forget: [] };

export interface PushStateStore {
  /** Resolves once what a previous launch kept has been read. */
  ready(): Promise<void>;
  get(): PushState;
  set(next: PushState): Promise<void>;
}

/** How turning the switch on ended. */
export type TurnOnResult = 'on' | 'offline' | 'failed' | 'unavailable';

export type TeamNotificationsDeps = {
  push: PushAdapter;
  /** The phone's notification permission — one for the reminder and team news. */
  permissions: Pick<NotificationAdapter, 'getPermission'>;
  /** `null` in local mode: no server, no team notifications. */
  api: PushApi | null;
  state: PushStateStore;
  platform: PushPlatform;
};

/** Few enough to keep in the Keychain; the oldest go first. */
const MAX_KEPT = 10;

const without = (list: readonly string[], item: string) => list.filter((entry) => entry !== item);
const withItem = (list: readonly string[], item: string) =>
  list.includes(item) ? [...list] : [...list, item].slice(-MAX_KEPT);

const isOffline = (error: unknown) => error instanceof ApiError && error.isConnectivity;
/** Refused for good (a malformed token): asking again will not help. */
const isFinal = (error: unknown) =>
  error instanceof ApiError &&
  error.status !== null &&
  error.status >= 400 &&
  error.status < 500 &&
  error.status !== 429;

export function createTeamNotifications(deps: TeamNotificationsDeps) {
  const { push, permissions, api, state } = deps;
  const available = push.supported && api !== null;
  /** What the server confirmed during this launch — no need to ask it again. */
  let confirmed: { owner: string; token: string } | null = null;
  /** The system said the token changed: ask for it again. */
  let tokenStale = false;
  let queue: Promise<unknown> = Promise.resolve();

  /** One step at a time, in the order asked. */
  function serial<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      await state.ready();
      return task();
    });
    queue = run.catch(() => undefined);
    return run;
  }

  const read = () => state.get();
  const write = (change: (current: PushState) => PushState) => state.set(change(read()));

  /** A registration that is not the signed-in account's goes: its token is to be forgotten. */
  async function release(owner: string | null) {
    const { registration } = read();
    if (!registration || registration.owner === owner) return;
    confirmed = null;
    await write((current) => ({
      ...current,
      registration: null,
      forget: withItem(current.forget, registration.token),
    }));
  }

  /** Forgets on the server what signed-out accounts left behind — what it can now. */
  async function flushForgets() {
    if (!api) return;
    for (const token of read().forget) {
      try {
        await api.forget(token);
      } catch (error) {
        if (!isFinal(error)) return; // offline, or the server is busy: later
        logger.warn('a push token was refused by the server', error);
      }
      await write((current) => ({ ...current, forget: without(current.forget, token) }));
    }
  }

  async function register(owner: string): Promise<TurnOnResult> {
    if (!api) return 'unavailable';
    const known = read().registration;
    if (
      !tokenStale &&
      confirmed?.owner === owner &&
      known?.owner === owner &&
      known.token === confirmed.token
    )
      return 'on';
    await push.ensureChannel();
    let token: string;
    try {
      token = await push.getToken();
    } catch (error) {
      logger.warn('no push token', error);
      return 'failed';
    }
    try {
      await api.register(token, deps.platform);
    } catch (error) {
      if (isOffline(error)) return 'offline';
      logger.warn('the push registration was refused', error);
      return 'failed';
    }
    confirmed = { owner, token };
    tokenStale = false;
    // The server gave the token to this account: forgetting it later would undo that.
    await write((current) => ({
      ...current,
      registration: { owner, token },
      forget: without(current.forget, token),
    }));
    return 'on';
  }

  async function unregister(owner: string) {
    const { registration } = read();
    if (!api || registration?.owner !== owner) return;
    try {
      await api.unregister();
    } catch (error) {
      // Offline or the server is busy: the switch is off, the server hears it later.
      // A 401 means the session is over — and its registration went with it.
      if (!(error instanceof ApiError && error.status === 401)) return;
    }
    confirmed = null;
    await write((current) => ({ ...current, registration: null }));
  }

  return {
    /** An Android build with the Milo API: the switch exists. */
    available,

    isOn(owner: string): boolean {
      return read().enabled.includes(owner);
    },

    /**
     * The switch, on — after the permission is granted (the screen asks for
     * it, in its own words): a token, then the server. On only once the
     * server has it.
     */
    turnOn(owner: string): Promise<TurnOnResult> {
      if (!available) return Promise.resolve('unavailable');
      return serial(async () => {
        await release(owner);
        await flushForgets();
        const result = await register(owner);
        if (result === 'on')
          await write((current) => ({ ...current, enabled: withItem(current.enabled, owner) }));
        return result;
      });
    },

    /** The switch, off: at once here; the server stops sending as soon as it hears. */
    turnOff(owner: string): Promise<void> {
      return serial(async () => {
        await write((current) => ({ ...current, enabled: without(current.enabled, owner) }));
        await unregister(owner);
      });
    },

    /**
     * Keeps the server's registration true to the switch and to who is signed
     * in (`null`: nobody) — at launch, on return, when the token changes and
     * when the connection is back. A permission taken away in the system
     * settings turns the switch off, as it does the reminder's.
     */
    sync(owner: string | null): Promise<void> {
      if (!available) return Promise.resolve();
      return serial(async () => {
        await release(owner);
        await flushForgets();
        if (owner === null) return;
        let wanted = read().enabled.includes(owner);
        if (wanted) {
          const permission = await permissions.getPermission();
          if (permission.status === 'denied' || permission.status === 'undetermined') {
            await write((current) => ({ ...current, enabled: without(current.enabled, owner) }));
            wanted = false;
          }
        }
        if (wanted) await register(owner);
        else await unregister(owner);
      });
    },

    /** The system handed out a new device token: the next sync asks for the Expo token again. */
    tokenChanged(): void {
      tokenStale = true;
    },
  };
}

export type TeamNotifications = ReturnType<typeof createTeamNotifications>;
