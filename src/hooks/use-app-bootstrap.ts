import { useCallback, useEffect, useState } from 'react';

import { getDatabase } from '@/data/db/database';
import type { CourseUpdates } from '@/data/repositories/types';
import { restoreAuth } from '@/features/auth/use-cases';
import { logger } from '@/lib/logger';
import { deviceServices, openAppSession } from '@/providers/app-session';
import { soundManager } from '@/services/audio/sound-manager';
import {
  needsFirstSync,
  prepareAccount,
  settleLegacyProgress,
} from '@/services/session/owner-session';
import { useAuthStore } from '@/stores/auth-store';

export type BootstrapStatus = 'loading' | 'ready' | 'error';

/**
 * With the course from the API: asks the server for a newer course and saves
 * it, validated, for the next launch. In the background — the course in use
 * is already chosen, from the cache or the bundle, and never waits for it.
 */
function checkForCourseUpdate(courseUpdates: CourseUpdates | null) {
  courseUpdates
    ?.check()
    .then((result) => logger.debug(`course update check: ${result.status}`, result))
    .catch((error: unknown) => logger.warn('the course update check failed', error));
}

/**
 * Startup work that must finish before the first screen: open and migrate the
 * database, read the saved session from the Keychain and open its owner's
 * progress — the account's, or the device's own in local mode. The very first
 * routing decision (sign in, onboarding or the challenge) depends on them and
 * cannot wait for a query. The account's sync, sound preloading and the course
 * update check happen in the background — they must never delay the UI.
 */
export function useAppBootstrap() {
  const [status, setStatus] = useState<BootstrapStatus>('loading');
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        await getDatabase();
        const auth = await restoreAuth(deviceServices.auth);
        let session = auth.status === 'authenticated' ? await openAppSession(auth.account) : null;
        // An account this phone never synced, with nothing to show: the splash
        // waits briefly for the server rather than show onboarding by mistake.
        const first = session !== null && (await needsFirstSync(session));
        if (session && first) session = await prepareAccount(session, { waitMs: 5_000 });
        if (cancelled) {
          session?.dispose();
          return;
        }
        if (session) useAuthStore.getState().signedIn(session);
        else useAuthStore.getState().signedOut();
        setStatus('ready');
        // Offline, this simply waits for the connection.
        const opened = session;
        if (opened && !first) {
          opened.engine
            ?.requestSync('launch')
            .then(() => settleLegacyProgress(opened))
            .catch((syncError: unknown) => logger.warn('the launch sync failed', syncError));
        }
        soundManager.preload().catch((soundError: unknown) => {
          logger.warn('sound preload failed', soundError);
        });
        checkForCourseUpdate(deviceServices.courseUpdates);
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

  return { status, error, retry };
}
