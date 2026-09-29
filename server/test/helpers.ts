import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { NestExpressApplication } from '@nestjs/platform-express';
import type { DestinationStream } from 'pino';
import request from 'supertest';

import { AuthSessionSchema, type AuthSession } from '@/schemas';

import { loadConfig, type AppConfig } from '../src/config/env';
import { createApp } from '../src/create-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { TEST_DATABASE_URL, assertTestDatabase } from './test-env';

export type TestApp = {
  app: NestExpressApplication;
  http: Server;
  prisma: PrismaService;
  config: AppConfig;
  /** Only when started with `listen: true`: `http://127.0.0.1:<port>/api/v1`. */
  baseUrl: string;
  close(): Promise<void>;
};

export type StartOptions = {
  /** Variables on top of the test environment. */
  env?: Record<string, string>;
  /** A course document to publish instead of the bundled one. */
  course?: unknown;
  /** Listen on a real port, for clients that use fetch. */
  listen?: boolean;
  /** Collects the log lines. */
  logDestination?: DestinationStream;
};

export async function startApp(options: StartOptions = {}): Promise<TestApp> {
  const config = loadConfig({ ...process.env, ...options.env });
  const app = await createApp(config, {
    course: options.course,
    logDestination: options.logDestination,
  });
  let baseUrl = '';
  if (options.listen) {
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}/api/v1`;
  } else {
    await app.init();
  }
  return {
    app,
    http: app.getHttpServer(),
    prisma: app.get(PrismaService),
    config,
    baseUrl,
    close: () => app.close(),
  };
}

/** Deletes every row. Refuses to touch anything but the test database. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  assertTestDatabase(TEST_DATABASE_URL);
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "refresh_tokens", "refresh_sessions", "users" RESTART IDENTITY CASCADE',
  );
}

export const PASSWORD = 'correct-horse-7';

export async function register(
  http: Server,
  email = 'ada@example.com',
  password = PASSWORD,
): Promise<AuthSession> {
  const response = await request(http)
    .post('/api/v1/auth/register')
    .send({ email, password })
    .expect(201);
  return AuthSessionSchema.parse(response.body);
}

export const bearer = (session: Pick<AuthSession, 'accessToken'>) =>
  `Bearer ${session.accessToken}`;

/** The algorithm and cost parameters of a PHC-format argon2 hash, in any order. */
export function argon2Parameters(hash: string): Record<string, number> | null {
  const match =
    /^\$argon2id\$v=19\$([a-z]=\d+(?:,[a-z]=\d+)*)\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/.exec(hash);
  if (!match?.[1]) return null;
  return Object.fromEntries(
    match[1].split(',').map((pair) => {
      const [key = '', value = ''] = pair.split('=');
      return [key, Number(value)];
    }),
  );
}
