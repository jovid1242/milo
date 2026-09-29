import type { Account, AuthRepository } from '../types';

const NO_ACCOUNTS = 'Accounts need the Milo API (EXPO_PUBLIC_API_URL).';

/**
 * No backend: the app is the device's own, as it was before accounts. There
 * is nobody to sign in or out, so the app never asks — and never pretends to
 * have an account it does not have.
 */
export class LocalAuthRepository implements AuthRepository {
  readonly mode = 'local';

  async restoreSession(): Promise<Account | null> {
    return null;
  }

  register(): Promise<Account> {
    return Promise.reject(new Error(NO_ACCOUNTS));
  }

  login(): Promise<Account> {
    return Promise.reject(new Error(NO_ACCOUNTS));
  }

  async logout(): Promise<void> {}

  fetchAccount(): Promise<Account> {
    return Promise.reject(new Error(NO_ACCOUNTS));
  }

  updateProfile(): Promise<Account> {
    return Promise.reject(new Error(NO_ACCOUNTS));
  }

  onSessionEnded(): () => void {
    return () => undefined;
  }
}
