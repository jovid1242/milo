import { CHALLENGE } from '@/constants/challenge';
import type { Repositories } from '@/data/repositories/types';
import { findNewlyEarnedAchievements } from '@/features/achievements/logic/evaluate-achievements';
import { computeTeamStreak } from '@/features/friends/logic/team-streak';
import type {
  Achievement,
  AnswerRecord,
  CompletionSource,
  ProgressState,
  Quest,
  QuestCompletion,
} from '@/schemas';
import { clamp } from '@/utils/number';

import { buildProgressState } from './logic/progress-state';

/** Reads every fact the progress view needs and derives the current state. */
export async function loadProgressState(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<ProgressState> {
  const [user, chapters, dailyChallenges, completions, totalXp, unlocks] = await Promise.all([
    repositories.user.getUser(),
    repositories.challenge.getChapters(),
    repositories.challenge.getDailyChallenges(),
    repositories.progress.getCompletions(),
    repositories.progress.getTotalXp(),
    repositories.achievements.getUnlocks(),
  ]);
  return buildProgressState({
    user,
    chapters,
    dailyChallenges,
    completions,
    totalXp,
    unlocks,
    now,
  });
}

/** Unlocks every achievement whose criteria are now met and awards its XP. */
export async function syncAchievements(
  repositories: Repositories,
  state: ProgressState,
  now: Date = new Date(),
): Promise<Achievement[]> {
  const [definitions, friends] = await Promise.all([
    repositories.achievements.getDefinitions(),
    repositories.friends.getFriends(),
  ]);

  const earned = findNewlyEarnedAchievements(
    definitions,
    {
      completedDays: state.completedDays.length,
      streak: state.streak,
      wordsLearned: state.wordsLearned,
      hasPerfectQuiz: state.hasPerfectQuiz,
      teamStreak: computeTeamStreak(state.streak, friends),
    },
    new Set(state.unlockedAchievementIds),
  );
  if (earned.length === 0) return [];

  const timestamp = now.toISOString();
  const unlockedIds = await repositories.achievements.unlock(
    earned.map((achievement) => achievement.id),
    timestamp,
  );
  const unlocked = earned.filter((achievement) => unlockedIds.includes(achievement.id));

  for (const achievement of unlocked) {
    if (achievement.xpReward > 0) {
      await repositories.progress.addXpEvent({
        amount: achievement.xpReward,
        reason: 'achievement',
        refId: achievement.id,
        createdAt: timestamp,
      });
    }
  }
  return unlocked;
}

/**
 * Opens (or re-opens) a quest session, which is what makes a quest "in progress".
 * Finished quests are left alone: replaying one never reopens it.
 */
export async function startQuest(
  repositories: Repositories,
  questId: string,
  now: Date = new Date(),
): Promise<void> {
  const [completions, sessions] = await Promise.all([
    repositories.progress.getCompletions(),
    repositories.progress.getQuestSessions(),
  ]);
  if (completions.some((completion) => completion.questId === questId)) return;

  const existing = sessions.find((session) => session.questId === questId);
  const timestamp = now.toISOString();
  await repositories.progress.saveQuestSession({
    questId,
    startedAt: existing?.startedAt ?? timestamp,
    updatedAt: timestamp,
    progress: existing?.progress ?? 0,
    state: existing?.state ?? null,
  });
}

export type CompleteQuestInput = {
  questId: string;
  correctCount: number;
  totalCount: number;
  answers?: readonly AnswerRecord[];
  source?: CompletionSource;
  now?: Date;
};

/** Everything a reward moment needs to know about a finished quest. */
export type QuestOutcome = {
  quest: Quest;
  isFirstCompletion: boolean;
  xpEarned: number;
  isPerfect: boolean;
  dayCompleted: boolean;
  isSummit: boolean;
  /** Only for weekly exams. */
  examPassed: boolean | null;
  streakBefore: number;
  streakAfter: number;
  levelBefore: number;
  levelAfter: number;
  newAchievements: Achievement[];
  progress: ProgressState;
};

export async function completeQuest(
  repositories: Repositories,
  input: CompleteQuestInput,
): Promise<QuestOutcome> {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();

  const dailyChallenges = await repositories.challenge.getDailyChallenges();
  const dayPlan = dailyChallenges.find((plan) =>
    plan.quests.some((quest) => quest.id === input.questId),
  );
  const quest = dayPlan?.quests.find((item) => item.id === input.questId);
  if (!dayPlan || !quest) throw new Error(`Unknown quest: ${input.questId}`);

  const before = await loadProgressState(repositories, now);

  const totalCount = Math.max(0, Math.round(input.totalCount));
  const correctCount = clamp(Math.round(input.correctCount), 0, totalCount);
  const score = totalCount > 0 ? correctCount / totalCount : 1;
  const isPerfect = totalCount > 0 && correctCount === totalCount;
  const reward = quest.xpReward + (isPerfect ? CHALLENGE.perfectScoreBonusXp : 0);

  const completion: QuestCompletion = {
    questId: quest.id,
    day: quest.day,
    questType: quest.type,
    score,
    correctCount,
    totalCount,
    xpEarned: reward,
    source: input.source ?? 'user',
    completedAt: timestamp,
  };

  // XP is awarded once per quest: a replay changes nothing but closing its
  // session. The repository decides atomically, so a double tap cannot farm XP.
  const isFirstCompletion = await repositories.progress.recordFirstCompletion(
    completion,
    input.answers ?? [],
    reward > 0 ? { amount: reward, reason: 'quest', refId: quest.id, createdAt: timestamp } : null,
  );
  const xpEarned = isFirstCompletion ? reward : 0;

  const after = await loadProgressState(repositories, now);
  const newAchievements = await syncAchievements(repositories, after, now);
  const progress = newAchievements.length > 0 ? await loadProgressState(repositories, now) : after;

  const dayCompleted =
    progress.completedDays.includes(quest.day) && !before.completedDays.includes(quest.day);

  return {
    quest,
    isFirstCompletion,
    xpEarned,
    isPerfect,
    dayCompleted,
    isSummit: dayPlan.kind === 'summit' && dayCompleted,
    examPassed: quest.type === 'weeklyExam' ? score >= CHALLENGE.examPassingScore : null,
    streakBefore: before.streak,
    streakAfter: progress.streak,
    levelBefore: before.level.level,
    levelAfter: progress.level.level,
    newAchievements,
    progress,
  };
}
