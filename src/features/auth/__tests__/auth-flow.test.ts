import { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { ApiAuthRepository } from '@/data/repositories/api/api-auth-repository';
import { LocalAuthRepository } from '@/data/repositories/local/local-auth-repository';
import { createMemoryRepositories } from '@/data/repositories/memory/memory-repositories';
import type { AuthRepository } from '@/data/repositories/types';
import {
  AuthSessionSchema,
  type QuestCompletion,
  type UpdateProfileRequest,
  type UserDto,
} from '@/schemas';
import {
  BASE_URL,
  NOW,
  USER,
  apiError,
  fakeFetch,
  sessionN,
  type FakeHandler,
} from '@/services/api/__fixtures__/fake-api';
import { ApiClient } from '@/services/api/api-client';
import { AuthSessionManager } from '@/services/auth/auth-session';
import { MemorySessionStore, type StoredSession } from '@/services/auth/stored-session';

import {
  completeAccountProfile,
  onboardingPrefill,
  pushProfile,
  restoreAuth,
  signOut,
} from '../use-cases';

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

/** An API-backed auth repository over a fake server, like the app builds it. */
function apiAuth(handler: FakeHandler, saved: StoredSession | null = null) {
  const server = fakeFetch(handler);
  const store = new MemorySessionStore(saved);
  const session: AuthSessionManager = new AuthSessionManager({
    store,
    now: () => NOW,
    refresh: (refreshToken) =>
      client.request({
        method: 'POST',
        path: '/auth/refresh',
        body: { refreshToken },
        schema: AuthSessionSchema,
      }),
  });
  const client: ApiClient = new ApiClient({
    baseUrl: BASE_URL,
    tokens: session,
    fetch: server.fetch,
  });
  return { auth: new ApiAuthRepository(client, session), store, seen: server.seen };
}

/** A small account server: the account, and PATCH applies to it. */
function accountServer(initial: UserDto = USER): { handler: FakeHandler; account: () => UserDto } {
  let account = initial;
  return {
    account: () => account,
    handler: (request) => {
      if (request.path === '/auth/register' || request.path === '/auth/login')
        return { status: request.path === '/auth/register' ? 201 : 200, body: sessionN(1) };
      if (request.path === '/auth/logout') return { status: 204 };
      if (request.headers['Authorization'] !== 'Bearer access-1')
        return apiError(401, 'UNAUTHORIZED');
      if (request.path === '/auth/me') return { status: 200, body: account };
      if (request.path === '/users/me' && request.method === 'PATCH') {
        account = { ...account, ...(request.body as UpdateProfileRequest) } as UserDto;
        return { status: 200, body: account };
      }
      return apiError(404, 'NOT_FOUND');
    },
  };
}

describe('signing up and in', () => {
  it('register opens a session and keeps it for the next launch', async () => {
    const t = apiAuth(accountServer().handler);
    await expect(
      t.auth.register({ email: 'ada@example.com', password: 'correct-horse-7' }),
    ).resolves.toEqual(USER);
    expect(t.seen[0]).toMatchObject({
      method: 'POST',
      path: '/auth/register',
      body: { email: 'ada@example.com', password: 'correct-horse-7' },
    });
    expect(t.store.saved).toMatchObject({ accessToken: 'access-1', user: USER });
  });

  it('login does the same with existing credentials', async () => {
    const t = apiAuth(accountServer().handler);
    await expect(
      t.auth.login({ email: 'ada@example.com', password: 'correct-horse-7' }),
    ).resolves.toEqual(USER);
    expect(t.store.saved?.refreshToken).toBe(sessionN(1).refreshToken);
  });

  it('a wrong password leaves no session behind', async () => {
    const t = apiAuth(() =>
      apiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
    );
    await expect(
      t.auth.login({ email: 'ada@example.com', password: 'nope-1234' }),
    ).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(t.store.saved).toBeNull();
  });
});

describe('cold launch', () => {
  it('authenticated: the saved session restores without the network', async () => {
    const t = apiAuth(() => {
      throw new TypeError('offline');
    }, sessionN(1));
    await expect(restoreAuth(t.auth)).resolves.toEqual({ status: 'authenticated', account: USER });
    expect(t.seen).toHaveLength(0);
  });

  it('unauthenticated: nothing saved, sign in', async () => {
    const t = apiAuth(accountServer().handler);
    await expect(restoreAuth(t.auth)).resolves.toEqual({ status: 'unauthenticated' });
  });

  it('a Keychain that cannot be read means signing in again, deleting nothing', async () => {
    const t = apiAuth(accountServer().handler, sessionN(1));
    jest.spyOn(t.store, 'load').mockRejectedValueOnce(new Error('Keychain locked'));
    const clear = jest.spyOn(t.store, 'clear');
    await expect(restoreAuth(t.auth)).resolves.toEqual({ status: 'unauthenticated' });
    expect(clear).not.toHaveBeenCalled();
  });

  it('local mode: the device is its own user, with no account and no sign-in', async () => {
    await expect(restoreAuth(new LocalAuthRepository())).resolves.toEqual({
      status: 'authenticated',
      account: null,
    });
  });
});

describe('logging out', () => {
  it('revokes the session on the server and forgets it here', async () => {
    const t = apiAuth(accountServer().handler, sessionN(1));
    await t.auth.restoreSession();
    await t.auth.logout();
    expect(t.seen.at(-1)).toMatchObject({
      method: 'POST',
      path: '/auth/logout',
      body: { refreshToken: sessionN(1).refreshToken },
    });
    expect(t.store.saved).toBeNull();
    await expect(restoreAuth(t.auth)).resolves.toEqual({ status: 'unauthenticated' });
  });

  it('signs out offline, too', async () => {
    const t = apiAuth(() => {
      throw new TypeError('offline');
    }, sessionN(1));
    await t.auth.restoreSession();
    await expect(t.auth.logout()).resolves.toBeUndefined();
    expect(t.store.saved).toBeNull();
  });

  it('clears the account’s cached data and keeps every bit of local progress', async () => {
    const repositories = createMemoryRepositories('2026-09-01');
    const t = apiAuth(accountServer().handler, sessionN(1));
    await t.auth.restoreSession();
    const completion: QuestCompletion = {
      questId: 'd001-vocabulary',
      courseVersion: 1,
      day: 1,
      questType: 'vocabulary',
      score: 1,
      correctCount: 6,
      totalCount: 6,
      xpEarned: 20,
      source: 'user',
      completedAt: '2026-09-01T09:00:00.000Z',
    };
    await repositories.progress.recordFirstCompletion(completion, [], null);
    // No garbage-collection timers left running after the test.
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    queryClient.setQueryData(queryKeys.account.me, USER);
    queryClient.setQueryData(queryKeys.user, repositories.store.user);
    queryClient.setQueryData(queryKeys.progress.state, { currentDay: 1 });

    await signOut(t.auth, queryClient);

    expect(queryClient.getQueryData(queryKeys.account.me)).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.user)).toEqual(repositories.store.user);
    expect(queryClient.getQueryData(queryKeys.progress.state)).toEqual({ currentDay: 1 });
    await expect(repositories.progress.getCompletions()).resolves.toHaveLength(1);
  });
});

describe('the account and onboarding', () => {
  const onboardedUser = {
    ...createMemoryRepositories('2026-09-01').store.user,
    displayName: 'Ada',
    goal: 'habit' as const,
  };

  it('onboarding never asks again what the account knows', () => {
    const known = { ...USER, displayName: 'Ada', goal: 'vocabulary' as const };
    expect(onboardingPrefill({ name: '', goal: null }, known)).toEqual({
      name: 'Ada',
      goal: 'vocabulary',
    });
    // What the user already typed on this device wins.
    expect(onboardingPrefill({ name: 'Adelaide', goal: 'habit' }, known)).toEqual({});
    expect(onboardingPrefill({ name: '', goal: null }, USER)).toEqual({});
  });

  it('sends the name and goal onboarding set to the account', async () => {
    const server = accountServer();
    const t = apiAuth(server.handler, sessionN(1));
    await t.auth.restoreSession();
    await pushProfile(t.auth, onboardedUser);
    expect(server.account()).toMatchObject({ displayName: 'Ada', goal: 'habit' });
    expect(t.store.saved?.user).toMatchObject({ displayName: 'Ada', goal: 'habit' });
  });

  it('fills in an account made after the challenge started, never overwriting it', async () => {
    const empty = accountServer();
    const t = apiAuth(empty.handler, sessionN(1));
    await t.auth.restoreSession();
    await completeAccountProfile(t.auth, onboardedUser);
    expect(empty.account()).toMatchObject({ displayName: 'Ada', goal: 'habit' });

    const named = accountServer({ ...USER, displayName: 'Ann', goal: 'confidence' });
    const other = apiAuth(named.handler, sessionN(1));
    await other.auth.restoreSession();
    await completeAccountProfile(other.auth, onboardedUser);
    expect(named.account()).toMatchObject({ displayName: 'Ann', goal: 'confidence' });
    expect(other.seen.filter((request) => request.method === 'PATCH')).toHaveLength(0);
  });

  it('sends nothing before onboarding, and nothing in local mode', async () => {
    const server = accountServer();
    const t = apiAuth(server.handler, sessionN(1));
    await t.auth.restoreSession();
    const fresh = { ...onboardedUser, onboardedAt: null };
    await expect(pushProfile(t.auth, fresh)).resolves.toBeNull();
    await expect(completeAccountProfile(t.auth, fresh)).resolves.toBeNull();
    expect(t.seen).toHaveLength(0);
    const local: AuthRepository = new LocalAuthRepository();
    await expect(pushProfile(local, onboardedUser)).resolves.toBeNull();
  });
});
