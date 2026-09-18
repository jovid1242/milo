import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';

import { loadVocabularyQuest } from './use-cases';

/**
 * Always read fresh on open: the saved session seeds the quest's local state
 * once, so it must be the latest one (e.g. right after a dev shortcut).
 */
export function useVocabularyQuest(questId: string) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.progress.vocabulary(questId),
    queryFn: () => loadVocabularyQuest(repositories, questId),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}
