import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import {
  parsePendingInvite,
  pendingInvite,
  type PendingInvite,
} from '@/features/friends/logic/pending-invite';
import { logger } from '@/lib/logger';
import type { InviteCode } from '@/schemas';

const KEY = 'milo.team.pending-invite';

/** An invite code is a key to a team: kept like one, on this device only. */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

type PendingInviteStore = {
  pending: PendingInvite | null;
  hydrated: boolean;
  /** Keeps an invite until the user can see it (through sign-in and onboarding). */
  hold: (code: InviteCode) => void;
  /** The invite was shown (or dismissed): it does not open again. */
  clear: () => void;
  /** Reads what a previous launch kept. */
  hydrate: () => Promise<void>;
};

export const usePendingInviteStore = create<PendingInviteStore>((set, get) => ({
  pending: null,
  hydrated: false,
  hold: (code) => {
    const pending = pendingInvite(code);
    set({ pending });
    SecureStore.setItemAsync(KEY, JSON.stringify(pending), OPTIONS).catch((error: unknown) =>
      logger.warn('the invite could not be kept for later', error),
    );
  },
  clear: () => {
    if (get().pending === null && get().hydrated) return;
    set({ pending: null });
    SecureStore.deleteItemAsync(KEY, OPTIONS).catch((error: unknown) =>
      logger.warn('the kept invite could not be removed', error),
    );
  },
  hydrate: async () => {
    if (get().hydrated) return;
    let stored: PendingInvite | null = null;
    try {
      const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
      stored = parsePendingInvite(raw);
      if (raw !== null && !stored) await SecureStore.deleteItemAsync(KEY, OPTIONS);
    } catch (error) {
      logger.warn('the kept invite could not be read', error);
    }
    // One held during this launch wins over an older one.
    set((state) => ({ pending: state.pending ?? stored, hydrated: true }));
  },
}));
