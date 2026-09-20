import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STORAGE } from '@/constants/challenge';
import {
  EMPTY_DRAFT,
  parseOnboardingDraft,
  type Goal,
  type OnboardingDraft,
  type OnboardingStep,
} from '@/schemas';

type OnboardingStore = OnboardingDraft & {
  hasHydrated: boolean;
  setStep: (step: OnboardingStep) => void;
  setName: (name: string) => void;
  setGoal: (goal: Goal) => void;
  /** Back to a blank first launch (after onboarding, or when it is reset). */
  clear: () => void;
};

/**
 * The onboarding draft. It lives here rather than in component state because
 * it must survive the app being closed mid-flow: the user comes back to the
 * step they left, with the answers they already gave.
 */
export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      ...EMPTY_DRAFT,
      hasHydrated: false,
      setStep: (step) => set({ step }),
      setName: (name) => set({ name: name.slice(0, 24) }),
      setGoal: (goal) => set({ goal }),
      clear: () => set({ ...EMPTY_DRAFT }),
    }),
    {
      name: STORAGE.onboardingKey,
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ step, name, goal }) => ({ step, name, goal }),
      migrate: (persisted) => parseOnboardingDraft(persisted),
      merge: (persisted, current) => ({ ...current, ...parseOnboardingDraft(persisted) }),
      onRehydrateStorage: () => () => {
        useOnboardingStore.setState({ hasHydrated: true });
      },
    },
  ),
);

export const getOnboardingDraft = (): OnboardingDraft => {
  const { step, name, goal } = useOnboardingStore.getState();
  return { step, name, goal };
};
