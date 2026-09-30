import { z } from 'zod';

import { IdSchema, TimestampSchema } from './common';
import { DisplayNameSchema, GoalSchema } from './user';

/**
 * The HTTP contract between the app and the Milo API: one set of schemas for
 * both sides. The server validates requests and shapes its responses with
 * them; the app validates what it receives. There is never a second, "almost
 * the same" copy on either side.
 */

/**
 * Email as the login identifier: trimmed and lower-cased before it is checked,
 * so `Ada@Example.com ` and `ada@example.com` are one account.
 */
export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254, 'Email is too long'))
  .meta({ format: 'email', maxLength: 254 });

/**
 * A new password: long enough to matter, with a letter and a number. Length
 * is what protects most; the upper bound keeps hashing cheap to refuse.
 */
export const PasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Use at most 128 characters')
  .refine((password) => /\p{L}/u.test(password), 'Include at least one letter')
  .refine((password) => /\p{N}/u.test(password), 'Include at least one number');

/** Credentials only: the name and the goal belong to onboarding, asked once. */
export const RegisterRequestSchema = z.strictObject({
  email: EmailSchema,
  password: PasswordSchema,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/** Signing in checks the password, not its policy: older passwords stay valid. */
export const LoginRequestSchema = z.strictObject({
  email: EmailSchema,
  password: z.string().min(1, 'Enter your password').max(128, 'Use at most 128 characters'),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/** Opaque to the app: a long random string the server can revoke. */
export const RefreshTokenSchema = z.string().min(32).max(256);

export const RefreshRequestSchema = z.strictObject({ refreshToken: RefreshTokenSchema });
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

/** The account as the API returns it. The learning profile itself stays in the app for now. */
export const UserDtoSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  /** `null` until onboarding sends it. */
  displayName: DisplayNameSchema.nullable(),
  goal: GoalSchema.nullable(),
  createdAt: TimestampSchema,
});
export type UserDto = z.infer<typeof UserDtoSchema>;

/** What register, login and refresh return: the account and a fresh token pair. */
export const AuthSessionSchema = z.object({
  user: UserDtoSchema,
  accessToken: z.string().min(1),
  accessTokenExpiresAt: TimestampSchema,
  refreshToken: RefreshTokenSchema,
  refreshTokenExpiresAt: TimestampSchema,
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

/** The profile fields a user may change — nothing else is accepted. */
export const UpdateProfileRequestSchema = z
  .strictObject({
    displayName: DisplayNameSchema.optional(),
    goal: GoalSchema.nullable().optional(),
  })
  .refine((update) => update.displayName !== undefined || update.goal !== undefined, {
    message: 'Nothing to update',
  });
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

/**
 * Machine-readable error codes. Clients switch on `code`, never on `message`,
 * which is for people and may change.
 */
export const API_ERROR_CODES = [
  'VALIDATION_ERROR',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'UNAUTHORIZED',
  'REFRESH_TOKEN_INVALID',
  'REFRESH_TOKEN_REUSED',
  'NOT_FOUND',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'COURSE_UNAVAILABLE',
  'COURSE_MISMATCH',
  'COURSE_VERSION_UNSUPPORTED',
  'ACCOUNT_MISMATCH',
  'FORBIDDEN',
  /** Teams are for a challenge that has started. */
  'CHALLENGE_NOT_STARTED',
  'ALREADY_IN_TEAM',
  'ALREADY_MEMBER',
  'TEAM_FULL',
  'TEAM_NOT_FOUND',
  'INVITE_INVALID',
  'INVITE_EXPIRED',
  'INVITE_REVOKED',
  'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Every error response: `{ code, message, details? }` — never a stack trace. */
export const ApiErrorBodySchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

/**
 * The course document format this app understands. It changes only when the
 * document's shape changes incompatibly; the content's own `version` moves
 * freely underneath it.
 */
export const COURSE_SCHEMA_VERSION = 1;

/**
 * What `GET /course/current` returns: small, so it can be checked on every
 * launch. The document itself is downloaded only when `version` or
 * `contentHash` differs from the cached one.
 */
export const CourseManifestSchema = z.object({
  courseId: IdSchema,
  version: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  title: z.string().min(1),
  language: z.string().regex(/^[a-z]{2}$/),
  supportLanguage: z.string().regex(/^[a-z]{2}$/),
  totalDays: z.number().int().positive(),
  /** SHA-256 of the course document (hex). */
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  /** Where the document is, relative to the API base: `/courses/milo-english-90/versions/1`. */
  documentPath: z.string().startsWith('/'),
});
export type CourseManifest = z.infer<typeof CourseManifestSchema>;
