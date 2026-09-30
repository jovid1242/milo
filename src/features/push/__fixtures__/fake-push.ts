import type { PushApi } from '@/data/repositories/api/push-api';
import { ApiError } from '@/services/api/api-error';
import type { PushAdapter, PushData, PushTap } from '@/services/notifications/push-adapter';

import type { PushState, PushStateStore } from '../team-notifications';

/**
 * The phone's push system, in memory: a token that can change, listeners the
 * test fires, the tap that launched the app. Nothing is ever sent anywhere.
 */
export class FakePushAdapter implements PushAdapter {
  supported = true;
  token = 'ExponentPushToken[phone-token-000000001]';
  tokenFails = false;
  channels = 0;
  tokenRequests = 0;
  launch: PushTap | null = null;
  private readonly taps = new Set<(tap: PushTap) => void>();
  private readonly arrivals = new Set<(data: PushData) => void>();
  private readonly tokenChanges = new Set<() => void>();

  async ensureChannel() {
    this.channels += 1;
  }
  async getToken() {
    this.tokenRequests += 1;
    if (this.tokenFails) throw new Error('no token');
    return this.token;
  }
  onTokenChange(listener: () => void) {
    this.tokenChanges.add(listener);
    return { remove: () => this.tokenChanges.delete(listener) };
  }
  onReceive(listener: (data: PushData) => void) {
    this.arrivals.add(listener);
    return { remove: () => this.arrivals.delete(listener) };
  }
  onTap(listener: (tap: PushTap) => void) {
    this.taps.add(listener);
    return { remove: () => this.taps.delete(listener) };
  }
  launchTap() {
    return this.launch;
  }
  clearLaunchTap() {
    this.launch = null;
  }

  /** The system hands the app a new token. */
  rotate(token: string) {
    this.token = token;
    for (const listener of this.tokenChanges) listener();
  }
  tap(tap: PushTap) {
    for (const listener of this.taps) listener(tap);
  }
  receive(data: PushData) {
    for (const listener of this.arrivals) listener(data);
  }
}

const offline = () => new ApiError('NETWORK_ERROR', 'offline');

/**
 * The server's registrations, as the Milo API keeps them: a token belongs to
 * one account, registering it elsewhere moves it; logging out ends it.
 */
export class FakePushServer {
  /** token → the account it notifies. */
  readonly devices = new Map<string, string>();
  readonly calls = { register: 0, unregister: 0, forget: 0 };
  online = true;
  /** Forgetting fails (a busy server) while registering works. */
  forgetFails = false;
  refuseRegister = false;

  api(signedIn: () => string | null): PushApi {
    const reach = () => {
      if (!this.online) throw offline();
    };
    const owner = () => {
      const account = signedIn();
      if (!account) throw new ApiError('UNAUTHORIZED', 'signed out', 401);
      return account;
    };
    return {
      register: async (token) => {
        reach();
        this.calls.register += 1;
        if (this.refuseRegister) throw new ApiError('VALIDATION_ERROR', 'refused', 400);
        const account = owner();
        // One registration per session: this phone's previous token for the account goes.
        for (const [known, holder] of this.devices)
          if (holder === account) this.devices.delete(known);
        this.devices.set(token, account);
      },
      unregister: async () => {
        reach();
        this.calls.unregister += 1;
        const account = owner();
        for (const [known, holder] of this.devices)
          if (holder === account) this.devices.delete(known);
      },
      forget: async (token) => {
        reach();
        this.calls.forget += 1;
        if (this.forgetFails) throw new ApiError('INTERNAL_ERROR', 'busy', 500);
        this.devices.delete(token);
      },
    };
  }

  /** The account the server would notify on this phone, if any. */
  notifies(token: string): string | null {
    return this.devices.get(token) ?? null;
  }
}

/** What the Keychain would keep — survives a "restart" of the service. */
export function memoryPushState(): PushStateStore & { current: PushState } {
  const store = {
    current: { enabled: [], registration: null, forget: [] } as PushState,
    ready: async () => undefined,
    get: () => store.current,
    set: async (next: PushState) => {
      store.current = next;
    },
  };
  return store;
}
