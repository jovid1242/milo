import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';

/** The owner's profile. `enabled: false` while nobody is signed in: there is no profile then. */
export function useUser({ enabled = true }: { enabled?: boolean } = {}) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => repositories.user.getUser(),
    enabled,
  });
}

export function useUpdateDisplayName() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => repositories.user.updateDisplayName(displayName),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.user, user);
      // With an account, the new name goes to it too (best effort: saved here either way).
      if (repositories.auth.mode !== 'remote') return;
      repositories.auth
        .updateProfile({ displayName: user.displayName })
        .then((account) => useAuthStore.getState().accountUpdated(account))
        .catch((error: unknown) => logger.warn('the new name could not reach the account', error));
    },
  });
}
