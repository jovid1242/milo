import { CHALLENGE } from '@/constants/challenge';
import type { Repositories } from '@/data/repositories/types';
import { syncAchievements } from '@/features/achievements/use-cases';
import type {
  Achievement,
  AnswerRecord,
  CompletionSource,
  DayCompletion,
  DayNumber,
  ProgressState,
  Quest,
  QuestCompletion,
} from '@/schemas';
import { clamp } from '@/utils/number';

import { buildDayCompletion, findCompletedDays } from './logic/day-completion';
import { buildProgressState } from './logic/progress-state';

/** Reads every fact the progress view needs and derives the current state. */
export async function loadProgressState(
  repositories: Repositories,
  now: Date = new Date(),
): Promise<ProgressState> {
  const [user, chapters, dailyChallenges, completions, totalXp, unlocks, wordsLearned] =
    await Promise.all([
      repositories.user.getUser(),
      repositories.challenge.getChapters(),
      repositories.challenge.getDailyChallenges(),
      repositories.progress.getCompletions(),
      repositories.progress.getTotalXp(),
      repositories.achievements.getUnlocks(),
      repositories.progress.countLearnedWords(),
    ]);
  return buildProgressState({
    user,
    chapters,
    dailyChallenges,
    completions,
    totalXp,
    unlocks,
    wordsLearned,
    now,
  });
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

export type DayCompletionResult = {
  /** The day as first recorded — a repeated call returns the same record. */
  record: DayCompletion;
  /** This call finished the day. */
  isFirstCompletion: boolean;
};

/**
 * Finishes a day once every one of its quests is done — the only place a day
 * becomes complete. Safe to call any number of times (a double tap, a re-render,
 * the quest completion and the "Finish day" button): the first record stays, so
 * the day's XP, streak step and celebration are never counted twice. Returns
 * `null` while any quest of the day is still open; wrong answers never block it.
 */
export async function completeDay(
  repositories: Repositories,
  day: DayNumber,
  now: Date = new Date(),
): Promise<DayCompletionResult | null> {
  const existing = await repositories.progress.getDayCompletion(day);
  if (existing) return { record: existing, isFirstCompletion: false };

  const [plans, completions] = await Promise.all([
    repositories.challenge.getDailyChallenges(),
    repositories.progress.getCompletions(),
  ]);
  const plan = plans.find((item) => item.day === day);
  if (!plan) throw new Error(`Unknown day: ${day}`);

  const record = buildDayCompletion({
    plan,
    completions,
    completedDays: findCompletedDays(plans, completions),
    completedAt: now.toISOString(),
  });
  if (!record) return null;

  if (await repositories.progress.recordDayCompletion(record)) {
    return { record, isFirstCompletion: true };
  }
  // A concurrent call recorded the day first; its record is the truth.
  const stored = await repositories.progress.getDayCompletion(day);
  return stored ? { record: stored, isFirstCompletion: false } : null;
}

/**
 * Claims a finished day's celebration. Only the first claim — ever — gets
 * `true`, so the confetti, sound and streak moment play once, even across
 * restarts.
 */
export async function claimDayCelebration(
  repositories: Repositories,
  day: DayNumber,
  now: Date = new Date(),
): Promise<boolean> {
  return repositories.progress.markDayCelebrated(day, now.toISOString());
}

/**
 * A finished vocabulary quest teaches its words. Stored by word id, so the
 * same word from another lesson (or a replay) is still one word.
 */
async function recordLearnedWords(repositories: Repositories, quest: Quest, at: string) {
  if (quest.type !== 'vocabulary') return;
  const content = await repositories.challenge.getQuestContent(quest.id);
  if (content?.type !== 'vocabulary') return;
  await repositories.progress.recordLearnedWords(
    content.items.map((item) => ({ wordId: item.id, questId: quest.id, learnedAt: at })),
  );
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
  /** This quest finished its day. */
  dayCompleted: boolean;
  /** The day's record once all of its quests are done (also on later replays). */
  dayCompletion: DayCompletion | null;
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
  await recordLearnedWords(repositories, quest, timestamp);
  const day = await completeDay(repositories, quest.day, now);

  // After the quest and the day are stored: the badges see the new progress.
  const after = await loadProgressState(repositories, now);
  const newAchievements = await syncAchievements(repositories, now);
  const progress = newAchievements.length > 0 ? await loadProgressState(repositories, now) : after;

  const dayCompleted = day?.isFirstCompletion ?? false;

  return {
    quest,
    isFirstCompletion,
    xpEarned,
    isPerfect,
    dayCompleted,
    dayCompletion: day?.record ?? null,
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
