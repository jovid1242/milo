import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { repositoriesWithoutOwner } from '@/data/repositories';
import { RepositoryProvider } from '@/data/repository-provider';
import { createQueryClient, setupQueryManagers } from '@/lib/query-client';
import { useAuthStore } from '@/stores/auth-store';

import { deviceServices } from './app-session';

/**
 * The owner's scope: their repositories and a query cache of their own. A
 * new owner remounts everything under it (`key`), so nothing — no screen, no
 * cached query — survives from one account into another's. Signed out, there
 * is no progress at all: only the account itself can be reached.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const session = useAuthStore((state) => state.session);
  // Held in state, not at module level: editing course content re-runs this
  // module during development, and a new client would strand every mounted
  // screen on the old one.
  const [signedOut] = useState(() => ({
    queryClient: createQueryClient(),
    repositories: repositoriesWithoutOwner(deviceServices),
  }));
  useEffect(() => setupQueryManagers(), []);
  const scope = session ?? signedOut;

  return (
    <QueryClientProvider client={scope.queryClient} key={session?.owner ?? 'signed-out'}>
      <RepositoryProvider repositories={scope.repositories}>{children}</RepositoryProvider>
    </QueryClientProvider>
  );
}
