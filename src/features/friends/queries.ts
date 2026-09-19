import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';

import {
  createInvite,
  joinTeam,
  loadMemberDetails,
  loadTeamActivity,
  loadTeamView,
} from './use-cases';

/**
 * The team merges the user's own (local) progress with what teammates share,
 * so it is read local-first like everything else: it must update after the
 * user's own quests even without a network. Offline is shown as a note on top
 * of the last known team (see `FriendsScreen`), not as a blank screen.
 */
export function useTeam() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.friends.team,
    queryFn: () => loadTeamView(repositories),
  });
}

export function useMemberDetails(memberId: string) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.friends.member(memberId),
    queryFn: () => loadMemberDetails(repositories, memberId),
  });
}

export function useTeamActivity() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.friends.activity,
    queryFn: () => loadTeamActivity(repositories),
  });
}

export function useCreateInvite() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createInvite(repositories),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.friends.all, refetchType: 'all' }),
  });
}

export function useJoinTeam() {
  const repositories = useRepositories();
  return useMutation({ mutationFn: (code: string) => joinTeam(repositories, code) });
}
