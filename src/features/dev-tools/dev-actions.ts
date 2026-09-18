import type { QueryClient } from '@tanstack/react-query';

import { CHALLENGE } from '@/constants/challenge';
import { queryKeys } from '@/data/query-keys';
import type { Repositories } from '@/data/repositories/types';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { invalidateProgress } from '@/features/progress/queries';
import {
  completeQuest,
  loadProgressState,
  syncAchievements,
  type QuestOutcome,
} from '@/features/progress/use-cases';
import type { AchievementId, DailyChallenge } from '@/schemas';
import { clamp } from '@/utils/number';

/**
 * Development-only shortcuts. They go through the same repositories and use
 * cases as the real app, so what you simulate is what the app would do.
 */
export type DevContext = {
  repositories: Repositories;
  queryClient: QueryClient;
};

function invalidateAll({ queryClient }: DevContext): void {
  invalidateProgress(queryClient);
  for (const queryKey of [queryKeys.friends.all, queryKeys.challenge.all]) {
    void queryClient.invalidateQueries({ queryKey, refetchType: 'all' });
  }
}

export async function setCurrentDay(ctx: DevContext, day: number): Promise<void> {
  const target = clamp(Math.round(day), 1, CHALLENGE.totalDays);
  await ctx.repositories.user.updateChallengeStartDate(getStartDateForDay(target, new Date()));
  invalidateAll(ctx);
}

export async function shiftCurrentDay(ctx: DevContext, delta: number): Promise<void> {
  const state = await loadProgressState(ctx.repositories);
  await setCurrentDay(ctx, state.currentDay + delta);
}

/** Writes completions straight to the repository — used for bulk simulation. */
async function completeDayDirectly(
  ctx: DevContext,
  plan: DailyChallenge,
  { perfect }: { perfect: boolean },
): Promise<void> {
  const now = new Date();
  const existing = new Set(
    (await ctx.repositories.progress.getCompletionsForDays([plan.day])).map((c) => c.questId),
  );

  for (const quest of plan.quests) {
    if (existing.has(quest.id)) continue;
    const totalCount = 5;
    const correctCount = perfect ? 5 : 4;
    const xpEarned = quest.xpReward + (perfect ? CHALLENGE.perfectScoreBonusXp : 0);
    await ctx.repositories.progress.saveQuestCompletion(
      {
        questId: quest.id,
        day: plan.day,
        questType: quest.type,
        score: correctCount / totalCount,
        correctCount,
        totalCount,
        xpEarned,
        source: 'dev',
        completedAt: now.toISOString(),
      },
      [],
    );
    await ctx.repositories.progress.addXpEvent({
      amount: xpEarned,
      reason: 'quest',
      refId: quest.id,
      createdAt: now.toISOString(),
    });
  }
}

export async function completeNextQuest(
  ctx: DevContext,
  { perfect = false }: { perfect?: boolean } = {},
): Promise<QuestOutcome | null> {
  const state = await loadProgressState(ctx.repositories);
  const plan = await ctx.repositories.challenge.getDailyChallenge(state.currentDay);
  const done = new Set(state.todayCompletedQuestIds);
  const next = plan.quests.find((quest) => !done.has(quest.id));
  if (!next) return null;

  const outcome = await completeQuest(ctx.repositories, {
    questId: next.id,
    correctCount: perfect ? 5 : 4,
    totalCount: 5,
    source: 'dev',
  });
  invalidateAll(ctx);
  return outcome;
}

export async function completeToday(
  ctx: DevContext,
  { perfect = false }: { perfect?: boolean } = {},
): Promise<QuestOutcome | null> {
  let last: QuestOutcome | null = null;
  for (let index = 0; index < 10; index++) {
    const outcome = await completeNextQuest(ctx, { perfect });
    if (!outcome) break;
    last = outcome;
  }
  return last;
}

export async function resetToday(ctx: DevContext): Promise<void> {
  const state = await loadProgressState(ctx.repositories);
  const plan = await ctx.repositories.challenge.getDailyChallenge(state.currentDay);
  await ctx.repositories.progress.deleteCompletions(plan.quests.map((quest) => quest.id));
  invalidateAll(ctx);
}

/** Fills the days before today so the streak becomes exactly `streak` days. */
export async function setStreak(ctx: DevContext, streak: number): Promise<void> {
  const state = await loadProgressState(ctx.repositories);
  const plans = await ctx.repositories.challenge.getDailyChallenges();
  const target = clamp(Math.round(streak), 0, state.currentDay - 1);
  const firstStreakDay = state.currentDay - target;

  const boundary = plans.find((plan) => plan.day === firstStreakDay - 1);
  if (boundary) {
    await ctx.repositories.progress.deleteCompletions(boundary.quests.map((quest) => quest.id));
  }
  for (let day = firstStreakDay; day < state.currentDay; day++) {
    const plan = plans.find((item) => item.day === day);
    if (plan) await completeDayDirectly(ctx, plan, { perfect: false });
  }

  await syncAchievements(ctx.repositories, await loadProgressState(ctx.repositories));
  invalidateAll(ctx);
}

export async function addXp(ctx: DevContext, amount: number): Promise<void> {
  await ctx.repositories.progress.addXpEvent({
    amount: Math.round(amount),
    reason: 'dev',
    refId: null,
    createdAt: new Date().toISOString(),
  });
  await syncAchievements(ctx.repositories, await loadProgressState(ctx.repositories));
  invalidateAll(ctx);
}

export async function setAchievementUnlocked(
  ctx: DevContext,
  id: AchievementId,
  unlocked: boolean,
): Promise<void> {
  if (unlocked) await ctx.repositories.achievements.unlock([id], new Date().toISOString());
  else await ctx.repositories.achievements.lock([id]);
  invalidateAll(ctx);
}

export async function resetAchievements(ctx: DevContext): Promise<void> {
  await ctx.repositories.achievements.resetUnlocks();
  // Take back the XP those achievements granted, otherwise re-unlocking them
  // would award it twice.
  await ctx.repositories.progress.deleteXpEvents('achievement');
  invalidateAll(ctx);
}

/** Jumps to the next weekly exam day and passes it. */
export async function simulateWeeklyExam(ctx: DevContext): Promise<QuestOutcome | null> {
  const state = await loadProgressState(ctx.repositories);
  const interval = CHALLENGE.weeklyExamInterval;
  // Last exam day of the challenge (day 90 is the summit, not an exam).
  const lastExamDay = Math.floor((CHALLENGE.totalDays - 1) / interval) * interval;
  const examDay = Math.min(Math.ceil(state.currentDay / interval) * interval, lastExamDay);
  await setCurrentDay(ctx, examDay);
  return completeToday(ctx, { perfect: true });
}

/** Jumps to Day 90 and finishes the summit. */
export async function simulateSummit(ctx: DevContext): Promise<QuestOutcome | null> {
  await setCurrentDay(ctx, CHALLENGE.totalDays);
  return completeToday(ctx, { perfect: true });
}

export async function resetProgress(ctx: DevContext): Promise<void> {
  await ctx.repositories.progress.resetProgress();
  await ctx.repositories.achievements.resetUnlocks();
  invalidateAll(ctx);
}

export async function resetAllLocalData(ctx: DevContext): Promise<void> {
  await ctx.repositories.dev?.resetAllLocalData();
  await ctx.queryClient.invalidateQueries();
}

export async function clearFriends(ctx: DevContext): Promise<void> {
  await ctx.repositories.dev?.clearFriends();
  invalidateAll(ctx);
}

export async function restoreFriends(ctx: DevContext): Promise<void> {
  await ctx.repositories.dev?.restoreFriends();
  invalidateAll(ctx);
}
