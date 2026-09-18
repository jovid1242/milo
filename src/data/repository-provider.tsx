import { createContext, use, type ReactNode } from 'react';

import type { Repositories } from './repositories/types';

const RepositoryContext = createContext<Repositories | null>(null);

export function RepositoryProvider({
  repositories,
  children,
}: {
  repositories: Repositories;
  children: ReactNode;
}) {
  return <RepositoryContext value={repositories}>{children}</RepositoryContext>;
}

/** Access point for every query/mutation; swap the provider value in tests. */
export function useRepositories(): Repositories {
  const repositories = use(RepositoryContext);
  if (!repositories) throw new Error('useRepositories must be used inside <RepositoryProvider>');
  return repositories;
}
