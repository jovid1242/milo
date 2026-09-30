import type { QueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import type { Account } from '@/data/repositories/types';
import type { OwnerSession } from '@/services/session/owner-session';

export type AppSession = OwnerSession<QueryClient>;

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'unauthenticated';

type AuthStore = {
  status: AuthStatus;
  /** The account; `null` when signed out — and always in local mode, where there is none. */
  account: Account | null;
  /**
   * Whose progress the app shows: an account's, or the device's own in local
   * mode. `null` when signed out — then no progress is shown at all.
   */
  session: AppSession | null;
  signedIn: (session: AppSession) => void;
  signedOut: () => void;
  accountUpdated: (account: Account) => void;
};

/**
 * Who is using the app. It starts `bootstrapping`, and the splash screen stays
 * up until the Keychain has been read — a signed-in user never glimpses the
 * sign-in screen. Not persisted: the Keychain is the record. A session that
 * ends is disposed here — its sync stopped, its cache dropped — before any
 * other can take its place.
 */
export const useAuthStore = create<AuthStore>()((set, get) => ({
  status: 'bootstrapping',
  account: null,
  session: null,
  signedIn: (session) => {
    const previous = get().session;
    if (previous && previous !== session) previous.dispose();
    set({ status: 'authenticated', account: session.account, session });
  },
  signedOut: () => {
    get().session?.dispose();
    set({ status: 'unauthenticated', account: null, session: null });
  },
  accountUpdated: (account) =>
    set((state) =>
      state.status === 'authenticated' && state.account?.id === account.id ? { account } : state,
    ),
}));
