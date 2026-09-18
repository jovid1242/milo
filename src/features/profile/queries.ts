import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';

export function useUser() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => repositories.user.getUser(),
  });
}

export function useUpdateDisplayName() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) => repositories.user.updateDisplayName(displayName),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.user, user);
    },
  });
}
