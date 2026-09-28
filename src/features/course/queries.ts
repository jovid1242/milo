import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import type { DayNumber } from '@/schemas';

/** The course's identity, version, chapters and days. */
export function useCourseOutline() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.course.outline,
    queryFn: () => repositories.course.getCourse(),
    staleTime: Infinity, // content, not progress
  });
}

export function useChapters() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.course.chapters,
    queryFn: () => repositories.course.getChapters(),
    staleTime: Infinity, // bundled content
  });
}

export function useCourseDay(day: DayNumber | undefined) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.course.day(day ?? 1),
    queryFn: () => repositories.course.getDay(day ?? 1),
    enabled: day !== undefined,
    staleTime: Infinity,
  });
}

/** One quest from the 90-day plan; `null` for an unknown id. */
export function useQuest(questId: string | undefined) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.course.quest(questId ?? ''),
    queryFn: async () => {
      const days = await repositories.course.getDays();
      return days.flatMap((day) => day.quests).find((quest) => quest.id === questId) ?? null;
    },
    enabled: questId !== undefined,
    staleTime: Infinity,
  });
}

export function useQuestContent(questId: string | undefined) {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.course.questContent(questId ?? ''),
    queryFn: () => repositories.course.getQuestContent(questId ?? ''),
    enabled: questId !== undefined,
    staleTime: Infinity,
  });
}
