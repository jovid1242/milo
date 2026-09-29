import type { z } from 'zod';

import { ApiError, errorFromResponse } from './api-error';

/**
 * The one way the app talks to the Milo API: base URL, JSON, the access
 * token, a timeout and errors as `ApiError`. Screens never call `fetch`; they
 * call repositories, which call this.
 */

/** Access tokens for authenticated requests (see `AuthSession`). */
export interface AccessTokens {
  /** A token to send, refreshed first when it is about to expire; `null` when signed out. */
  current(): Promise<string | null>;
  /**
   * After `used` was refused with a 401: a fresh token — one refresh however
   * many requests ask at once — or `null` when the session is over.
   */
  renew(used: string): Promise<string | null>;
}

export type ApiRequest<T> = {
  method?: 'GET' | 'POST' | 'PATCH';
  /** Relative to the API root: `/auth/login`. */
  path: string;
  body?: unknown;
  /** Validates a successful response's JSON; without it the body is ignored. */
  schema?: z.ZodType<T>;
  /** Sends the access token, and on a 401 refreshes it and retries once. */
  auth?: boolean;
  signal?: AbortSignal;
};

export type ApiResponse = { status: number; headers: Headers; text: string };

export type ApiClientOptions = {
  baseUrl: string;
  tokens?: AccessTokens;
  /** Per attempt, until the whole body has arrived. */
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** A JSON request: the parsed, validated response, or an `ApiError`. */
  async request<T = void>(request: ApiRequest<T>): Promise<T> {
    const response = await this.send(request);
    if (response.status < 200 || response.status >= 300)
      throw errorFromResponse(response.status, response.text);
    if (!request.schema) return undefined as T;
    let json: unknown;
    try {
      json = JSON.parse(response.text);
    } catch {
      throw new ApiError(
        'BAD_RESPONSE',
        'The server sent something that is not JSON.',
        response.status,
      );
    }
    const parsed = request.schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(
        'BAD_RESPONSE',
        'The server sent something this app does not understand.',
        response.status,
        parsed.error.issues,
      );
    }
    return parsed.data;
  }

  /** The response as it came — status, headers, text — for callers that need more than JSON. */
  async send(request: ApiRequest<unknown>): Promise<ApiResponse> {
    if (!request.auth) return this.attempt(request, null);
    const tokens = this.options.tokens;
    const token = tokens ? await tokens.current() : null;
    if (!tokens || !token) throw new ApiError('UNAUTHORIZED', 'Sign in to continue.', 401);
    const first = await this.attempt(request, token);
    if (first.status !== 401) return first;
    const renewed = await tokens.renew(token);
    // Retried once: a second 401 is the answer.
    return renewed ? this.attempt(request, renewed) : first;
  }

  private async attempt(request: ApiRequest<unknown>, token: string | null): Promise<ApiResponse> {
    const controller = new AbortController();
    const cancel = () => controller.abort();
    request.signal?.addEventListener('abort', cancel);
    const timer = setTimeout(cancel, this.timeoutMs);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (request.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const response = await this.fetchImpl(`${this.options.baseUrl}${request.path}`, {
        method: request.method ?? 'GET',
        headers,
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: controller.signal,
      });
      const text = await response.text();
      return { status: response.status, headers: response.headers, text };
    } catch (error) {
      if (request.signal?.aborted) throw error;
      if (controller.signal.aborted)
        throw new ApiError('TIMEOUT', 'The server took too long to answer.');
      throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.');
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', cancel);
    }
  }
}
