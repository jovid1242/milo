import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { createLocalRepositories } from '@/data/repositories';
import { RepositoryProvider } from '@/data/repository-provider';
import { createQueryClient, setupQueryManagers } from '@/lib/query-client';

/**
 * One instance per app launch. Exported so non-React code (bootstrap, tests)
 * can reach the same repositories.
 */
export const appRepositories = createLocalRepositories();
const queryClient = createQueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => setupQueryManagers(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repositories={appRepositories}>{children}</RepositoryProvider>
    </QueryClientProvider>
  );
}
