import { useEffect, useEffectEvent } from 'react';

import { useRepositories } from '@/data/repository-provider';
import { useUser } from '@/features/profile/queries';
import { logger } from '@/lib/logger';
import { useAuthStore } from '@/stores/auth-store';

import { completeAccountProfile } from '../use-cases';

/**
 * Fills in the account's name and goal from this device — after signing in,
 * at launch, and once onboarding is done. Offline, it waits for the next time.
 */
export function AccountProfileSync() {
  const repositories = useRepositories();
  const accountId = useAuthStore((state) => state.account?.id ?? null);
  const user = useUser();
  const hasProfile = user.data !== undefined;
  const onboardedAt = user.data?.onboardedAt ?? null;

  const sync = useEffectEvent(() => {
    const profile = user.data;
    if (!profile) return;
    completeAccountProfile(repositories.auth, profile)
      .then((account) => {
        if (account) useAuthStore.getState().accountUpdated(account);
      })
      .catch((error: unknown) => logger.warn('the account profile could not be completed', error));
  });

  // Once per sign-in, launch and finished onboarding — not on every profile
  // edit: those go to the account where they happen (Settings).
  useEffect(() => {
    if (repositories.auth.mode !== 'remote' || accountId === null || onboardedAt === null) return;
    sync();
  }, [repositories, accountId, onboardedAt, hasProfile]);

  return null;
}
