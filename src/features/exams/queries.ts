import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';

import { loadExamRun } from './use-cases';

/**
 * Read fresh on open: the screen decides from it once whether to resume, show
 * the result or start — it has to be the latest.
 */
export function useExamRun(questId: string) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.progress.examRun(questId),
    queryFn: () => loadExamRun(repositories, questId),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}
