import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import type { CachedTeam } from '@/data/repositories/types';
import type { InviteCode } from '@/schemas';

import {
  createTeam,
  joinTeam,
  leaveTeam,
  loadFriends,
  loadMemberDetails,
  previewInvite,
  refreshTeam,
  renewInvite,
  teamInvite,
} from './use-cases';

/** A new answer about the team: everything that shows it reads it again. */
function teamChanged(queryClient: QueryClient) {
  for (const queryKey of [queryKeys.friends.all, queryKeys.achievements.all]) {
    void queryClient.invalidateQueries({ queryKey, refetchType: 'all' });
  }
}

/**
 * The team, local-first: what this device knows shows at once (the last
 * answer, kept per account, merged with the user's own progress), while the
 * server is asked in the background — paused offline and asked again as soon
 * as the connection is back, when the app returns to the foreground, and
 * every minute while it is on screen.
 */
export function useTeam() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  const local = useQuery({
    queryKey: queryKeys.friends.team,
    queryFn: () => loadFriends(repositories),
  });
  const server = useQuery({
    queryKey: queryKeys.friends.server,
    queryFn: async (): Promise<CachedTeam> => {
      const answer = await refreshTeam(repositories);
      void queryClient.invalidateQueries({ queryKey: queryKeys.friends.team });
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all });
      return answer;
    },
    enabled: repositories.friends.serverBacked,
    networkMode: 'online',
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  return { local, server };
}

export function useMemberDetails(userId: string) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.friends.member(userId),
    queryFn: () => loadMemberDetails(repositories, userId),
  });
}

export function useCreateTeam() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createTeam(repositories),
    onSuccess: () => teamChanged(queryClient),
  });
}

export function useTeamInvite() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => teamInvite(repositories, teamId),
    onSuccess: () => teamChanged(queryClient),
  });
}

export function useRenewInvite() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { teamId: string; inviteId: string }) => renewInvite(repositories, input),
    onSuccess: () => teamChanged(queryClient),
  });
}

/** The team behind a code. Asked when the invite's page opens — never cached across codes. */
export function useInvitePreview(code: InviteCode | null) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.friends.invite(code ?? ''),
    queryFn: () => previewInvite(repositories, code as InviteCode),
    enabled: code !== null && repositories.friends.serverBacked,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}

export function useJoinTeam() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: InviteCode) => joinTeam(repositories, code),
    onSuccess: () => teamChanged(queryClient),
  });
}

export function useLeaveTeam() {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => leaveTeam(repositories, teamId),
    onSuccess: () => teamChanged(queryClient),
  });
}
