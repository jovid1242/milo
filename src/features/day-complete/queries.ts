import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import { invalidateProgress } from '@/features/progress/queries';
import { completeDay } from '@/features/progress/use-cases';
import type { DayNumber } from '@/schemas';

import { loadDaySummary } from './use-cases';

/** Read fresh on open: whether the celebration plays is decided from this data. */
export function useDaySummary(day: DayNumber) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.progress.day(day),
    queryFn: () => loadDaySummary(repositories, day),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/**
 * "Finish Day": makes sure the day is recorded (idempotent — the quest
 * completion normally did it already) before its summary opens.
 */
export function useFinishDay() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (day: DayNumber) => completeDay(repositories, day),
    onSuccess: () => invalidateProgress(queryClient),
  });
}
