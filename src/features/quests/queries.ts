import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';

import { loadQuestRun } from './use-cases';

/**
 * Always read fresh on open: the saved session seeds the quest's local state
 * once, so it has to be the latest one (e.g. right after a dev shortcut).
 */
export function useQuestRun(questId: string) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.progress.questRun(questId),
    queryFn: () => loadQuestRun(repositories, questId),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}
