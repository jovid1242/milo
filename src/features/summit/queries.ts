import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import { invalidateProgress } from '@/features/progress/queries';

import { claimSummit, loadSummit } from './use-cases';

/** Read fresh on open: whether the victory plays is decided from this data. */
export function useSummit() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.progress.summit,
    queryFn: () => loadSummit(repositories),
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

export function useClaimSummit() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => claimSummit(repositories),
    onSuccess: () => invalidateProgress(queryClient),
  });
}
