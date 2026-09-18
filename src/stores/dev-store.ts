import { create } from 'zustand';

type DevStore = {
  /** Forces TanStack Query offline so offline UI can be tested without a backend. */
  simulateOffline: boolean;
  setSimulateOffline: (simulateOffline: boolean) => void;
};

/** Development-only switches. Never persisted. */
export const useDevStore = create<DevStore>((set) => ({
  simulateOffline: false,
  setSimulateOffline: (simulateOffline) => set({ simulateOffline }),
}));
