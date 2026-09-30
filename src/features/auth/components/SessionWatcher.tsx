import { useEffect } from 'react';

import { useRepositories } from '@/data/repository-provider';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

/**
 * When the server ends the session by itself — expired, revoked, a replayed
 * token — the app signs out: once, however many requests found out at once.
 */
export function SessionWatcher() {
  const repositories = useRepositories();

  useEffect(
    () =>
      repositories.auth.onSessionEnded(() => {
        useOnboardingStore.getState().clear();
        useAuthStore.getState().signedOut();
      }),
    [repositories],
  );

  return null;
}
