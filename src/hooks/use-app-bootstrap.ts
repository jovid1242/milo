import { useCallback, useEffect, useState } from 'react';

import { getDatabase } from '@/data/db/database';
import type { Repositories } from '@/data/repositories/types';
import { restoreAuth } from '@/features/auth/use-cases';
import { logger } from '@/lib/logger';
import { appRepositories } from '@/providers/app-providers';
import type { User } from '@/schemas';
import { soundManager } from '@/services/audio/sound-manager';
import { useAuthStore } from '@/stores/auth-store';

export type BootstrapStatus = 'loading' | 'ready' | 'error';

/**
 * With the course from the API: asks the server for a newer course and saves
 * it, validated, for the next launch. In the background — the course in use
 * is already chosen, from the cache or the bundle, and never waits for it.
 */
function checkForCourseUpdate(repositories: Repositories) {
  repositories.courseUpdates
    ?.check()
    .then((result) => logger.debug(`course update check: ${result.status}`, result))
    .catch((error: unknown) => logger.warn('the course update check failed', error));
}

/**
 * Startup work that must finish before the first screen: open and migrate the
 * database, make sure a local profile exists, and read the saved session from
 * the Keychain. Both come back before the splash screen goes — the very first
 * routing decision (sign in, onboarding or the challenge) depends on them and
 * cannot wait for a query. Sound preloading and the course update check
 * happen in the background — they must never delay the UI.
 */
export function useAppBootstrap() {
  const [status, setStatus] = useState<BootstrapStatus>('loading');
  const [error, setError] = useState<unknown>(null);
  const [user, setUser] = useState<User | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await getDatabase();
        const [profile, auth] = await Promise.all([
          appRepositories.user.getUser(),
          restoreAuth(appRepositories.auth),
        ]);
        if (cancelled) return;
        if (auth.status === 'authenticated') useAuthStore.getState().signedIn(auth.account);
        else useAuthStore.getState().signedOut();
        setUser(profile);
        setStatus('ready');
        soundManager.preload().catch((soundError: unknown) => {
          logger.warn('sound preload failed', soundError);
        });
        checkForCourseUpdate(appRepositories);
      } catch (bootError: unknown) {
        logger.error('app bootstrap failed', bootError);
        if (cancelled) return;
        setError(bootError);
        setStatus('error');
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setStatus('loading');
    setError(null);
    setAttempt((value) => value + 1);
  }, []);

  return { status, error, user, retry };
}
