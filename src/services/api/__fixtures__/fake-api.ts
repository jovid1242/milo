import type { AuthSession, UserDto } from '@/schemas';

/** A request as the fake server saw it. */
export type SeenRequest = {
  method: string;
  url: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
};

export type FakeReply = { status: number; body?: unknown; text?: string; delayMs?: number };
export type FakeHandler = (request: SeenRequest) => FakeReply | Promise<FakeReply>;

export const BASE_URL = 'https://api.milo.test/api/v1';

/**
 * A `fetch` for the API client that answers from `handler` and records every
 * request — no network, and no dependency on the test environment's fetch.
 */
export function fakeFetch(handler: FakeHandler) {
  const seen: SeenRequest[] = [];
  const fetchImpl = async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const request: SeenRequest = {
      method: init?.method ?? 'GET',
      url,
      path: url.replace(BASE_URL, ''),
      headers: { ...(init?.headers as Record<string, string>) },
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    seen.push(request);
    const reply = await handler(request);
    if (reply.delayMs) {
      // Like a real request: it stops the moment it is aborted.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, reply.delayMs);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('aborted'));
        });
      });
    }
    if (init?.signal?.aborted) throw new Error('aborted');
    const text = reply.text ?? (reply.body === undefined ? '' : JSON.stringify(reply.body));
    return { status: reply.status, headers: {}, text: async () => text } as unknown as Response;
  };
  return { fetch: fetchImpl as typeof fetch, seen };
}

export const USER: UserDto = {
  id: '6f1c2a4e-8b1d-4c3e-9a7f-2d5e8b0c1a93',
  email: 'ada@example.com',
  displayName: null,
  goal: null,
  createdAt: '2026-09-29T08:00:00.000Z',
};

export const NOW = Date.parse('2026-09-29T09:00:00.000Z');

/** The n-th token pair of a session: `access-n`, `refresh-n…`. */
export function sessionN(n: number, overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    user: USER,
    accessToken: `access-${n}`,
    accessTokenExpiresAt: new Date(NOW + 15 * 60_000).toISOString(),
    refreshToken: `refresh-${n}-`.padEnd(43, 'x'),
    refreshTokenExpiresAt: new Date(NOW + 30 * 86_400_000).toISOString(),
    ...overrides,
  };
}

export const apiError = (status: number, code: string, message = 'No.') => ({
  status,
  body: { code, message },
});
