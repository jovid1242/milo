import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';

export function useFriends() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.friends.list,
    queryFn: () => repositories.friends.getFriends(),
    // Friends are server-shaped data: keep the online behaviour (and the offline
    // UI) honest even while the implementation is local.
    networkMode: 'online',
  });
}
