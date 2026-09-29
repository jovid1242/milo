import { z } from 'zod';

import { parseDuration } from './duration';

/**
 * The API's configuration, read once from the environment and validated
 * before anything starts. A missing or unsafe value stops the process with a
 * message that names every problem — never a half-configured server.
 */

const Duration = z.string().transform((value, ctx) => {
  const ms = parseDuration(value);
  if (ms === null) {
    ctx.addIssue({ code: 'custom', message: `"${value}" is not a duration like 15m, 30d or 10s` });
    return z.NEVER;
  }
  return ms;
});

const Secret = z.string().min(32, 'must be at least 32 characters');

/** "true" / "false"; empty or unset falls back. */
const Flag = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((value) => (value === undefined || value === '' ? undefined : value === 'true'));

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// URL'),
    JWT_ACCESS_SECRET: Secret,
    JWT_ACCESS_TTL: Duration.prefault('15m'),
    REFRESH_TOKEN_SECRET: Secret,
    REFRESH_TOKEN_TTL: Duration.prefault('30d'),
    REFRESH_TOKEN_REUSE_GRACE: Duration.prefault('30s'),
    /** Sign-up, sign-in, refresh and logout per client IP per minute. */
    AUTH_RATE_LIMIT: z.coerce.number().int().min(1).default(20),
    CORS_ORIGINS: z.string().default(''),
    SWAGGER_ENABLED: Flag,
    TRUST_PROXY: Flag,
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.REFRESH_TOKEN_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['REFRESH_TOKEN_SECRET'],
        message: 'must differ from JWT_ACCESS_SECRET',
      });
    }
    if (env.NODE_ENV === 'production') {
      for (const key of ['JWT_ACCESS_SECRET', 'REFRESH_TOKEN_SECRET'] as const) {
        if (env[key].startsWith('change-me'))
          ctx.addIssue({ code: 'custom', path: [key], message: 'is still the example value' });
      }
    }
  });

export type AppConfig = {
  env: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  accessToken: { secret: string; ttlMs: number };
  refreshToken: { secret: string; ttlMs: number; reuseGraceMs: number };
  authRateLimitPerMinute: number;
  corsOrigins: string[];
  swaggerEnabled: boolean;
  trustProxy: boolean;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
};

export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(
      `The API is not configured correctly:\n${problems.map((problem) => `  - ${problem}`).join('\n')}\nSee server/.env.example.`,
    );
    this.name = 'ConfigError';
  }
}

export function loadConfig(source: Record<string, string | undefined>): AppConfig {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => {
        const name = issue.path.join('.') || 'environment';
        return source[name] === undefined && issue.code === 'invalid_type'
          ? `${name} is required`
          : `${name} ${issue.message}`;
      }),
    );
  }
  const env = parsed.data;
  return {
    env: env.NODE_ENV,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    accessToken: { secret: env.JWT_ACCESS_SECRET, ttlMs: env.JWT_ACCESS_TTL },
    refreshToken: {
      secret: env.REFRESH_TOKEN_SECRET,
      ttlMs: env.REFRESH_TOKEN_TTL,
      reuseGraceMs: env.REFRESH_TOKEN_REUSE_GRACE,
    },
    authRateLimitPerMinute: env.AUTH_RATE_LIMIT,
    corsOrigins: env.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    swaggerEnabled: env.SWAGGER_ENABLED ?? env.NODE_ENV !== 'production',
    trustProxy: env.TRUST_PROXY ?? false,
    logLevel: env.LOG_LEVEL,
  };
}

/** Injection token for the validated configuration. */
export const APP_CONFIG = Symbol('APP_CONFIG');
