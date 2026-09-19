import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import type { AchievementId } from '@/schemas';

import { loadAchievements, loadPendingCelebrations, markCelebrated } from './use-cases';

/** The 12 badges, derived from stored progress; refreshed with every progress change. */
export function useAchievements() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.achievements.list,
    queryFn: () => loadAchievements(repositories),
  });
}

/** Unlocked badges still waiting for their celebration. */
export function usePendingCelebrations() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.achievements.pending,
    queryFn: () => loadPendingCelebrations(repositories),
  });
}

export function useMarkCelebrated() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: readonly AchievementId[]) => markCelebrated(repositories, ids),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all, refetchType: 'all' }),
  });
}
