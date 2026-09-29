import { create } from 'zustand';

import type { Account } from '@/data/repositories/types';

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

type AuthStore = {
  status: AuthStatus;
  /** The account; `null` when signed out — and always in local mode, where there is none. */
  account: Account | null;
  signedIn: (account: Account | null) => void;
  signedOut: () => void;
  accountUpdated: (account: Account) => void;
};

/**
 * Who is using the app. It starts `bootstrapping`, and the splash screen stays
 * up until the Keychain has been read — a signed-in user never glimpses the
 * sign-in screen. Not persisted: the Keychain is the record.
 */
export const useAuthStore = create<AuthStore>()((set) => ({
  status: 'bootstrapping',
  account: null,
  signedIn: (account) => set({ status: 'authenticated', account }),
  signedOut: () => set({ status: 'unauthenticated', account: null }),
  accountUpdated: (account) =>
    set((state) => (state.status === 'authenticated' ? { account } : state)),
}));
