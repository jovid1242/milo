import { randomUUID } from 'node:crypto';

import { NodeSqliteStore } from '@/data/db/__fixtures__/node-sqlite-store';
import { ApiAuthRepository } from '@/data/repositories/api/api-auth-repository';
import { HttpProgressApi } from '@/data/repositories/api/progress-api';
import { HttpTeamApi } from '@/data/repositories/api/team-api';
import { LocalAuthRepository } from '@/data/repositories/local/local-auth-repository';
import { LocalCourseRepository } from '@/data/repositories/local/local-course-repository';
import { LOCAL_OWNER, type DeviceServices } from '@/data/repositories/owner-repositories';
import { AuthSessionSchema, type AuthSession } from '@/schemas';
import { ApiClient } from '@/services/api/api-client';
import { AuthSessionManager } from '@/services/auth/auth-session';
import { MemorySessionStore } from '@/services/auth/stored-session';
import {
  openOwnerSession,
  prepareAccount,
  type OwnerSession,
} from '@/services/session/owner-session';

import { PASSWORD } from './helpers';

/**
 * The app on a phone — its SQLite schema and repositories, its sessions, its
 * sync engine and team client, over real HTTP — for tests that run the app's
 * own code against this server. Only the SQLite is Node's instead of iOS's.
 */

const noCache = { clear: () => undefined };

/** A phone: its own database, its own Keychain, the app's clients — against `baseUrl`. */
export class Phone {
  online = true;
  readonly store: NodeSqliteStore;
  readonly auth: ApiAuthRepository;
  readonly services: DeviceServices;
  private readonly session: AuthSessionManager;
  private readonly sessions: OwnerSession[] = [];

  constructor(
    private readonly baseUrl: string,
    path = ':memory:',
  ) {
    this.store = new NodeSqliteStore(path);
    const fetchOnline: typeof fetch = (input, init) => {
      if (!this.online)
        return Promise.reject(new TypeError('The Internet connection appears to be offline.'));
      return fetch(input, init);
    };
    this.session = new AuthSessionManager({
      store: new MemorySessionStore(),
      refresh: (refreshToken): Promise<AuthSession> =>
        client.request({
          method: 'POST',
          path: '/auth/refresh',
          body: { refreshToken },
          schema: AuthSessionSchema,
        }),
    });
    const client: ApiClient = new ApiClient({
      baseUrl: this.baseUrl,
      tokens: this.session,
      fetch: fetchOnline,
    });
    this.auth = new ApiAuthRepository(client, this.session);
    this.services = {
      auth: this.auth,
      course: new LocalCourseRepository(),
      courseUpdates: null,
      progressApi: new HttpProgressApi(client),
      teamApi: new HttpTeamApi(client),
      currentAccountId: () => this.session.user?.id ?? null,
      store: this.store,
      newId: () => randomUUID(),
    };
  }

  private async open(
    accountId: string,
    account: Awaited<ReturnType<ApiAuthRepository['login']>> | null,
  ) {
    const session = await openOwnerSession({
      device: this.services,
      owner: accountId,
      account,
      queryClient: noCache,
      platform: { isOnline: () => this.online, subscribe: () => () => undefined },
      onChanged: () => undefined,
    });
    // The tests say when to sync.
    session.repositories.sync?.connect(() => undefined);
    this.sessions.push(session);
    return session;
  }

  /** Signing in as the app does: log in, open the account, hear from the server first. */
  async signIn(email: string): Promise<OwnerSession> {
    const account = await this.auth.login({ email, password: PASSWORD });
    return prepareAccount(await this.open(account.id, account));
  }

  async signUp(email: string): Promise<OwnerSession> {
    const account = await this.auth.register({ email, password: PASSWORD });
    return prepareAccount(await this.open(account.id, account));
  }

  /** The app launching with a saved session: no network needed. */
  async restore(accountId: string): Promise<OwnerSession> {
    return this.open(accountId, null);
  }

  async signOut(session: OwnerSession): Promise<void> {
    session.engine?.stop();
    session.dispose();
    await this.auth.logout();
  }

  /** The device's own progress, without an account (local mode, before accounts). */
  async local(): Promise<OwnerSession> {
    const session = await openOwnerSession({
      device: {
        ...this.services,
        auth: new LocalAuthRepository(),
        progressApi: null,
        teamApi: null,
      },
      owner: LOCAL_OWNER,
      account: null,
      queryClient: noCache,
      platform: { isOnline: () => false, subscribe: () => () => undefined },
      onChanged: () => undefined,
    });
    this.sessions.push(session);
    return session;
  }

  async close(): Promise<void> {
    for (const session of this.sessions) session.dispose();
    await this.store.close();
  }
}
