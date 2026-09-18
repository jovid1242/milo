import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';

import { completeQuest, loadProgressState, startQuest, type CompleteQuestInput } from './use-cases';

export function useProgressState() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.progress.state,
    queryFn: () => loadProgressState(repositories),
  });
}

/**
 * Invalidates everything derived from local progress.
 *
 * `refetchType: 'all'` on purpose: screens sitting behind a modal are frozen by
 * react-native-screens, so the default (active observers only) would leave them
 * showing stale numbers until they are touched again. Refetching is a cheap
 * SQLite read here.
 */
export function invalidateProgress(queryClient: QueryClient): void {
  for (const queryKey of [queryKeys.progress.all, queryKeys.achievements.all, queryKeys.user]) {
    void queryClient.invalidateQueries({ queryKey, refetchType: 'all' });
  }
}

export function useStartQuest() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (questId: string) => startQuest(repositories, questId),
    onSuccess: () => invalidateProgress(queryClient),
  });
}

export function useCompleteQuest() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteQuestInput) => completeQuest(repositories, input),
    onSuccess: () => invalidateProgress(queryClient),
  });
}
