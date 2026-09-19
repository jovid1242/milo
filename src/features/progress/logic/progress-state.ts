import { findChapterForDay, getChallengeDay } from '@/features/challenge/logic/calendar';
import type {
  AchievementUnlock,
  Chapter,
  DailyChallenge,
  DayNumber,
  ProgressState,
  QuestCompletion,
  User,
} from '@/schemas';

import { findCompletedDays } from './day-completion';
import { getLevelInfo } from './levels';
import { computeStreak } from './streak';

export type ProgressInputs = {
  user: User;
  chapters: readonly Chapter[];
  dailyChallenges: readonly DailyChallenge[];
  completions: readonly QuestCompletion[];
  totalXp: number;
  unlocks: readonly AchievementUnlock[];
  now: Date;
};

/** Derives everything the UI needs about progress from raw persisted facts. */
export function buildProgressState(input: ProgressInputs): ProgressState {
  const { user, chapters, dailyChallenges, completions, totalXp, unlocks, now } = input;
  const currentDay = getChallengeDay(user.challengeStartDate, now);
  const completedQuestIds = new Set(completions.map((c) => c.questId));
  const completedDaySet = findCompletedDays(dailyChallenges, completions);
  const completedDays: DayNumber[] = [...completedDaySet].sort((a, b) => a - b);

  const questsById = new Map(dailyChallenges.flatMap((plan) => plan.quests).map((q) => [q.id, q]));
  const wordsLearned = completions.reduce(
    (sum, c) =>
      sum + (c.questType === 'vocabulary' ? (questsById.get(c.questId)?.wordCount ?? 0) : 0),
    0,
  );

  const today = dailyChallenges.find((plan) => plan.day === currentDay);
  const todayCompletedQuestIds =
    today?.quests.filter((quest) => completedQuestIds.has(quest.id)).map((quest) => quest.id) ?? [];

  return {
    currentDay,
    chapterId: findChapterForDay(chapters, currentDay).id,
    totalXp: Math.max(0, totalXp),
    level: getLevelInfo(totalXp),
    streak: computeStreak(completedDaySet, currentDay),
    completedDays,
    wordsLearned,
    todayCompletedQuestIds,
    isTodayComplete: today !== undefined && todayCompletedQuestIds.length === today.quests.length,
    hasPerfectQuiz: completions.some((c) => c.totalCount > 0 && c.score === 1),
    unlockedAchievementIds: unlocks.map((u) => u.achievementId),
  };
}
