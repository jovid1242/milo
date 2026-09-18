import type { Achievement, AchievementCriteria, AchievementId } from '@/schemas';

export type AchievementContext = {
  completedDays: number;
  streak: number;
  wordsLearned: number;
  hasPerfectQuiz: boolean;
  teamStreak: number;
};

export function isCriteriaMet(criteria: AchievementCriteria, context: AchievementContext): boolean {
  switch (criteria.type) {
    case 'completedDays':
      return context.completedDays >= criteria.count;
    case 'streak':
      return context.streak >= criteria.count;
    case 'wordsLearned':
      return context.wordsLearned >= criteria.count;
    case 'perfectQuiz':
      return context.hasPerfectQuiz;
    case 'teamStreak':
      return context.teamStreak >= criteria.count;
  }
}

export function findNewlyEarnedAchievements(
  definitions: readonly Achievement[],
  context: AchievementContext,
  unlockedIds: ReadonlySet<AchievementId>,
): Achievement[] {
  return definitions.filter((a) => !unlockedIds.has(a.id) && isCriteriaMet(a.criteria, context));
}
