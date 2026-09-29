import { HttpException } from '@nestjs/common';

import type { ApiErrorBody, ApiErrorCode } from '@/schemas';

/** An error the client is meant to see: a status, a stable `code` and a message for people. */
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(
      { code, message, ...(details === undefined ? {} : { details }) } satisfies ApiErrorBody,
      status,
    );
  }
}

export const unauthorized = () => new ApiException(401, 'UNAUTHORIZED', 'Sign in to continue.');
