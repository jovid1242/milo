import { API_ERROR_CODES, AuthSessionSchema, UserDtoSchema, type AuthSession } from '@/schemas';

import { AuthSessionManager } from '../../auth/auth-session';
import { MemorySessionStore } from '../../auth/stored-session';
import { ApiClient } from '../api-client';
import { ApiError, errorFromResponse } from '../api-error';
import {
  BASE_URL,
  NOW,
  USER,
  apiError,
  fakeFetch,
  sessionN,
  type FakeHandler,
} from '../__fixtures__/fake-api';

const me = { path: '/users/me', auth: true, schema: UserDtoSchema } as const;

/**
 * A client wired like the app's: the session refreshes through the same
 * client, and the fake server decides which access token is valid.
 */
function setup(options: { session?: AuthSession | null; handler: FakeHandler }) {
  const server = fakeFetch(options.handler);
  const store = new MemorySessionStore();
  const clear = jest.spyOn(store, 'clear');
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
    timeoutMs: 50,
  });
  const ended = jest.fn();
  session.onEnded(ended);
  return { client, session, store, clear, ended, seen: server.seen, ready: start() };

  async function start() {
    if (options.session) await session.start(options.session);
  }
}

/** Accepts only `access-<valid>`; refreshing hands out the next pair. */
function tokenServer(options: { refreshReply?: () => { status: number; body: unknown } } = {}) {
  let valid = 2;
  let refreshes = 0;
  const handler: FakeHandler = (request) => {
    if (request.path === '/auth/refresh') {
      refreshes += 1;
      const reply = options.refreshReply?.();
      if (reply) return { ...reply, delayMs: 10 };
      return { status: 200, body: sessionN(valid), delayMs: 10 };
    }
    return request.headers['Authorization'] === `Bearer access-${valid}`
      ? { status: 200, body: USER }
      : apiError(401, 'UNAUTHORIZED', 'Sign in to continue.');
  };
  return { handler, refreshes: () => refreshes, bump: () => (valid += 1) };
}

describe('ApiClient', () => {
  it('sends JSON to the API root and validates what comes back', async () => {
    const { client, seen } = setup({ handler: () => ({ status: 201, body: sessionN(1) }) });
    await client.request({
      method: 'POST',
      path: '/auth/login',
      body: { email: 'ada@example.com', password: 'x' },
    });
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: `${BASE_URL}/auth/login`,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: { email: 'ada@example.com', password: 'x' },
    });
    expect(seen[0]?.headers).not.toHaveProperty('Authorization');
  });

  it('turns every failure into one kind of error', async () => {
    const replies: Record<string, { status: number; body?: unknown; text?: string }> = {
      '/taken': apiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.'),
      '/gateway': { status: 502, text: '<html>Bad gateway</html>' },
      '/novel': apiError(400, 'SOMETHING_NEW'),
      '/garbled': { status: 200, text: '{"id": ' },
      '/wrong-shape': { status: 200, body: { id: 42 } },
    };
    const { client } = setup({ handler: (request) => replies[request.path] ?? { status: 404 } });
    const failure = (path: string) =>
      client.request({ path, schema: UserDtoSchema }).catch((error: unknown) => error as ApiError);

    expect(await failure('/taken')).toMatchObject({
      code: 'EMAIL_TAKEN',
      status: 409,
      message: 'An account with this email already exists.',
    });
    expect(await failure('/gateway')).toMatchObject({ code: 'INTERNAL_ERROR', status: 502 });
    expect(await failure('/novel')).toMatchObject({ code: 'VALIDATION_ERROR', status: 400 });
    expect(await failure('/garbled')).toMatchObject({ code: 'BAD_RESPONSE' });
    expect(await failure('/wrong-shape')).toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('tells a dead network from a slow server', async () => {
    const offline = setup({
      handler: () => {
        throw new TypeError('Network request failed');
      },
    });
    const slow = setup({ handler: () => ({ status: 200, body: USER, delayMs: 200 }) });
    const offlineError = await offline.client.request({ path: '/x' }).catch((error) => error);
    const slowError = await slow.client.request({ path: '/x' }).catch((error) => error);
    expect(offlineError).toBeInstanceOf(ApiError);
    expect(offlineError).toMatchObject({ code: 'NETWORK_ERROR', isConnectivity: true });
    expect(slowError).toMatchObject({ code: 'TIMEOUT', isConnectivity: true });
  });

  it('never sends an authenticated request without a session', async () => {
    const { client, seen } = setup({ handler: () => ({ status: 200, body: USER }) });
    await expect(client.request(me)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(seen).toHaveLength(0);
  });
});

describe('401 → refresh → retry', () => {
  it('refreshes a refused token and retries the request once', async () => {
    const server = tokenServer();
    const t = setup({ session: sessionN(1), handler: server.handler });
    await t.ready;
    await expect(t.client.request(me)).resolves.toEqual(USER);
    expect(
      t.seen.map((request) => `${request.path} ${request.headers['Authorization'] ?? ''}`),
    ).toEqual(['/users/me Bearer access-1', '/auth/refresh ', '/users/me Bearer access-2']);
    expect(t.store.saved?.accessToken).toBe('access-2');
  });

  it('runs one refresh for five requests refused at once, then retries them all', async () => {
    const server = tokenServer();
    const t = setup({ session: sessionN(1), handler: server.handler });
    await t.ready;
    const results = await Promise.all(Array.from({ length: 5 }, () => t.client.request(me)));
    expect(results).toEqual(Array.from({ length: 5 }, () => USER));
    expect(server.refreshes()).toBe(1);
    expect(t.seen.filter((request) => request.path === '/users/me')).toHaveLength(10);
  });

  it('when the refresh is refused, signs out once — however many requests asked', async () => {
    const server = tokenServer({
      refreshReply: () => apiError(401, 'REFRESH_TOKEN_REUSED', 'Your session has ended.'),
    });
    const t = setup({ session: sessionN(1), handler: server.handler });
    await t.ready;
    const errors = await Promise.all(
      Array.from({ length: 5 }, () => t.client.request(me).catch((error: unknown) => error)),
    );
    expect(errors.map((error) => (error as ApiError).code)).toEqual(
      Array.from({ length: 5 }, () => 'UNAUTHORIZED'),
    );
    expect(server.refreshes()).toBe(1);
    expect(t.clear).toHaveBeenCalledTimes(1);
    expect(t.ended).toHaveBeenCalledTimes(1);
    expect(t.store.saved).toBeNull();
    // Signed out: nothing more goes to the server with a token.
    await expect(t.client.request(me)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(server.refreshes()).toBe(1);
  });

  it('keeps the session when the refresh cannot reach the server', async () => {
    const server = tokenServer();
    let online = true;
    const t = setup({
      session: sessionN(1),
      handler: (request) => {
        if (!online && request.path === '/auth/refresh') throw new TypeError('offline');
        return server.handler(request);
      },
    });
    await t.ready;
    online = false;
    await expect(t.client.request(me)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(t.ended).not.toHaveBeenCalled();
    expect(t.store.saved?.refreshToken).toBe(sessionN(1).refreshToken);
    // Back online, the same session carries on.
    online = true;
    await expect(t.client.request(me)).resolves.toEqual(USER);
  });

  it('refreshes ahead of time a token about to expire', async () => {
    const server = tokenServer();
    const expiring = sessionN(1, { accessTokenExpiresAt: new Date(NOW + 10_000).toISOString() });
    const t = setup({ session: expiring, handler: server.handler });
    await t.ready;
    await t.client.request(me);
    expect(t.seen.map((request) => request.path)).toEqual(['/auth/refresh', '/users/me']);
    expect(t.seen[1]?.headers['Authorization']).toBe('Bearer access-2');
  });

  it('retries only once: a second 401 is the answer', async () => {
    const t = setup({
      session: sessionN(1),
      handler: (request) =>
        request.path === '/auth/refresh'
          ? { status: 200, body: sessionN(2) }
          : apiError(401, 'UNAUTHORIZED', 'Sign in to continue.'),
    });
    await t.ready;
    await expect(t.client.request(me)).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(t.seen.map((request) => request.path)).toEqual([
      '/users/me',
      '/auth/refresh',
      '/users/me',
    ]);
  });
});

describe('error responses', () => {
  it('keeps every code of the shared contract — the client never mistakes one for another', () => {
    for (const code of API_ERROR_CODES) {
      const error = errorFromResponse(409, JSON.stringify({ code, message: 'm' }));
      expect(error).toMatchObject({ code, status: 409, message: 'm' });
    }
  });

  it('falls back to what the status says for anything else', () => {
    expect(errorFromResponse(413, '<html>')).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(
      errorFromResponse(500, JSON.stringify({ code: 'SOMETHING_NEW', message: 'm' })),
    ).toMatchObject({
      code: 'INTERNAL_ERROR',
    });
  });
});
