import { API_ERROR_CODES, ApiErrorBodySchema, type ApiErrorCode } from '@/schemas';

/**
 * Why a request failed, for code to switch on: the API's own codes, plus the
 * ones only the client can see — no answer, too slow, or an answer this app
 * cannot read.
 */
export type ApiFailure = ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'BAD_RESPONSE';

export class ApiError extends Error {
  constructor(
    readonly code: ApiFailure,
    message: string,
    /** The HTTP status, when there was a response. */
    readonly status: number | null = null,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** No usable answer from the server: offline, unreachable or too slow. */
  get isConnectivity(): boolean {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

const BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  404: 'NOT_FOUND',
  409: 'EMAIL_TAKEN',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
  503: 'COURSE_UNAVAILABLE',
};

/** Every code of the shared contract: one list, never a second copy to fall behind. */
const KNOWN = new Set<string>(API_ERROR_CODES);

/**
 * An error response as an `ApiError`: the API's `{ code, message, details? }`
 * when it sent one, else a code that follows from the status — never a raw
 * body or a stack trace.
 */
export function errorFromResponse(status: number, body: string): ApiError {
  let json: unknown = null;
  try {
    json = JSON.parse(body);
  } catch {
    // Not JSON: a proxy's page, an empty body.
  }
  const parsed = ApiErrorBodySchema.safeParse(json);
  if (parsed.success && KNOWN.has(parsed.data.code)) {
    return new ApiError(
      parsed.data.code as ApiErrorCode,
      parsed.data.message,
      status,
      parsed.data.details,
    );
  }
  const code = BY_STATUS[status] ?? 'INTERNAL_ERROR';
  return new ApiError(code, `The server answered ${status}.`, status);
}
