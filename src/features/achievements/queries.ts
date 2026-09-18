import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/data/query-keys';
import { useRepositories } from '@/data/repository-provider';
import type { Achievement, Timestamp } from '@/schemas';

export type AchievementStatus = {
  achievement: Achievement;
  unlockedAt: Timestamp | null;
};

export function useAchievements() {
  const repositories = useRepositories();
  return useQuery({
    queryKey: queryKeys.achievements.list,
    queryFn: async (): Promise<AchievementStatus[]> => {
      const [definitions, unlocks] = await Promise.all([
        repositories.achievements.getDefinitions(),
        repositories.achievements.getUnlocks(),
      ]);
      const unlockedAt = new Map(
        unlocks.map((unlock) => [unlock.achievementId, unlock.unlockedAt]),
      );
      return definitions.map((achievement) => ({
        achievement,
        unlockedAt: unlockedAt.get(achievement.id) ?? null,
      }));
    },
  });
}
