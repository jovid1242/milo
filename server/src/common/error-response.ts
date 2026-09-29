import { HttpException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';

import type { ApiErrorBody, ApiErrorCode } from '@/schemas';

import { ApiException } from './api-exception';

type ErrorResponse = { status: number; body: ApiErrorBody };

const DEFAULTS: Record<number, [ApiErrorCode, string]> = {
  400: ['VALIDATION_ERROR', 'The request could not be read.'],
  401: ['UNAUTHORIZED', 'Sign in to continue.'],
  404: ['NOT_FOUND', 'Not found.'],
  413: ['PAYLOAD_TOO_LARGE', 'The request is too large.'],
  429: ['RATE_LIMITED', 'Too many requests. Try again in a minute.'],
};

const INTERNAL: ErrorResponse = {
  status: 500,
  body: { code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' },
};

/** Errors thrown before routing (the JSON body parser) carry a plain HTTP status. */
function parserStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const status = (error as { status?: unknown; statusCode?: unknown }).status;
  const type = (error as { type?: unknown }).type;
  return typeof status === 'number' && typeof type === 'string' && type.startsWith('entity.')
    ? status
    : null;
}

/**
 * Any error, as the one response format the API has: `{ code, message,
 * details? }`. Never a stack trace, in any environment — the log has those.
 */
export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof ApiException) {
    return { status: error.getStatus(), body: error.getResponse() as ApiErrorBody };
  }
  if (error instanceof ThrottlerException) {
    const [code, message] = DEFAULTS[429] ?? ['RATE_LIMITED', 'Too many requests.'];
    return { status: 429, body: { code, message } };
  }
  const status = error instanceof HttpException ? error.getStatus() : parserStatus(error);
  if (status === null || status >= 500) return INTERNAL;
  const [code, message] = DEFAULTS[status] ?? ['VALIDATION_ERROR', 'The request is not valid.'];
  return { status, body: { code, message } };
}
