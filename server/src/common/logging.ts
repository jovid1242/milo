import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Params } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import type { Options } from 'pino-http';

import type { AppConfig } from '../config/env';

type RoutedRequest = IncomingMessage & {
  id?: unknown;
  originalUrl?: string;
  baseUrl?: string;
  route?: { path?: unknown };
};

const REQUEST_ID = /^[\w.-]{1,64}$/;

/** A caller's request id when it is sane, else a fresh one; echoed back as `X-Request-Id`. */
function requestId(request: IncomingMessage, response: ServerResponse): string {
  const incoming = request.headers['x-request-id'];
  const id = typeof incoming === 'string' && REQUEST_ID.test(incoming) ? incoming : randomUUID();
  response.setHeader('X-Request-Id', id);
  return id;
}

/**
 * The route pattern (`/api/v1/courses/:courseId/versions/:version`), not the
 * raw path. A wildcard is the logger's own middleware mount: the request
 * matched no route.
 */
function routeOf(request: RoutedRequest): string | undefined {
  const path = request.route?.path;
  if (typeof path !== 'string' || path.includes('*')) return undefined;
  return `${request.baseUrl ?? ''}${path}`;
}

/** Adds the route once the response is done — only then is it known. */
const withRoute = (request: unknown, value: object) => ({
  ...value,
  route: routeOf(request as RoutedRequest),
});

/**
 * One JSON line per request: id, method, route, status and duration. Only
 * those — never headers or bodies, so no password or token reaches a log;
 * the redaction below is a second line of defence for error objects.
 */
export function loggerParams(config: AppConfig, destination?: DestinationStream): Params {
  const options: Options = {
    level: config.logLevel,
    genReqId: requestId,
    customSuccessObject: (request, _response, value: object) => withRoute(request, value),
    customErrorObject: (request, _response, _error, value: object) => withRoute(request, value),
    serializers: {
      req: (request: RoutedRequest) => ({
        id: request.id,
        method: request.method,
        // The path without its query string.
        path: (request.originalUrl ?? request.url ?? '').split('?')[0],
      }),
      res: (response: ServerResponse) => ({ statusCode: response.statusCode }),
    },
    redact: {
      paths: [
        '*.password',
        '*.passwordHash',
        '*.accessToken',
        '*.refreshToken',
        '*.authorization',
        '*.headers.authorization',
        '*.headers.cookie',
      ],
      censor: '[redacted]',
    },
    customLogLevel: (_request, response, error) =>
      error || response.statusCode >= 500 ? 'error' : response.statusCode >= 400 ? 'warn' : 'info',
    autoLogging: {
      // Probes would drown everything else.
      ignore: (request) => request.url === '/health' || request.url === '/ready',
    },
  };
  // Standard output, unless something else collects the lines.
  return { pinoHttp: destination ? [options, destination] : options };
}
