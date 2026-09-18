import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';

import { loadTodayJourney } from './use-cases';

export function useTodayJourney() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.progress.today,
    queryFn: () => loadTodayJourney(repositories),
  });
}
