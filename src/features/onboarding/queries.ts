import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import { pushProfile } from '@/features/auth/use-cases';
import { invalidateProgress } from '@/features/progress/queries';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

import { startChallenge, type StartChallengeInput } from './use-cases';

export function useStartChallenge() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StartChallengeInput) => startChallenge(repositories, input),
    onSuccess: (user) => {
      // The draft has served its purpose; the profile is the record now.
      useOnboardingStore.getState().clear();
      queryClient.setQueryData(queryKeys.user, user);
      // Day 1 starts today: everything derived from the start date is stale.
      invalidateProgress(queryClient);
      // The account learns the name and goal too. Best effort: the challenge
      // has started on the device either way.
      pushProfile(repositories.auth, user)
        .then((account) => {
          if (account) useAuthStore.getState().accountUpdated(account);
        })
        .catch((error: unknown) => logger.warn('the profile could not reach the account', error));
    },
  });
}
