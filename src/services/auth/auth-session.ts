import type { AuthSession, UserDto } from '@/schemas';

import { ApiError } from '../api/api-error';
import type { AccessTokens } from '../api/api-client';
import type { SessionStore, StoredSession } from './stored-session';

/** Refreshed ahead of time, so a request never leaves with a token about to lapse. */
const EXPIRY_LEEWAY_MS = 30_000;

type Listener = () => void;

export type AuthSessionOptions = {
  store: SessionStore;
  /** `POST /auth/refresh`: the next token pair for a refresh token. */
  refresh: (refreshToken: string) => Promise<AuthSession>;
  now?: () => number;
};

const toStored = (session: AuthSession): StoredSession => ({
  accessToken: session.accessToken,
  accessTokenExpiresAt: session.accessTokenExpiresAt,
  refreshToken: session.refreshToken,
  refreshTokenExpiresAt: session.refreshTokenExpiresAt,
  user: session.user,
});

/** The server has ended the session: the refresh token is expired, revoked or replayed. */
const isSessionOver = (error: unknown) =>
  error instanceof ApiError &&
  (error.code === 'REFRESH_TOKEN_INVALID' ||
    error.code === 'REFRESH_TOKEN_REUSED' ||
    error.status === 401);

/**
 * The signed-in session: in memory while the app runs, in the Keychain between
 * launches.
 *
 * Refreshing is single-flight: however many requests find their token
 * refused at once, one refresh runs and every one of them waits for it. When
 * the server ends the session, it is cleared once and `onEnded` listeners
 * hear about it once. When the server cannot be reached, nothing is cleared:
 * being offline is not being signed out.
 */
export class AuthSessionManager implements AccessTokens {
  private session: StoredSession | null = null;
  private refreshing: Promise<StoredSession | null> | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly now: () => number;

  constructor(private readonly options: AuthSessionOptions) {
    this.now = options.now ?? Date.now;
  }

  get user(): UserDto | null {
    return this.session?.user ?? null;
  }

  get refreshToken(): string | null {
    return this.session?.refreshToken ?? null;
  }

  /** Reads the session saved on the device, once at launch. */
  async restore(): Promise<StoredSession | null> {
    this.session = await this.options.store.load();
    return this.session;
  }

  /** A new session: after signing up or in. */
  async start(session: AuthSession): Promise<void> {
    this.session = toStored(session);
    await this.options.store.save(this.session);
  }

  async updateUser(user: UserDto): Promise<void> {
    if (!this.session) return;
    this.session = { ...this.session, user };
    await this.options.store.save(this.session);
  }

  /** Signing out: forgets the session here. Revoking it on the server is the caller's. */
  async end(): Promise<void> {
    this.session = null;
    await this.options.store.clear();
  }

  onEnded(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async current(): Promise<string | null> {
    const session = this.session;
    if (!session) return null;
    if (this.now() < Date.parse(session.accessTokenExpiresAt) - EXPIRY_LEEWAY_MS)
      return session.accessToken;
    try {
      return (await this.refreshOnce())?.accessToken ?? null;
    } catch {
      // Offline: the request goes with the old token and fails on its own.
      return this.session?.accessToken ?? null;
    }
  }

  async renew(used: string): Promise<string | null> {
    const session = this.session;
    if (!session) return null;
    // Refreshed while this request was out: the new token is already here.
    if (session.accessToken !== used) return session.accessToken;
    return (await this.refreshOnce())?.accessToken ?? null;
  }

  private refreshOnce(): Promise<StoredSession | null> {
    this.refreshing ??= this.runRefresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async runRefresh(): Promise<StoredSession | null> {
    const session = this.session;
    if (!session) return null;
    let next: AuthSession;
    try {
      next = await this.options.refresh(session.refreshToken);
    } catch (error) {
      if (!isSessionOver(error)) throw error;
      await this.expire(session);
      return null;
    }
    // Signed out while the refresh was out: its result belongs to no one.
    if (this.session !== session) return this.session;
    this.session = toStored(next);
    await this.options.store.save(this.session);
    return this.session;
  }

  /** The server ended `session`: cleared once, announced once. */
  private async expire(session: StoredSession): Promise<void> {
    if (this.session !== session) return;
    this.session = null;
    await this.options.store.clear();
    for (const listener of [...this.listeners]) listener();
  }
}
