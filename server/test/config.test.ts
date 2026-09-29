import { describe, expect, it } from 'vitest';

import { parseDuration } from '../src/config/duration';
import { ConfigError, loadConfig } from '../src/config/env';

const VALID = {
  DATABASE_URL: 'postgresql://milo:milo@localhost:5432/milo',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  REFRESH_TOKEN_SECRET: 'b'.repeat(32),
};

const problemsOf = (source: Record<string, string | undefined>) => {
  try {
    loadConfig(source);
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
  return [];
};

describe('loadConfig', () => {
  it('fills in safe defaults', () => {
    expect(loadConfig(VALID)).toMatchObject({
      env: 'development',
      port: 3000,
      accessToken: { ttlMs: 15 * 60_000 },
      refreshToken: { ttlMs: 30 * 24 * 60 * 60_000, reuseGraceMs: 30_000 },
      authRateLimitPerMinute: 20,
      corsOrigins: [],
      swaggerEnabled: true,
      trustProxy: false,
    });
  });

  it('turns Swagger off in production unless asked for', () => {
    expect(loadConfig({ ...VALID, NODE_ENV: 'production' }).swaggerEnabled).toBe(false);
    expect(
      loadConfig({ ...VALID, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }).swaggerEnabled,
    ).toBe(true);
  });

  it('names every missing variable at once', () => {
    expect(problemsOf({})).toEqual([
      'DATABASE_URL is required',
      'JWT_ACCESS_SECRET is required',
      'REFRESH_TOKEN_SECRET is required',
    ]);
    expect(new ConfigError(['DATABASE_URL is required']).message).toMatch(/server\/\.env\.example/);
  });

  it('refuses weak or unsafe values', () => {
    expect(problemsOf({ ...VALID, JWT_ACCESS_SECRET: 'short' })).toEqual([
      'JWT_ACCESS_SECRET must be at least 32 characters',
    ]);
    expect(problemsOf({ ...VALID, REFRESH_TOKEN_SECRET: VALID.JWT_ACCESS_SECRET })).toEqual([
      'REFRESH_TOKEN_SECRET must differ from JWT_ACCESS_SECRET',
    ]);
    expect(
      problemsOf({
        ...VALID,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'change-me-to-a-long-random-string-of-at-least-32-chars',
      }),
    ).toEqual(['JWT_ACCESS_SECRET is still the example value']);
    expect(problemsOf({ ...VALID, DATABASE_URL: 'mysql://localhost/milo' })).toEqual([
      'DATABASE_URL must be a postgresql:// URL',
    ]);
    expect(problemsOf({ ...VALID, JWT_ACCESS_TTL: 'soon' })).toEqual([
      'JWT_ACCESS_TTL "soon" is not a duration like 15m, 30d or 10s',
    ]);
  });

  it('reads lists and durations', () => {
    const config = loadConfig({
      ...VALID,
      JWT_ACCESS_TTL: '5m',
      CORS_ORIGINS: 'https://milo.app, https://staging.milo.app',
    });
    expect(config.accessToken.ttlMs).toBe(300_000);
    expect(config.corsOrigins).toEqual(['https://milo.app', 'https://staging.milo.app']);
  });
});

describe('parseDuration', () => {
  it.each([
    ['250ms', 250],
    ['10s', 10_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['30d', 2_592_000_000],
  ])('%s', (value, ms) => {
    expect(parseDuration(value)).toBe(ms);
  });

  it.each(['', '15', 'm', '1.5h', '-1m', '10 years'])('refuses "%s"', (value) => {
    expect(parseDuration(value)).toBeNull();
  });
});
