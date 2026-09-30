import { useMutation, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import type { Account } from '@/data/repositories/types';
import { openAppSession } from '@/providers/app-session';
import type { LoginRequest, RegisterRequest } from '@/schemas';
import { prepareAccount } from '@/services/session/owner-session';
import { useAuthStore } from '@/stores/auth-store';
import { useOnboardingStore } from '@/stores/onboarding-store';

import { onboardingPrefill, signOut } from './use-cases';

/**
 * Signed in: the account's progress is opened — from the server first, when
 * it can be reached — onboarding starts from what the account knows, and the
 * app opens on the account's own state. Until then the sign-in screen waits:
 * nothing of any other account is ever on screen.
 */
async function enter(account: Account) {
  const session = await prepareAccount(await openAppSession(account));
  const onboarding = useOnboardingStore.getState();
  const prefill = onboardingPrefill(onboarding, account);
  if (prefill.name !== undefined) onboarding.setName(prefill.name);
  if (prefill.goal !== undefined) onboarding.setGoal(prefill.goal);
  useAuthStore.getState().signedIn(session);
}

export function useSignIn() {
  const repositories = useRepositories();
  return useMutation({
    mutationFn: async (input: LoginRequest) => enter(await repositories.auth.login(input)),
  });
}

export function useSignUp() {
  const repositories = useRepositories();
  return useMutation({
    mutationFn: async (input: RegisterRequest) => enter(await repositories.auth.register(input)),
  });
}

export function useSignOut() {
  const repositories = useRepositories();
  return useMutation({
    mutationFn: () => signOut(repositories.auth, useAuthStore.getState().session),
    // Out even when the server could not be told: the device has forgotten the
    // session. An onboarding half done stays with nobody.
    onSettled: () => {
      useOnboardingStore.getState().clear();
      useAuthStore.getState().signedOut();
    },
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
