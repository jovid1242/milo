import { logger } from '@/lib/logger';
import {
  AuthSessionSchema,
  UserDtoSchema,
  type LoginRequest,
  type RegisterRequest,
  type UpdateProfileRequest,
} from '@/schemas';
import type { ApiClient } from '@/services/api/api-client';
import type { AuthSessionManager } from '@/services/auth/auth-session';

import type { Account, AuthRepository } from '../types';

/** Accounts on the Milo API. Tokens stay inside: callers only ever see the account. */
export class ApiAuthRepository implements AuthRepository {
  readonly mode = 'remote';

  constructor(
    private readonly client: ApiClient,
    private readonly session: AuthSessionManager,
  ) {}

  async restoreSession(): Promise<Account | null> {
    return (await this.session.restore())?.user ?? null;
  }

  async register(input: RegisterRequest): Promise<Account> {
    const session = await this.client.request({
      method: 'POST',
      path: '/auth/register',
      body: input,
      schema: AuthSessionSchema,
    });
    await this.session.start(session);
    return session.user;
  }

  async login(input: LoginRequest): Promise<Account> {
    const session = await this.client.request({
      method: 'POST',
      path: '/auth/login',
      body: input,
      schema: AuthSessionSchema,
    });
    await this.session.start(session);
    return session.user;
  }

  async logout(): Promise<void> {
    const refreshToken = this.session.refreshToken;
    // Signed out here first: it must work offline, too.
    await this.session.end();
    if (!refreshToken) return;
    try {
      await this.client.request({ method: 'POST', path: '/auth/logout', body: { refreshToken } });
    } catch (error) {
      // The token is gone from the device; unrevoked, it simply expires.
      logger.warn('the server could not be told about the logout', error);
    }
  }

  async fetchAccount(): Promise<Account> {
    const account = await this.client.request({
      path: '/auth/me',
      schema: UserDtoSchema,
      auth: true,
    });
    await this.session.updateUser(account);
    return account;
  }

  async updateProfile(update: UpdateProfileRequest): Promise<Account> {
    const account = await this.client.request({
      method: 'PATCH',
      path: '/users/me',
      body: update,
      schema: UserDtoSchema,
      auth: true,
    });
    await this.session.updateUser(account);
    return account;
  }

  onSessionEnded(listener: () => void): () => void {
    return this.session.onEnded(listener);
  }
}
