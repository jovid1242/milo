import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule, type AppOptions } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import type { AppConfig } from './config/env';

export const API_PREFIX = 'api/v1';
/** JSON bodies larger than this are refused (413) before any handler runs. */
export const BODY_LIMIT = '100kb';
/**
 * Progress sync carries a batch of offline actions — and, once, a device's
 * whole history from before accounts: it gets more room, and only it.
 */
export const SYNC_BODY_LIMIT = '1mb';

/** The API, configured the same way for the server and for tests. */
export async function createApp(
  config: AppConfig,
  options: AppOptions = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config, options), {
    bufferLogs: true,
    bodyParser: false,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  if (config.trustProxy) app.set('trust proxy', 1);
  app.use(helmet());
  // Responses are personal unless a route says otherwise (the course does):
  // never kept by the phone's HTTP cache, or by anything in between.
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({
    // The mobile app needs no CORS; browsers get only the listed origins.
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'If-None-Match', 'X-Request-Id'],
    exposedHeaders: ['ETag', 'X-Request-Id', 'Retry-After'],
  });
  // Parsed here first, the sync body is left alone by the general parser below.
  app.use(`/${API_PREFIX}/progress/sync`, json({ limit: SYNC_BODY_LIMIT }));
  app.useBodyParser('json', { limit: BODY_LIMIT });
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health', 'ready'] });
  app.useGlobalFilters(new ApiExceptionFilter());

  if (config.swaggerEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Milo API')
        .setDescription(
          'Auth, the account, the course, progress sync and teams. Every error is `{ code, message, details? }`.',
        )
        .setVersion('1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document, {
      jsonDocumentUrl: 'api/docs/openapi.json',
    });
  }
  return app;
}
