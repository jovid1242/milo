import { create } from 'zustand';

import type { SyncStatus } from '@/services/sync/progress-sync-engine';

type SyncStore = {
  /** The signed-in account's sync; `null` in local mode and when signed out. */
  status: SyncStatus | null;
  setStatus: (status: SyncStatus | null) => void;
};

/** Where the progress sync stands, for the screens that show it. Never persisted. */
export const useSyncStore = create<SyncStore>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
}));
