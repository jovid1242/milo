/**
 * The environment every API test runs with. The database is `milo_test` in
 * the same Docker PostgreSQL as development (created by
 * docker/init-test-db.sql); set TEST_DATABASE_URL to use another one.
 */
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://milo:milo@localhost:5432/milo_test?schema=public';

export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: TEST_DATABASE_URL,
  JWT_ACCESS_SECRET: 'test-access-secret-not-for-real-use-0123456789',
  JWT_ACCESS_TTL: '15m',
  REFRESH_TOKEN_SECRET: 'test-refresh-secret-not-for-real-use-0123456789',
  REFRESH_TOKEN_TTL: '30d',
  REFRESH_TOKEN_REUSE_GRACE: '30s',
  // Tests sign in far more often than a person; the limit has its own test.
  AUTH_RATE_LIMIT: '1000',
  INVITE_RATE_LIMIT: '1000',
  CORS_ORIGINS: '',
  SWAGGER_ENABLED: 'false',
  TRUST_PROXY: 'false',
  LOG_LEVEL: 'silent',
};

/** Refuses anything but a `…_test` database: tests delete every row they find. */
export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.endsWith('_test'))
    throw new Error(`Refusing to run tests against "${name}": use a database named *_test.`);
}
