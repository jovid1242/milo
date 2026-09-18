import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import type { DayNumber } from '@/schemas';

export function useChapters() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.challenge.chapters,
    queryFn: () => repositories.challenge.getChapters(),
    staleTime: Infinity, // bundled content
  });
}

export function useDailyChallenge(day: DayNumber | undefined) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.challenge.day(day ?? 1),
    queryFn: () => repositories.challenge.getDailyChallenge(day ?? 1),
    enabled: day !== undefined,
    staleTime: Infinity,
  });
}

/** One quest from the 90-day plan; `null` for an unknown id. */
export function useQuest(questId: string | undefined) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.challenge.quest(questId ?? ''),
    queryFn: async () => {
      const plans = await repositories.challenge.getDailyChallenges();
      return plans.flatMap((plan) => plan.quests).find((quest) => quest.id === questId) ?? null;
    },
    enabled: questId !== undefined,
    staleTime: Infinity,
  });
}

export function useQuestContent(questId: string | undefined) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.challenge.questContent(questId ?? ''),
    queryFn: () => repositories.challenge.getQuestContent(questId ?? ''),
    enabled: questId !== undefined,
    staleTime: Infinity,
  });
}
