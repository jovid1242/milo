import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { createAppRepositories } from '@/data/repositories';
import { RepositoryProvider } from '@/data/repository-provider';
import { createQueryClient, setupQueryManagers } from '@/lib/query-client';

/**
 * One instance per app launch, for this build's backend (local or the Milo
 * API). Exported so non-React code (bootstrap, tests) can reach the same
 * repositories.
 */
export const appRepositories = createAppRepositories();

export function AppProviders({ children }: { children: ReactNode }) {
  // Held in state, not at module level: editing course content re-runs this
  // module during development, and a new client would strand every mounted
  // screen on the old one — no invalidation would reach them any more.
  const [queryClient] = useState(createQueryClient);
  useEffect(() => setupQueryManagers(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repositories={appRepositories}>{children}</RepositoryProvider>
    </QueryClientProvider>
  );
}
