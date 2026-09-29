import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import { useAuthStore } from '@/stores/auth-store';

/**
 * When the server ends the session by itself — expired, revoked, a replayed
 * token — the app signs out: once, however many requests found out at once.
 */
export function SessionWatcher() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      repositories.auth.onSessionEnded(() => {
        queryClient.removeQueries({ queryKey: queryKeys.account.all });
        useAuthStore.getState().signedOut();
      }),
    [repositories, queryClient],
  );

  return null;
}
