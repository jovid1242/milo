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
import {
  INITIAL_PROGRESS,
  reduceVocabulary,
  type VocabularyAction,
} from '@/features/vocabulary/logic/vocabulary-session';
import { completeVocabularyQuest, saveVocabularyProgress } from '@/features/vocabulary/use-cases';
import { questId as questIdFor } from '@/data/content/schedule';
import type { AchievementId, Quest, QuestCompletion, XpEvent } from '@/schemas';
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

function devRepository(ctx: DevContext) {
  if (!ctx.repositories.dev) throw new Error('Dev tools need the local repositories');
  return ctx.repositories.dev;
}

/** Writes finished quests (and their XP) in one transaction — for bulk simulation. */
async function seedCompletedQuests(
  ctx: DevContext,
  quests: readonly Quest[],
  { perfect }: { perfect: boolean },
): Promise<void> {
  const done = new Set((await ctx.repositories.progress.getCompletions()).map((c) => c.questId));
  const timestamp = new Date().toISOString();
  const completions: QuestCompletion[] = [];
  const xpEvents: XpEvent[] = [];

  for (const quest of quests) {
    if (done.has(quest.id)) continue;
    const correctCount = perfect ? 5 : 4;
    const xpEarned = quest.xpReward + (perfect ? CHALLENGE.perfectScoreBonusXp : 0);
    completions.push({
      questId: quest.id,
      day: quest.day,
      questType: quest.type,
      score: correctCount / 5,
      correctCount,
      totalCount: 5,
      xpEarned,
      source: 'dev',
      completedAt: timestamp,
    });
    xpEvents.push({ amount: xpEarned, reason: 'quest', refId: quest.id, createdAt: timestamp });
  }
  await devRepository(ctx).seedHistory(completions, xpEvents);
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

/** Opens the current quest halfway, to see the in-progress state on Home. */
export async function startCurrentQuest(ctx: DevContext, progress = 0.4): Promise<void> {
  const state = await loadProgressState(ctx.repositories);
  const plan = await ctx.repositories.challenge.getDailyChallenge(state.currentDay);
  const done = new Set(state.todayCompletedQuestIds);
  const next = plan.quests.find((quest) => !done.has(quest.id));
  if (!next) return;

  const timestamp = new Date().toISOString();
  await ctx.repositories.progress.saveQuestSession({
    questId: next.id,
    startedAt: timestamp,
    updatedAt: timestamp,
    progress,
    state: null,
  });
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
  const streakQuests = plans
    .filter((plan) => plan.day >= firstStreakDay && plan.day < state.currentDay)
    .flatMap((plan) => plan.quests);
  await seedCompletedQuests(ctx, streakQuests, { perfect: false });

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

/**
 * Ready-made Home states. Each one rebuilds progress from scratch: the day,
 * every earlier day completed except `missedDays`, and part of today.
 */
type HomeScenarioSpec = {
  label: string;
  day: number;
  todayDone: number;
  missedDays?: readonly number[];
  /** Leaves the next quest open halfway (in progress). */
  startNext?: boolean;
};

export const HOME_SCENARIOS = {
  fresh: { label: 'Day 12 · 0/4', day: 12, todayDone: 0 },
  inProgress: { label: 'Day 12 · 2/4', day: 12, todayDone: 2, startNext: true },
  almostDone: { label: 'Day 12 · 3/4', day: 12, todayDone: 3 },
  dayComplete: { label: 'Day 12 · 4/4', day: 12, todayDone: 4 },
  streak0: { label: 'Streak 0', day: 12, todayDone: 0, missedDays: [11] },
  streak12: { label: 'Streak 12', day: 13, todayDone: 0 },
  day1: { label: 'Day 1', day: 1, todayDone: 0 },
  day30: { label: 'Day 30', day: 30, todayDone: 0 },
  day60: { label: 'Day 60', day: 60, todayDone: 0 },
  day89: { label: 'Day 89', day: 89, todayDone: 0 },
  day90: { label: 'Day 90', day: 90, todayDone: 0 },
} as const satisfies Record<string, HomeScenarioSpec>;

export type HomeScenario = keyof typeof HOME_SCENARIOS;

export async function applyHomeScenario(ctx: DevContext, scenario: HomeScenario): Promise<void> {
  const spec: HomeScenarioSpec = HOME_SCENARIOS[scenario];
  const missed = new Set(spec.missedDays ?? []);

  await ctx.repositories.progress.resetProgress();
  await ctx.repositories.achievements.resetUnlocks();
  await ctx.repositories.user.updateChallengeStartDate(getStartDateForDay(spec.day, new Date()));

  const plans = await ctx.repositories.challenge.getDailyChallenges();
  const today = plans.find((plan) => plan.day === spec.day);
  const history = plans
    .filter((plan) => plan.day < spec.day && !missed.has(plan.day))
    .flatMap((plan) => plan.quests);
  await seedCompletedQuests(ctx, [...history, ...(today?.quests.slice(0, spec.todayDone) ?? [])], {
    perfect: false,
  });

  const next = today?.quests[spec.todayDone];
  if (spec.startNext && next) {
    const timestamp = new Date().toISOString();
    await ctx.repositories.progress.saveQuestSession({
      questId: next.id,
      startedAt: timestamp,
      updatedAt: timestamp,
      progress: 0.4,
      state: null,
    });
  }

  await syncAchievements(ctx.repositories, await loadProgressState(ctx.repositories));
  invalidateAll(ctx);
}

/** Quick ways into every state of the Day 89 Vocabulary quest. */
export const VOCABULARY_SCENARIOS = {
  intro: 'Intro',
  word1: 'Learn word 1',
  word6: 'Learn word 6',
  practiceCorrect: 'Practice: correct',
  practiceWrong: 'Practice: wrong',
  result5: 'Result 5/6',
  result6: 'Result 6/6',
  completed: 'Completed quest',
  resume: 'Resume midway',
} as const;

export type VocabularyScenario = keyof typeof VOCABULARY_SCENARIOS;

/**
 * Rebuilds Day 89 (fresh, 88 days walked) and leaves its Vocabulary quest in
 * the chosen state, through the same reducer and use cases as the real flow.
 * Returns the quest id to open.
 */
export async function applyVocabularyScenario(
  ctx: DevContext,
  scenario: VocabularyScenario,
): Promise<string> {
  await applyHomeScenario(ctx, 'day89');
  const id = questIdFor(89, 'vocabulary');
  const content = await ctx.repositories.challenge.getQuestContent(id);
  if (content?.type !== 'vocabulary') throw new Error('Day 89 has no vocabulary content');

  const at = new Date().toISOString();
  const meet: VocabularyAction[] = [{ type: 'reveal' }, { type: 'learned' }];
  const learnAll: VocabularyAction[] = [{ type: 'start' }, ...content.items.flatMap(() => meet)];
  const answer = (index: number, right: boolean): VocabularyAction => {
    const exercise = content.exercises[index];
    const wrong = exercise?.optionItemIds.find((option) => option !== exercise.itemId);
    return { type: 'answer', optionItemId: (right ? exercise?.itemId : wrong) ?? '', at };
  };
  const answerAll = (wrongAt?: number): VocabularyAction[] =>
    content.exercises.flatMap((_, index) => [
      answer(index, index !== wrongAt),
      { type: 'continue' },
    ]);

  const actions: Record<VocabularyScenario, VocabularyAction[]> = {
    intro: [],
    word1: [{ type: 'start' }],
    word6: [{ type: 'start' }, ...content.items.slice(1).flatMap(() => meet)],
    practiceCorrect: [...learnAll, answer(0, true)],
    practiceWrong: [...learnAll, answer(0, false)],
    result5: [...learnAll, ...answerAll(2)],
    result6: [...learnAll, ...answerAll()],
    completed: [...learnAll, ...answerAll(2)],
    resume: [...learnAll, ...answerAll().slice(0, 4)],
  };
  const progress = actions[scenario].reduce(
    (state, action) => reduceVocabulary(content, state, action),
    INITIAL_PROGRESS,
  );

  if (scenario === 'completed') {
    await completeVocabularyQuest(ctx.repositories, { content, progress });
  } else if (scenario !== 'intro') {
    await saveVocabularyProgress(ctx.repositories, { content, progress, startedAt: at });
  }
  invalidateAll(ctx);
  return id;
}

export async function resetProgress(ctx: DevContext): Promise<void> {
  await ctx.repositories.progress.resetProgress();
  await ctx.repositories.achievements.resetUnlocks();
  invalidateAll(ctx);
}

export async function resetAllLocalData(ctx: DevContext): Promise<void> {
  await devRepository(ctx).resetAllLocalData();
  await ctx.queryClient.invalidateQueries();
}

export async function clearFriends(ctx: DevContext): Promise<void> {
  await devRepository(ctx).clearFriends();
  invalidateAll(ctx);
}

export async function restoreFriends(ctx: DevContext): Promise<void> {
  await devRepository(ctx).restoreFriends();
  invalidateAll(ctx);
}
