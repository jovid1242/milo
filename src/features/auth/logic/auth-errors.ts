import { ApiError } from '@/services/api/api-error';

export type AuthField = 'email' | 'password';

export type AuthErrorView = {
  /** Shown under the form. */
  message: string;
  /** Shown under a field, when the server blamed one. */
  fields: Partial<Record<AuthField, string>>;
};

/** A failed sign-in or sign-up, in words for the person holding the phone. */
export function authErrorView(error: unknown): AuthErrorView {
  if (!(error instanceof ApiError))
    return { message: 'Something went wrong. Try again.', fields: {} };
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return { message: 'That email and password do not match.', fields: {} };
    case 'EMAIL_TAKEN':
      return {
        message: 'An account with this email already exists. Log in instead?',
        fields: { email: 'Already registered' },
      };
    case 'RATE_LIMITED':
      return { message: 'Too many attempts. Wait a minute, then try again.', fields: {} };
    case 'VALIDATION_ERROR':
      return { message: 'Check the highlighted fields.', fields: fieldErrors(error.details) };
    case 'NETWORK_ERROR':
      return { message: 'No connection. Check the internet and try again.', fields: {} };
    case 'TIMEOUT':
      return { message: 'Milo’s server is slow to answer. Try again.', fields: {} };
    default:
      return { message: 'Something went wrong on our side. Try again.', fields: {} };
  }
}

/** `[{ path: 'email', message }]` from the API, by field. */
function fieldErrors(details: unknown): AuthErrorView['fields'] {
  const fields: AuthErrorView['fields'] = {};
  if (!Array.isArray(details)) return fields;
  for (const detail of details as unknown[]) {
    if (typeof detail !== 'object' || detail === null) continue;
    const { path, message } = detail as { path?: unknown; message?: unknown };
    if ((path === 'email' || path === 'password') && typeof message === 'string')
      fields[path] ??= message;
  }
  return fields;
}
