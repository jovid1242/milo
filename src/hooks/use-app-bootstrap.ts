import { useCallback, useEffect, useState } from 'react';

import { getDatabase } from '@/data/db/database';
import { logger } from '@/lib/logger';
import { appRepositories } from '@/providers/app-providers';
import { soundManager } from '@/services/audio/sound-manager';

export type BootstrapStatus = 'loading' | 'ready' | 'error';

/**
 * Startup work that must finish before the first screen: open and migrate the
 * database and make sure a local profile exists. Sound preloading happens in
 * the background — it must never delay the UI.
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
        await appRepositories.user.getUser();
        if (cancelled) return;
        setStatus('ready');
        soundManager.preload().catch((soundError: unknown) => {
          logger.warn('sound preload failed', soundError);
        });
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
