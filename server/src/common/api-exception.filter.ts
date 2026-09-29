import { Catch, Logger, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';

import { toErrorResponse } from './error-response';

/** Every error leaves the API in the same shape; unexpected ones are logged with their stack. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Errors');

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request & { id?: unknown }>();
    const { status, body } = toErrorResponse(error);
    if (status >= 500) {
      this.logger.error(
        { err: error, reqId: request.id, method: request.method, url: request.originalUrl },
        'Unhandled error',
      );
    }
    response.status(status).json(body);
  }
}
