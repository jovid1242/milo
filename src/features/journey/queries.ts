import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';

import { loadJourney } from './use-cases';

/** The 90-day map; refreshed with every progress change (it lives under `progress`). */
export function useJourney() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.progress.journey,
    queryFn: () => loadJourney(repositories),
  });
}
