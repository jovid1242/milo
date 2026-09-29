import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import type { Account } from '@/data/repositories/types';
import type { LoginRequest, RegisterRequest } from '@/schemas';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

import { onboardingPrefill, signOut } from './use-cases';

/** Signed in: onboarding starts from what the account knows, and the app opens. */
function enter(account: Account) {
  const onboarding = useOnboardingStore.getState();
  const prefill = onboardingPrefill(onboarding, account);
  if (prefill.name !== undefined) onboarding.setName(prefill.name);
  if (prefill.goal !== undefined) onboarding.setGoal(prefill.goal);
  useAuthStore.getState().signedIn(account);
}

export function useSignIn() {
  const repositories = useRepositories();
  return useMutation({
    mutationFn: (input: LoginRequest) => repositories.auth.login(input),
    onSuccess: enter,
  });
}

export function useSignUp() {
  const repositories = useRepositories();
  return useMutation({
    mutationFn: (input: RegisterRequest) => repositories.auth.register(input),
    onSuccess: enter,
  });
}

export function useSignOut() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => signOut(repositories.auth, queryClient),
    // Out even when the server could not be told: the device has forgotten the session.
    onSettled: () => useAuthStore.getState().signedOut(),
  });
}

/** The account, fresh from the server when it can be reached; the saved copy otherwise. */
export function useAccount() {
  const repositories = useRepositories();
  const account = useAuthStore((state) => state.account);
  return useQuery({
    queryKey: queryKeys.account.me,
    queryFn: async () => {
      const fresh = await repositories.auth.fetchAccount();
      useAuthStore.getState().accountUpdated(fresh);
      return fresh;
    },
    enabled: repositories.auth.mode === 'remote' && account !== null,
    placeholderData: account ?? undefined,
    networkMode: 'online',
    staleTime: 60_000,
  });
}
