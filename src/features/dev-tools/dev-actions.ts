import type { QueryClient } from '@tanstack/react-query';

import { CHALLENGE } from '@/constants/challenge';
import { FINAL_CHALLENGE } from '@/data/content/exams/final-challenge';
import { queryKeys } from '@/data/query-keys';
import type { Repositories } from '@/data/repositories/types';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { buildDayCompletion, findCompletedDays } from '@/features/progress/logic/day-completion';
import { invalidateProgress } from '@/features/progress/queries';
import {
  loadPendingCelebrations,
  markCelebrated,
  syncAchievements,
} from '@/features/achievements/use-cases';
import {
  loadExamRun,
  saveExamAttempt,
  startExamAttempt,
  submitExam,
} from '@/features/exams/use-cases';
import { withExamAnswer, withPosition } from '@/features/exams/logic/exam';
import { stepAt } from '@/features/onboarding/logic/onboarding';
import { startChallenge } from '@/features/onboarding/use-cases';
import { claimSummit } from '@/features/summit/use-cases';
import {
  claimDayCelebration,
  completeDay,
  completeQuest,
  loadProgressState,
} from '@/features/progress/use-cases';
import {
  INITIAL_GRAMMAR,
  grammarProgress,
  reduceGrammar,
  type GrammarAction,
} from '@/features/grammar/logic/grammar-session';
import { finishQuestRun, saveQuestRun } from '@/features/quests/use-cases';
import {
  INITIAL_READING,
  readingProgress,
  reduceReading,
  type ReadingAction,
} from '@/features/reading/logic/reading-session';
import { resolveReview, reviewMaterial } from '@/features/review/logic/review-items';
import {
  INITIAL_REVIEW,
  reduceReview,
  reviewProgress,
  type ReviewAction,
} from '@/features/review/logic/review-session';
import {
  INITIAL_PROGRESS,
  progressFraction,
  reduceVocabulary,
  type VocabularyAction,
} from '@/features/vocabulary/logic/vocabulary-session';
import type {
  ChallengeCompletion,
  ChoiceAnswer,
  DayCompletion,
  LearnedWord,
  Quest,
  QuestCompletion,
  QuestContent,
  QuestType,
  Team,
  TeamActivity,
  TeamMember,
  Exam,
  ExamAttempt,
  XpEvent,
} from '@/schemas';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { clamp } from '@/utils/number';

/**
 * Development-only shortcuts. They go through the same repositories and use
 * cases as the real app, so what you simulate is what the app would do.
 */
export type DevContext = {
  repositories: Repositories;
  queryClient: QueryClient;
};

/**
 * Every query, including the ones on screens react-native-screens has frozen
 * behind a modal: `refetchType: 'all'` — the default reaches active observers
 * only, and a frozen screen has none, so it would come back showing the data
 * that was just wiped.
 */
async function refetchEverything({ queryClient }: DevContext): Promise<void> {
  await queryClient.invalidateQueries({ refetchType: 'all' });
}

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

/**
 * Unlocks what the seeded history has earned — silently: simulated history
 * never replays celebrations. Only a real action afterwards gets one.
 */
async function settleAchievements(ctx: DevContext): Promise<void> {
  await syncAchievements(ctx.repositories);
  const pending = await loadPendingCelebrations(ctx.repositories);
  await markCelebrated(
    ctx.repositories,
    pending.map((achievement) => achievement.id),
  );
}

/** Words a seeded vocabulary quest taught: its real words, or stand-ins for unwritten days. */
async function seededWords(ctx: DevContext, quest: Quest, at: string): Promise<LearnedWord[]> {
  if (quest.type !== 'vocabulary') return [];
  const content = await ctx.repositories.challenge.getQuestContent(quest.id);
  const ids =
    content?.type === 'vocabulary'
      ? content.items.map((item) => item.id)
      : Array.from(
          { length: quest.wordCount ?? CHALLENGE.wordsPerVocabularyQuest },
          (_, n) => `${quest.id}-word-${n + 1}`,
        );
  return ids.map((wordId) => ({ wordId, questId: quest.id, learnedAt: at }));
}

/**
 * Writes finished quests (and their XP, words) in one transaction — for bulk
 * simulation. Days they finish get their record too, already celebrated unless
 * `celebrated: false`: simulated history never replays a celebration.
 */
async function seedCompletedQuests(
  ctx: DevContext,
  quests: readonly Quest[],
  { perfect, celebrated = true }: { perfect: boolean; celebrated?: boolean },
): Promise<void> {
  const existing = await ctx.repositories.progress.getCompletions();
  const done = new Set(existing.map((c) => c.questId));
  const timestamp = new Date().toISOString();
  const completions: QuestCompletion[] = [];
  const xpEvents: XpEvent[] = [];
  const words: LearnedWord[] = [];

  for (const quest of quests) {
    if (done.has(quest.id)) continue;
    words.push(...(await seededWords(ctx, quest, timestamp)));
    const correctCount = perfect ? 5 : 4;
    // An exam pays its pass reward only — no perfect bonus, like the real exam.
    const xpEarned =
      quest.type === 'weeklyExam'
        ? quest.xpReward
        : quest.xpReward + (perfect ? CHALLENGE.perfectScoreBonusXp : 0);
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
    // A passed exam pays its reward once per exam — like the real exam flow.
    const examId =
      quest.type === 'finalBattle'
        ? FINAL_CHALLENGE.id
        : quest.type === 'weeklyExam'
          ? `exam-week-${Math.ceil(quest.day / CHALLENGE.weeklyExamInterval)}`
          : null;
    xpEvents.push(
      examId
        ? { amount: xpEarned, reason: 'examPass', refId: examId, createdAt: timestamp }
        : { amount: xpEarned, reason: 'quest', refId: quest.id, createdAt: timestamp },
    );
  }

  // A seeded Final Battle is a reached summit: the challenge record comes with it.
  const final = completions.find((completion) => completion.questType === 'finalBattle');
  const challenge: ChallengeCompletion | null = final
    ? {
        completedAt: timestamp,
        finalAttemptId: `${FINAL_CHALLENGE.id}-seeded`,
        correctCount: final.correctCount,
        totalCount: final.totalCount,
        score: final.score,
        isPerfect: final.correctCount === final.totalCount,
        xpEarned: final.xpEarned,
        celebratedAt: celebrated ? timestamp : null,
      }
    : null;

  const [plans, recorded] = await Promise.all([
    ctx.repositories.challenge.getDailyChallenges(),
    ctx.repositories.progress.getDayCompletions(),
  ]);
  const all = [...existing, ...completions];
  const completedDays = findCompletedDays(plans, all);
  const recordedDays = new Set(recorded.map((record) => record.day));
  const days = plans
    .filter((plan) => completedDays.has(plan.day) && !recordedDays.has(plan.day))
    .map((plan) =>
      buildDayCompletion({
        plan,
        completions: all,
        completedDays,
        completedAt: timestamp,
        celebratedAt: celebrated ? timestamp : null,
      }),
    )
    .filter((record): record is DayCompletion => record !== null);

  await devRepository(ctx).seedHistory(completions, xpEvents, days, words, challenge);
}

/**
 * Puts the profile on `day`. Fixtures always act on a user who is past
 * onboarding: seeding a state must never leave the app showing first launch
 * over a Day 89 history. Production initial state stays untouched — nothing
 * here runs outside the developer tools.
 */
async function startAtDay(ctx: DevContext, day: number): Promise<void> {
  await startChallenge(ctx.repositories, { displayName: 'Explorer', goal: 'habit' });
  await ctx.repositories.user.updateChallengeStartDate(getStartDateForDay(day, new Date()));
}

export async function setCurrentDay(ctx: DevContext, day: number): Promise<void> {
  await startAtDay(ctx, clamp(Math.round(day), 1, CHALLENGE.totalDays));
  invalidateAll(ctx);
}

export async function shiftCurrentDay(ctx: DevContext, delta: number): Promise<void> {
  const state = await loadProgressState(ctx.repositories);
  await setCurrentDay(ctx, state.currentDay + delta);
}

/** Finishes today's next quest; `false` when the day has none left. */
export async function completeNextQuest(
  ctx: DevContext,
  { perfect = false }: { perfect?: boolean } = {},
): Promise<boolean> {
  const state = await loadProgressState(ctx.repositories);
  const plan = await ctx.repositories.challenge.getDailyChallenge(state.currentDay);
  const done = new Set(state.todayCompletedQuestIds);
  const next = plan.quests.find((quest) => !done.has(quest.id));
  if (!next) return false;

  if (next.type === 'weeklyExam') {
    await handInExam(ctx, next, perfect);
  } else {
    await completeQuest(ctx.repositories, {
      questId: next.id,
      correctCount: perfect ? 5 : 4,
      totalCount: 5,
      source: 'dev',
    });
  }
  invalidateAll(ctx);
  return true;
}

export async function completeToday(
  ctx: DevContext,
  { perfect = false }: { perfect?: boolean } = {},
): Promise<void> {
  for (let index = 0; index < 10; index++) {
    if (!(await completeNextQuest(ctx, { perfect }))) break;
  }
}

/**
 * A weekly exam handed in like a real one: an attempt, its answers, the
 * submission (reward, completion, day). Weeks whose exam is not written yet
 * are recorded as passed, the way seeded history is.
 */
async function handInExam(ctx: DevContext, quest: Quest, perfect: boolean): Promise<void> {
  const exam = await ctx.repositories.challenge.getQuestContent(quest.id);
  if (exam?.type !== 'weeklyExam') {
    await seedCompletedQuests(ctx, [quest], { perfect, celebrated: false });
    return;
  }
  const attempt = answerExam(exam, await startExamAttempt(ctx.repositories, quest.id), {
    wrong: perfect ? [] : [1, 8, 13],
  });
  await saveExamAttempt(ctx.repositories, attempt);
  await submitExam(ctx.repositories, attempt.id);
}

/**
 * Answers an open attempt in order: the first `upTo` questions, `wrong` ones
 * with another option, `skip` ones left open; then stands on question `at`.
 */
function answerExam(
  exam: Exam,
  attempt: ExamAttempt,
  {
    upTo = exam.questions.length,
    wrong = [],
    skip = [],
    at = 0,
  }: { upTo?: number; wrong?: readonly number[]; skip?: readonly number[]; at?: number } = {},
): ExamAttempt {
  const now = new Date().toISOString();
  const answered = exam.questions.slice(0, upTo).reduce((current, question, index) => {
    if (skip.includes(index)) return current;
    const option = wrong.includes(index)
      ? question.options.find((item) => item.id !== question.correctOptionId)?.id
      : question.correctOptionId;
    return option ? withExamAnswer(current, question, option, now) : current;
  }, attempt);
  return withPosition(answered, at, exam, now);
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

  await settleAchievements(ctx);
  invalidateAll(ctx);
}

export async function addXp(ctx: DevContext, amount: number): Promise<void> {
  await ctx.repositories.progress.addXpEvent({
    amount: Math.round(amount),
    reason: 'dev',
    refId: null,
    createdAt: new Date().toISOString(),
  });
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
export async function simulateWeeklyExam(ctx: DevContext): Promise<void> {
  const state = await loadProgressState(ctx.repositories);
  const interval = CHALLENGE.weeklyExamInterval;
  // Last exam day of the challenge (day 90 is the summit, not an exam).
  const lastExamDay = Math.floor((CHALLENGE.totalDays - 1) / interval) * interval;
  const examDay = Math.min(Math.ceil(state.currentDay / interval) * interval, lastExamDay);
  await setCurrentDay(ctx, examDay);
  await completeToday(ctx, { perfect: true });
}

/** Jumps to Day 90 and finishes the summit. */
export async function simulateSummit(ctx: DevContext): Promise<void> {
  await setCurrentDay(ctx, CHALLENGE.totalDays);
  await completeToday(ctx, { perfect: true });
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
  await rebuildProgress(ctx, HOME_SCENARIOS[scenario]);
}

/** Journey states across every chapter boundary, plus the end of the challenge. */
export const JOURNEY_SCENARIOS = {
  day1: { label: 'Day 1', day: 1, todayDone: 0 },
  day5: { label: 'Day 5', day: 5, todayDone: 0 },
  day10: { label: 'Day 10', day: 10, todayDone: 0 },
  day11: { label: 'Day 11', day: 11, todayDone: 0 },
  day30: { label: 'Day 30', day: 30, todayDone: 0 },
  day31: { label: 'Day 31', day: 31, todayDone: 0 },
  day60: { label: 'Day 60', day: 60, todayDone: 0 },
  day61: { label: 'Day 61', day: 61, todayDone: 0 },
  day89: { label: 'Day 89', day: 89, todayDone: 0 },
  day89done: { label: 'Day 89 completed', day: 89, todayDone: 4 },
  day90: { label: 'Day 90 available', day: 90, todayDone: 0 },
  complete: { label: '90/90 completed', day: 90, todayDone: 2 },
  missed: { label: 'Day 40 · 3 missed', day: 40, todayDone: 1, missedDays: [12, 25, 33] },
} as const satisfies Record<string, HomeScenarioSpec>;

export type JourneyScenario = keyof typeof JOURNEY_SCENARIOS;

export async function applyJourneyScenario(ctx: DevContext, scenario: JourneyScenario) {
  await rebuildProgress(ctx, JOURNEY_SCENARIOS[scenario]);
}

/**
 * Rebuilds progress from scratch: the day, every earlier day completed except
 * `missedDays`, and part of today.
 */
async function rebuildProgress(ctx: DevContext, spec: HomeScenarioSpec): Promise<void> {
  const missed = new Set(spec.missedDays ?? []);

  await ctx.repositories.progress.resetProgress();
  await ctx.repositories.achievements.resetUnlocks();
  await startAtDay(ctx, spec.day);

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

  await settleAchievements(ctx);
  invalidateAll(ctx);
}

/**
 * Rebuilds Day 89 (88 days walked) and finishes the quests before `type`, so
 * `type` is the current quest on Home. Returns it with its content.
 */
async function prepareDay89Quest(
  ctx: DevContext,
  type: QuestType,
): Promise<{ quest: Quest; content: QuestContent }> {
  await applyHomeScenario(ctx, 'day89');
  const plan = await ctx.repositories.challenge.getDailyChallenge(89);
  const index = plan.quests.findIndex((quest) => quest.type === type);
  const quest = plan.quests[index];
  if (!quest) throw new Error(`Day 89 has no ${type} quest`);
  await seedCompletedQuests(ctx, plan.quests.slice(0, index), { perfect: false });

  const content = await ctx.repositories.challenge.getQuestContent(quest.id);
  if (!content) throw new Error(`Day 89 has no ${type} content`);
  return { quest, content };
}

/** Leaves a quest saved at `state` — or finished with its answers — like a real run would. */
async function storeQuestState(
  ctx: DevContext,
  input: {
    questId: string;
    state: unknown;
    progress: number;
    answers: readonly ChoiceAnswer[];
    exerciseCount: number;
    finished: boolean;
  },
): Promise<void> {
  if (input.finished) {
    await finishQuestRun(ctx.repositories, {
      questId: input.questId,
      answers: input.answers,
      exerciseCount: input.exerciseCount,
    });
  } else {
    await saveQuestRun(ctx.repositories, {
      questId: input.questId,
      startedAt: new Date().toISOString(),
      progress: input.progress,
      state: input.state,
    });
  }
  invalidateAll(ctx);
}

/** Answers exercise `index` right or wrong (the first other option). */
function answerAction(
  exercise: { id: string; correctOptionId: string; optionIds: readonly string[] } | undefined,
  right: boolean,
  at: string,
) {
  const wrong = exercise?.optionIds.find((option) => option !== exercise.correctOptionId);
  return {
    type: 'answer' as const,
    optionId: (right ? exercise?.correctOptionId : wrong) ?? '',
    at,
  };
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

/** Leaves the Day 89 Vocabulary quest in the chosen state; returns the quest id to open. */
export async function applyVocabularyScenario(
  ctx: DevContext,
  scenario: VocabularyScenario,
): Promise<string> {
  const { quest, content } = await prepareDay89Quest(ctx, 'vocabulary');
  if (content.type !== 'vocabulary') throw new Error('Day 89 vocabulary content has another type');

  const at = new Date().toISOString();
  const meet: VocabularyAction[] = [{ type: 'reveal' }, { type: 'learned' }];
  const learnAll: VocabularyAction[] = [{ type: 'start' }, ...content.items.flatMap(() => meet)];
  const answer = (index: number, right: boolean): VocabularyAction => {
    const exercise = content.exercises[index];
    return answerAction(
      exercise && {
        id: exercise.id,
        correctOptionId: exercise.itemId,
        optionIds: exercise.optionItemIds,
      },
      right,
      at,
    );
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
  const state = actions[scenario].reduce(
    (current, action) => reduceVocabulary(content, current, action),
    INITIAL_PROGRESS,
  );

  if (scenario !== 'intro') {
    await storeQuestState(ctx, {
      questId: quest.id,
      state,
      progress: progressFraction(content, state),
      answers: state.answers,
      exerciseCount: content.exercises.length,
      finished: scenario === 'completed',
    });
  } else {
    invalidateAll(ctx);
  }
  return quest.id;
}

/** Quick ways into every state of the Day 89 Grammar quest (Vocabulary already done). */
export const GRAMMAR_SCENARIOS = {
  intro: 'Intro',
  rule: 'Rule',
  example: 'Guided example',
  practice1: 'Practice 1/6',
  correct: 'Answer: correct',
  wrong: 'Answer: wrong',
  practice6: 'Practice 6/6',
  result5: 'Result 5/6',
  result6: 'Result 6/6',
  resume: 'Resume at 3/6',
  completed: 'Completed quest',
} as const;

export type GrammarScenario = keyof typeof GRAMMAR_SCENARIOS;

/** Leaves the Day 89 Grammar quest in the chosen state; returns the quest id to open. */
export async function applyGrammarScenario(
  ctx: DevContext,
  scenario: GrammarScenario,
): Promise<string> {
  const { quest, content } = await prepareDay89Quest(ctx, 'grammar');
  if (content.type !== 'grammar') throw new Error('Day 89 grammar content has another type');

  const at = new Date().toISOString();
  const count = content.exercises.length;
  const learn: GrammarAction[] = [
    { type: 'start' },
    { type: 'ruleLearned' },
    ...content.examples.flatMap((): GrammarAction[] => [
      { type: 'revealExample' },
      { type: 'nextExample' },
    ]),
  ];
  const answer = (index: number, right: boolean): GrammarAction => {
    const exercise = content.exercises[index];
    return answerAction(
      exercise && {
        id: exercise.id,
        correctOptionId: exercise.correctOptionId,
        optionIds: exercise.options.map((option) => option.id),
      },
      right,
      at,
    );
  };
  const answerFirst = (howMany: number, wrongAt?: number): GrammarAction[] =>
    content.exercises
      .slice(0, howMany)
      .flatMap((_, index): GrammarAction[] => [
        answer(index, index !== wrongAt),
        { type: 'continue' },
      ]);

  const actions: Record<GrammarScenario, GrammarAction[]> = {
    intro: [],
    rule: [{ type: 'start' }],
    example: [{ type: 'start' }, { type: 'ruleLearned' }],
    practice1: learn,
    correct: [...learn, answer(0, true)],
    wrong: [...learn, answer(0, false)],
    practice6: [...learn, ...answerFirst(count - 1)],
    result5: [...learn, ...answerFirst(count, 1)],
    result6: [...learn, ...answerFirst(count)],
    resume: [...learn, ...answerFirst(2)],
    completed: [...learn, ...answerFirst(count, 1)],
  };
  const state = actions[scenario].reduce(
    (current, action) => reduceGrammar(content, current, action),
    INITIAL_GRAMMAR,
  );

  if (scenario !== 'intro') {
    await storeQuestState(ctx, {
      questId: quest.id,
      state,
      progress: grammarProgress(content, state),
      answers: state.answers,
      exerciseCount: count,
      finished: scenario === 'completed',
    });
  } else {
    invalidateAll(ctx);
  }
  return quest.id;
}

/** Quick ways into every state of the Day 89 Reading quest (Vocabulary and Grammar done). */
export const READING_SCENARIOS = {
  intro: 'Intro',
  storyStart: 'Story: beginning',
  storyEnd: 'Story: end',
  word: 'Word card',
  question1: 'Question 1/4',
  question4: 'Question 4/4',
  correct: 'Answer: correct',
  wrong: 'Answer: wrong',
  result3: 'Result 3/4',
  result4: 'Result 4/4',
  resume: 'Resume questions',
  completed: 'Completed quest',
} as const;

export type ReadingScenario = keyof typeof READING_SCENARIOS;

/**
 * Leaves the Day 89 Reading quest in the chosen state. Returns the quest id to
 * open, and a word to show straight away for the word-card state.
 */
export async function applyReadingScenario(
  ctx: DevContext,
  scenario: ReadingScenario,
): Promise<{ questId: string; devWord?: string }> {
  const { quest, content } = await prepareDay89Quest(ctx, 'reading');
  if (content.type !== 'reading') throw new Error('Day 89 reading content has another type');

  const at = new Date().toISOString();
  const count = content.questions.length;
  const lastParagraph = content.story.paragraphs.length - 1;
  const word =
    content.story.words.find((item) => item.id === 'gradually') ?? content.story.words[0];
  const wordParagraph = Math.max(
    0,
    content.story.paragraphs.findIndex((paragraph) => paragraph.id === word?.paragraphId),
  );
  const answer = (index: number, right: boolean): ReadingAction => {
    const question = content.questions[index];
    return answerAction(
      question && {
        id: question.id,
        correctOptionId: question.correctOptionId,
        optionIds: question.options.map((option) => option.id),
      },
      right,
      at,
    );
  };
  const read: ReadingAction[] = [{ type: 'start' }, { type: 'finishReading' }];
  const answerFirst = (howMany: number, wrongAt?: number): ReadingAction[] =>
    content.questions
      .slice(0, howMany)
      .flatMap((_, index): ReadingAction[] => [
        answer(index, index !== wrongAt),
        { type: 'continue' },
      ]);

  const actions: Record<ReadingScenario, ReadingAction[]> = {
    intro: [],
    storyStart: [{ type: 'start' }],
    storyEnd: [
      { type: 'start' },
      { type: 'readTo', paragraphIndex: lastParagraph },
      { type: 'reachEnd' },
    ],
    word: [{ type: 'start' }, { type: 'readTo', paragraphIndex: wordParagraph }],
    question1: read,
    question4: [...read, ...answerFirst(count - 1)],
    correct: [...read, answer(0, true)],
    wrong: [...read, answer(0, false)],
    result3: [...read, ...answerFirst(count, 2)],
    result4: [...read, ...answerFirst(count)],
    resume: [
      ...read,
      answer(0, true),
      { type: 'continue' },
      answer(1, false),
      { type: 'continue' },
    ],
    completed: [...read, ...answerFirst(count, 2)],
  };
  const state = actions[scenario].reduce(
    (current, action) => reduceReading(content, current, action),
    INITIAL_READING,
  );

  if (scenario !== 'intro') {
    await storeQuestState(ctx, {
      questId: quest.id,
      state,
      progress: readingProgress(content, state),
      answers: state.answers,
      exerciseCount: count,
      finished: scenario === 'completed',
    });
  } else {
    invalidateAll(ctx);
  }
  return { questId: quest.id, devWord: scenario === 'word' ? word?.id : undefined };
}

/** Quick ways into every state of the Day 89 Review quest (the other three quests done). */
export const REVIEW_SCENARIOS = {
  intro: 'Intro',
  question1: 'Question 1/8',
  question8: 'Question 8/8',
  correct: 'Answer: correct',
  wrong: 'Answer: wrong',
  result7: 'Result 7/8',
  result8: 'Perfect 8/8',
  resume: 'Resume at 5/8',
  completed: 'Completed quest',
} as const;

export type ReviewScenario = keyof typeof REVIEW_SCENARIOS;

/** Leaves the Day 89 Review quest in the chosen state; returns the quest id to open. */
export async function applyReviewScenario(
  ctx: DevContext,
  scenario: ReviewScenario,
): Promise<string> {
  const { quest, content } = await prepareDay89Quest(ctx, 'review');
  if (content.type !== 'review') throw new Error('Day 89 review content has another type');
  const sources = await Promise.all(
    Object.values(content.sources).map((id) =>
      id ? ctx.repositories.challenge.getQuestContent(id) : null,
    ),
  );
  const items = resolveReview(
    content,
    reviewMaterial(
      content,
      sources.filter((item): item is QuestContent => item !== null),
    ),
  );

  const at = new Date().toISOString();
  const count = items.length;
  const answer = (index: number, right: boolean): ReviewAction => {
    const item = items[index];
    return answerAction(item?.choice, right, at);
  };
  const answerFirst = (howMany: number, wrongAt?: number): ReviewAction[] =>
    items
      .slice(0, howMany)
      .flatMap((_, index): ReviewAction[] => [
        answer(index, index !== wrongAt),
        { type: 'continue' },
      ]);
  const start: ReviewAction[] = [{ type: 'start' }];

  const actions: Record<ReviewScenario, ReviewAction[]> = {
    intro: [],
    question1: start,
    question8: [...start, ...answerFirst(count - 1)],
    correct: [...start, answer(0, true)],
    wrong: [...start, answer(0, false)],
    result7: [...start, ...answerFirst(count, 3)],
    result8: [...start, ...answerFirst(count)],
    resume: [...start, ...answerFirst(4, 1)],
    completed: [...start, ...answerFirst(count, 3)],
  };
  const state = actions[scenario].reduce(
    (current, action) => reduceReview(items, current, action),
    INITIAL_REVIEW,
  );

  if (scenario !== 'intro') {
    await storeQuestState(ctx, {
      questId: quest.id,
      state,
      progress: reviewProgress(items, state),
      answers: state.answers,
      exerciseCount: count,
      finished: scenario === 'completed',
    });
  } else {
    invalidateAll(ctx);
  }
  return quest.id;
}

/** Day 89 around its completion: Home states and the Day Complete screen. */
export const DAY_SCENARIOS = {
  threeOfFour: { label: 'Home · 3/4', open: 'home' },
  fourOfFour: { label: 'Home · 4/4 done', open: 'home' },
  firstTime: { label: 'Day Complete · first time', open: 'summary' },
  reopen: { label: 'Day Complete · reopened', open: 'summary' },
  perfect: { label: 'Perfect day', open: 'summary' },
  notPerfect: { label: 'Non-perfect day', open: 'summary' },
} as const satisfies Record<string, { label: string; open: 'home' | 'summary' }>;

export type DayScenario = keyof typeof DAY_SCENARIOS;

/** Rebuilds Day 89 in the chosen state; returns the day to open for the summary states. */
export async function applyDayScenario(ctx: DevContext, scenario: DayScenario): Promise<number> {
  await applyHomeScenario(ctx, 'day89');
  const plan = await ctx.repositories.challenge.getDailyChallenge(89);
  if (scenario === 'threeOfFour') {
    await seedCompletedQuests(ctx, plan.quests.slice(0, -1), { perfect: false });
  } else {
    await seedCompletedQuests(ctx, plan.quests, {
      perfect: scenario === 'perfect',
      // Not celebrated yet: the summary plays its moment. Reopened / Home: already seen.
      celebrated: scenario === 'fourOfFour' || scenario === 'reopen',
    });
  }
  await settleAchievements(ctx);
  invalidateAll(ctx);
  return plan.day;
}

/**
 * The idempotency check, end to end: finishes the Day 89 Review twice at once
 * (a double tap), then finishes the day twice at once and once more. Reports
 * what each call did — XP must grow by the review's reward once, the day must be
 * recorded once, the streak must step up by one.
 */
export async function finishDayTwice(ctx: DevContext): Promise<string> {
  const { quest } = await prepareDay89Quest(ctx, 'review');
  const before = await loadProgressState(ctx.repositories);
  const answers: ChoiceAnswer[] = [];
  const [first, second] = await Promise.all([
    finishQuestRun(ctx.repositories, { questId: quest.id, answers, exerciseCount: 8 }),
    finishQuestRun(ctx.repositories, { questId: quest.id, answers, exerciseCount: 8 }),
  ]);
  const days = await Promise.all([
    completeDay(ctx.repositories, 89),
    completeDay(ctx.repositories, 89),
  ]);
  const again = await completeDay(ctx.repositories, 89);
  const after = await loadProgressState(ctx.repositories);
  const records = (await ctx.repositories.progress.getDayCompletions()).filter(
    (record) => record.day === 89,
  );
  invalidateAll(ctx);

  return [
    `Review completions: ${[first, second].filter((o) => o.isFirstCompletion).length} of 2 were first`,
    `XP: ${before.totalXp} → ${after.totalXp} (+${after.totalXp - before.totalXp})`,
    `Day recorded by the quest: ${first.dayCompleted || second.dayCompleted ? 'yes' : 'no'}`,
    `completeDay ×3: first completions ${[...days, again].filter((d) => d?.isFirstCompletion).length}`,
    `Day 89 records: ${records.length} · XP ${records[0]?.xpEarned ?? '–'}`,
    `Streak: ${before.streak} → ${after.streak}`,
  ].join('\n');
}

const EXAM_DAY = 84;

type ExamOpen = 'journey' | 'exam' | 'question' | 'review';

/** Day 84's weekly exam in every state — reached through the real exam use cases. */
export const EXAM_SCENARIOS = {
  locked: { label: 'Locked · warm-up open', open: 'journey' },
  available: { label: 'Available', open: 'journey' },
  intro: { label: 'Intro', open: 'exam' },
  question1: { label: 'Question 1/15', open: 'question' },
  question8: { label: 'Question 8/15', open: 'question' },
  unanswered: { label: 'Last question · 2 unanswered', open: 'question' },
  resume: { label: 'Resume at 8/15', open: 'exam' },
  result60: { label: 'Result 9/15 · 60%', open: 'exam' },
  result67: { label: 'Result 10/15 · 67%', open: 'exam' },
  result73: { label: 'Result 11/15 · 73%', open: 'exam' },
  result80: { label: 'Result 12/15 · 80%', open: 'exam' },
  result100: { label: 'Perfect 15/15', open: 'exam' },
  review: { label: 'Mistake review', open: 'review' },
  retake: { label: 'Retake · attempt 2', open: 'question' },
  passed: { label: 'Already passed', open: 'exam' },
} as const satisfies Record<string, { label: string; open: ExamOpen }>;

export type ExamScenario = keyof typeof EXAM_SCENARIOS;

/** Which questions a result scenario misses — spread over the three sections. */
const EXAM_MISSES = {
  result60: [1, 3, 6, 8, 11, 13],
  result67: [1, 6, 8, 11, 13],
  result73: [1, 6, 11, 13],
  result80: [1, 8, 13],
  result100: [],
} as const;

/** Day 84 (83 days walked); `warmUp` also finishes the day's quests before the exam. */
async function prepareExamDay(ctx: DevContext, { warmUp }: { warmUp: boolean }) {
  await rebuildProgress(ctx, { label: 'Day 84', day: EXAM_DAY, todayDone: warmUp ? 2 : 0 });
  const plan = await ctx.repositories.challenge.getDailyChallenge(EXAM_DAY);
  const quest = plan.quests.find((item) => item.type === 'weeklyExam');
  const exam = quest ? await ctx.repositories.challenge.getQuestContent(quest.id) : null;
  if (!quest || exam?.type !== 'weeklyExam') throw new Error('Day 84 has no weekly exam');
  return { quest, exam };
}

/** Hands an attempt in; its day was lived before, so its celebration is not replayed. */
async function submitSettled(ctx: DevContext, attempt: ExamAttempt) {
  await saveExamAttempt(ctx.repositories, attempt);
  await submitExam(ctx.repositories, attempt.id);
  await claimDayCelebration(ctx.repositories, EXAM_DAY);
  await settleAchievements(ctx);
}

/** Leaves the Day 84 exam in the chosen state; returns the quest to open and where. */
export async function applyExamScenario(
  ctx: DevContext,
  scenario: ExamScenario,
): Promise<{ questId: string; open: ExamOpen }> {
  const { quest, exam } = await prepareExamDay(ctx, { warmUp: scenario !== 'locked' });
  const start = () => startExamAttempt(ctx.repositories, quest.id);

  switch (scenario) {
    case 'locked':
    case 'available':
    case 'intro':
      break;
    case 'question1':
      await start();
      break;
    case 'question8':
    case 'resume':
      await saveExamAttempt(
        ctx.repositories,
        answerExam(exam, await start(), { upTo: 7, wrong: [2], at: 7 }),
      );
      break;
    case 'unanswered':
      await saveExamAttempt(
        ctx.repositories,
        answerExam(exam, await start(), { skip: [4, 10], at: exam.questions.length - 1 }),
      );
      break;
    case 'result60':
    case 'result67':
    case 'result73':
    case 'result80':
    case 'result100':
      await submitSettled(ctx, answerExam(exam, await start(), { wrong: EXAM_MISSES[scenario] }));
      break;
    case 'review':
    case 'retake':
      await submitSettled(ctx, answerExam(exam, await start(), { wrong: EXAM_MISSES.result60 }));
      if (scenario === 'retake') await start();
      break;
    case 'passed':
      await submitSettled(ctx, answerExam(exam, await start(), { wrong: EXAM_MISSES.result80 }));
      break;
  }
  invalidateAll(ctx);
  return { questId: quest.id, open: EXAM_SCENARIOS[scenario].open };
}

/**
 * The exam's idempotency, end to end: hands the same attempt in twice at once
 * (a double tap), then once more (a reload). The reward must be paid once, the
 * day recorded once, the streak stepped up by one.
 */
export async function submitExamTwice(ctx: DevContext): Promise<string> {
  const { quest, exam } = await prepareExamDay(ctx, { warmUp: true });
  const before = await loadProgressState(ctx.repositories);
  const attempt = answerExam(exam, await startExamAttempt(ctx.repositories, quest.id), {
    wrong: EXAM_MISSES.result80,
  });
  await saveExamAttempt(ctx.repositories, attempt);
  const submissions = await Promise.all([
    submitExam(ctx.repositories, attempt.id),
    submitExam(ctx.repositories, attempt.id),
  ]);
  submissions.push(await submitExam(ctx.repositories, attempt.id));
  const after = await loadProgressState(ctx.repositories);
  const run = await loadExamRun(ctx.repositories, quest.id);
  const records = (await ctx.repositories.progress.getDayCompletions()).filter(
    (record) => record.day === EXAM_DAY,
  );
  invalidateAll(ctx);

  return [
    `Submissions: ${submissions.filter((item) => item.isFirstSubmission).length} of 3 were first`,
    `Pass reward paid: ${submissions.filter((item) => item.rewardGranted).length}×`,
    `XP: ${before.totalXp} → ${after.totalXp} (+${after.totalXp - before.totalXp})`,
    `Attempts: ${run.attempts.length} · ${run.status}`,
    `Day ${EXAM_DAY} records: ${records.length}`,
    `Streak: ${before.streak} → ${after.streak}`,
  ].join('\n');
}

type FinalOpen = 'journey' | 'exam' | 'question' | 'summit' | 'home';

/**
 * Day 90's Final Battle in every state, through the real exam use cases. The
 * "ready" states stand on the last question, fully answered — tap Finish to
 * go through the real submission, the resolve and the Summit Victory.
 */
export const FINAL_SCENARIOS = {
  locked: { label: 'Day 90 locked', open: 'journey' },
  available: { label: 'Day 90 available', open: 'journey' },
  intro: { label: 'Summit intro', open: 'exam' },
  question1: { label: 'Question 1/20', open: 'question' },
  question20: { label: 'Question 20/20', open: 'question' },
  resume: { label: 'Resume at 13/20', open: 'exam' },
  unanswered: { label: 'Last question · 2 unanswered', open: 'question' },
  result60: { label: 'Result 12/20 · 60%', open: 'exam' },
  failed: { label: 'Failed result 13/20', open: 'exam' },
  ready70: { label: '14/20 · 70% → submit', open: 'question' },
  ready85: { label: '17/20 · 85% → submit', open: 'question' },
  ready100: { label: '20/20 → submit', open: 'question' },
  passed: { label: 'Passed (reopened)', open: 'exam' },
  perfect: { label: 'Perfect · victory', open: 'summit' },
  completion: { label: 'Final completion · victory', open: 'summit' },
  reopened: { label: '90/90 reopened', open: 'home' },
} as const satisfies Record<string, { label: string; open: FinalOpen }>;

export type FinalScenario = keyof typeof FINAL_SCENARIOS;

/** Which questions a Final Battle scenario misses — across all three sections. */
const FINAL_MISSES = {
  eight: [1, 4, 7, 9, 12, 14, 16, 18],
  seven: [1, 4, 7, 9, 12, 16, 18],
  six: [1, 4, 9, 12, 16, 18],
  three: [4, 12, 18],
} as const;

/** Leaves Day 90 in the chosen state; returns the quest to open and where. */
export async function applyFinalScenario(
  ctx: DevContext,
  scenario: FinalScenario,
): Promise<{ questId: string; open: FinalOpen }> {
  const plan = await ctx.repositories.challenge.getDailyChallenge(CHALLENGE.totalDays);
  const quest = plan.quests.find((item) => item.type === 'finalBattle');
  const exam = quest ? await ctx.repositories.challenge.getQuestContent(quest.id) : null;
  if (!quest || exam?.type !== 'finalBattle') throw new Error('Day 90 has no Final Battle');
  const done = { questId: quest.id, open: FINAL_SCENARIOS[scenario].open };

  if (scenario === 'locked') {
    // Day 89 under way: the summit is still tomorrow.
    await rebuildProgress(ctx, { label: 'Day 89', day: 89, todayDone: 2 });
    return done;
  }
  await rebuildProgress(ctx, { label: 'Day 90', day: CHALLENGE.totalDays, todayDone: 0 });
  const start = () => startExamAttempt(ctx.repositories, quest.id);
  const last = exam.questions.length - 1;
  const save = async (attempt: ExamAttempt) => saveExamAttempt(ctx.repositories, attempt);
  const submit = async (wrong: readonly number[], { claim }: { claim: boolean }) => {
    const attempt = answerExam(exam, await start(), { wrong });
    await save(attempt);
    await submitExam(ctx.repositories, attempt.id);
    // Unclaimed, the victory plays next — with the badges it unlocked, as in the real flow.
    if (claim) await claimSummit(ctx.repositories);
  };

  switch (scenario) {
    case 'available':
    case 'intro':
      break;
    case 'question1':
      await start();
      break;
    case 'question20':
      await save(answerExam(exam, await start(), { upTo: last, at: last }));
      break;
    case 'resume':
      await save(answerExam(exam, await start(), { upTo: 12, wrong: [3], at: 12 }));
      break;
    case 'unanswered':
      await save(answerExam(exam, await start(), { skip: [6, 15], at: last }));
      break;
    case 'result60':
      await submit(FINAL_MISSES.eight, { claim: false });
      break;
    case 'failed':
      await submit(FINAL_MISSES.seven, { claim: false });
      break;
    case 'ready70':
      await save(answerExam(exam, await start(), { wrong: FINAL_MISSES.six, at: last }));
      break;
    case 'ready85':
      await save(answerExam(exam, await start(), { wrong: FINAL_MISSES.three, at: last }));
      break;
    case 'ready100':
      await save(answerExam(exam, await start(), { at: last }));
      break;
    case 'passed':
    case 'reopened':
      await submit(FINAL_MISSES.three, { claim: true });
      break;
    case 'perfect':
      await submit([], { claim: false });
      break;
    case 'completion':
      await submit(FINAL_MISSES.three, { claim: false });
      break;
  }
  invalidateAll(ctx);
  return done;
}

/**
 * Badge states, reached through real progress: the history before is seeded
 * (its badges settled silently), the step that matters is played through the
 * real completion use case — so its unlock, XP and celebration are the real ones.
 */
export const ACHIEVEMENT_SCENARIOS = {
  none: { label: '0/12', open: 'achievements' },
  firstDay: { label: 'First Day unlock', open: 'home' },
  days3: { label: '3-day unlock', open: 'home' },
  days7: { label: '7-day unlock', open: 'home' },
  streak30: { label: '30-day progress', open: 'achievements' },
  words99: { label: '99/100 words', open: 'achievements' },
  words100: { label: '100 words unlock', open: 'home' },
  words499: { label: '499/500 words', open: 'achievements' },
  words500: { label: '500 words unlock', open: 'home' },
  perfectQuiz: { label: 'Perfect Quiz', open: 'home' },
  perfectWeek: { label: 'Perfect Week', open: 'home' },
  multiple: { label: 'Multiple unlocks', open: 'home' },
  reload: { label: 'Unlocked · reload', open: 'achievements' },
  teamStreak: { label: 'Team Streak unavailable', open: 'achievements' },
} as const satisfies Record<string, { label: string; open: 'home' | 'achievements' }>;

export type AchievementScenario = keyof typeof ACHIEVEMENT_SCENARIOS;

async function freshStart(ctx: DevContext, day: number): Promise<void> {
  await ctx.repositories.progress.resetProgress();
  await ctx.repositories.achievements.resetUnlocks();
  await startAtDay(ctx, day);
}

/** Days before `day` completed; from `perfectFrom` on, without a mistake. */
async function seedDaysBefore(ctx: DevContext, day: number, perfectFrom?: number): Promise<void> {
  const plans = await ctx.repositories.challenge.getDailyChallenges();
  const before = plans.filter((plan) => plan.day < day);
  const isPerfect = (planDay: number) => perfectFrom !== undefined && planDay >= perfectFrom;
  await seedCompletedQuests(
    ctx,
    before.filter((plan) => !isPerfect(plan.day)).flatMap((plan) => plan.quests),
    { perfect: false },
  );
  await seedCompletedQuests(
    ctx,
    before.filter((plan) => isPerfect(plan.day)).flatMap((plan) => plan.quests),
    { perfect: true },
  );
}

/** Stand-in words (a dev shortcut for "learned in earlier lessons"). */
async function seedWords(ctx: DevContext, count: number): Promise<void> {
  const learnedAt = new Date().toISOString();
  await ctx.repositories.progress.recordLearnedWords(
    Array.from({ length: count }, (_, index) => ({
      wordId: `dev-word-${index + 1}`,
      questId: 'dev-seed',
      learnedAt,
    })),
  );
}

/** Finishes quests through the real use case: XP, words, the day and badges, as in the app. */
async function playQuests(
  ctx: DevContext,
  day: number,
  { perfect, only }: { perfect: boolean; only?: QuestType },
): Promise<void> {
  const plan = await ctx.repositories.challenge.getDailyChallenge(day);
  for (const quest of plan.quests) {
    if (only && quest.type !== only) continue;
    await completeQuest(ctx.repositories, {
      questId: quest.id,
      correctCount: perfect ? 6 : 5,
      totalCount: 6,
      source: 'dev',
    });
  }
}

export async function applyAchievementScenario(
  ctx: DevContext,
  scenario: AchievementScenario,
): Promise<void> {
  switch (scenario) {
    case 'none':
      await freshStart(ctx, 1);
      break;
    case 'firstDay':
      await freshStart(ctx, 1);
      await playQuests(ctx, 1, { perfect: false });
      break;
    case 'days3':
    case 'days7': {
      const day = scenario === 'days3' ? 3 : 7;
      await freshStart(ctx, day);
      await seedDaysBefore(ctx, day);
      await settleAchievements(ctx);
      await playQuests(ctx, day, { perfect: false });
      break;
    }
    case 'streak30':
      await freshStart(ctx, 19);
      await seedDaysBefore(ctx, 19);
      await settleAchievements(ctx);
      break;
    case 'words99':
    case 'words499':
      await freshStart(ctx, 1);
      await seedWords(ctx, scenario === 'words99' ? 99 : 499);
      await settleAchievements(ctx);
      break;
    case 'words100':
    case 'words500':
      // The last 6 words come from a real lesson: Day 1's vocabulary quest.
      await freshStart(ctx, 1);
      await seedWords(ctx, scenario === 'words100' ? 94 : 494);
      await settleAchievements(ctx);
      await playQuests(ctx, 1, { perfect: false, only: 'vocabulary' });
      break;
    case 'perfectQuiz':
      await freshStart(ctx, 1);
      await playQuests(ctx, 1, { perfect: true, only: 'vocabulary' });
      break;
    case 'perfectWeek':
      // Days 14–19 perfect, then a perfect Day 20: seven in a row.
      await freshStart(ctx, 20);
      await seedDaysBefore(ctx, 20, 14);
      await settleAchievements(ctx);
      await playQuests(ctx, 20, { perfect: true });
      break;
    case 'multiple':
      // Nothing settled: one perfect Day 7 unlocks a whole row of badges at once.
      await freshStart(ctx, 7);
      await seedDaysBefore(ctx, 7, 1);
      await playQuests(ctx, 7, { perfect: true });
      break;
    case 'reload':
    case 'teamStreak':
      await freshStart(ctx, 30);
      await seedDaysBefore(ctx, 30);
      await settleAchievements(ctx);
      break;
  }
  invalidateAll(ctx);
}

export async function resetProgress(ctx: DevContext): Promise<void> {
  await ctx.repositories.progress.resetProgress();
  await ctx.repositories.achievements.resetUnlocks();
  invalidateAll(ctx);
}

export async function resetAllLocalData(ctx: DevContext): Promise<void> {
  await devRepository(ctx).resetAllLocalData();
  // A wiped device is a first launch: the draft would otherwise survive it.
  useOnboardingStore.getState().clear();
  await refetchEverything(ctx);
}

/** Onboarding again, with the progress that is already there left alone. */
export async function resetOnboarding(ctx: DevContext): Promise<void> {
  await devRepository(ctx).resetOnboarding();
  useOnboardingStore.getState().clear();
  await refetchEverything(ctx);
}

/**
 * Onboarding reopened at one step, with the answers it needs to get there —
 * the routing guard does the navigating once the profile looks new again.
 */
export async function openOnboardingStep(ctx: DevContext, position: number): Promise<void> {
  const step = stepAt(position);
  useOnboardingStore.setState({
    step,
    name: step === 'name' ? 'Explorer' : '',
    goal: step === 'name' ? 'habit' : null,
  });
  await devRepository(ctx).resetOnboarding();
  await refetchEverything(ctx);
}

/** The first launch a new user gets, taken through in one tap: empty, Day 1. */
export async function startFreshDayOne(ctx: DevContext): Promise<void> {
  await devRepository(ctx).resetAllLocalData();
  useOnboardingStore.getState().clear();
  await startChallenge(ctx.repositories, { displayName: 'Explorer', goal: 'habit' });
  await refetchEverything(ctx);
}

/** Two neutral demo teammates: a local stand-in for what a server would send. */
const DEMO_FRIENDS = [
  { id: 'friend-alex', displayName: 'Alex', xpPerDay: 72, badges: 7 },
  { id: 'friend-mia', displayName: 'Mia', xpPerDay: 68, badges: 6 },
] as const;

const TEAM_DAY = 89;

type TeamScenarioSpec = {
  label: string;
  /** `false`: no team at all. */
  team: boolean;
  /** How many demo friends are in it (0 = only you). */
  friends: 0 | 1 | 2;
  /** Your quests done today (4 = your day is finished). */
  youToday: number;
  /** Each friend's quests today. */
  friendsToday: readonly number[];
  /** Days in a row, before today, that everyone finished. */
  teamStreak: number;
  /** Mia shares only what the team challenge needs. */
  missingStats?: boolean;
  /** Play your last quest through the real use case (badges, Day Complete). */
  finishYourDay?: boolean;
};

export const TEAM_SCENARIOS = {
  noTeam: {
    label: 'No team',
    team: false,
    friends: 0,
    youToday: 2,
    friendsToday: [],
    teamStreak: 0,
  },
  oneMember: {
    label: '1 member',
    team: true,
    friends: 0,
    youToday: 2,
    friendsToday: [],
    teamStreak: 0,
  },
  twoMembers: {
    label: '2 members',
    team: true,
    friends: 1,
    youToday: 2,
    friendsToday: [4],
    teamStreak: 12,
  },
  threeMembers: {
    label: '3 members',
    team: true,
    friends: 2,
    youToday: 2,
    friendsToday: [4, 1],
    teamStreak: 12,
  },
  today0: {
    label: '0/3 today',
    team: true,
    friends: 2,
    youToday: 0,
    friendsToday: [0, 0],
    teamStreak: 12,
  },
  today1: {
    label: '1/3 today',
    team: true,
    friends: 2,
    youToday: 3,
    friendsToday: [4, 1],
    teamStreak: 12,
  },
  today2: {
    label: '2/3 today',
    team: true,
    friends: 2,
    youToday: 3,
    friendsToday: [4, 4],
    teamStreak: 12,
  },
  today3: {
    label: '3/3 today',
    team: true,
    friends: 2,
    youToday: 4,
    friendsToday: [4, 4],
    teamStreak: 12,
  },
  streak0: {
    label: 'Team streak 0',
    team: true,
    friends: 2,
    youToday: 1,
    friendsToday: [2, 0],
    teamStreak: 0,
  },
  streak6: {
    label: 'Team streak 6',
    team: true,
    friends: 2,
    youToday: 3,
    friendsToday: [4, 4],
    teamStreak: 6,
  },
  streak7: {
    label: 'Team streak 7',
    team: true,
    friends: 2,
    youToday: 1,
    friendsToday: [1, 2],
    teamStreak: 7,
  },
  streakUnlock: {
    label: 'Team Streak unlock',
    team: true,
    friends: 2,
    youToday: 3,
    friendsToday: [4, 4],
    teamStreak: 6,
    finishYourDay: true,
  },
  missingStats: {
    label: 'Missing stats',
    team: true,
    friends: 2,
    youToday: 2,
    friendsToday: [3, 0],
    teamStreak: 12,
    missingStats: true,
  },
} as const satisfies Record<string, TeamScenarioSpec>;

export type TeamScenario = keyof typeof TEAM_SCENARIOS;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function demoTeam(): Team {
  return {
    id: 'team-demo',
    name: 'Our team',
    inviteCode: 'MILO-7K2P',
    createdAt: minutesAgo(60 * 24 * 30),
  };
}

/**
 * A demo friend on Day 89. They share their whole history (every day before
 * today), and joined the team `teamStreak` days ago — so the team streak is
 * exactly that long, and no older run can unlock the Team Streak badge early.
 */
function demoFriend(
  index: number,
  spec: Pick<TeamScenarioSpec, 'teamStreak' | 'missingStats'>,
  todayQuests: number,
  questCount: number,
): TeamMember {
  const friend = DEMO_FRIENDS[index] ?? DEMO_FRIENDS[0];
  const completedDays = Array.from({ length: TEAM_DAY - 1 }, (_, day) => day + 1);
  if (todayQuests >= questCount) completedDays.push(TEAM_DAY);
  const shares = !(spec.missingStats && index === 1);
  return {
    id: friend.id,
    displayName: friend.displayName,
    avatarUrl: null,
    joinedDay: TEAM_DAY - spec.teamStreak,
    completedDays,
    today: shares ? { day: TEAM_DAY, questsDone: Math.min(todayQuests, questCount) } : null,
    totalXp: shares ? completedDays.length * friend.xpPerDay : null,
    achievementsUnlocked: shares ? friend.badges : null,
    lastActivityAt: shares ? minutesAgo(25 + index * 70) : null,
  };
}

function demoActivity(friends: readonly TeamMember[]): TeamActivity[] {
  const [alex, mia] = friends;
  const events: TeamActivity[] = [];
  if (alex) {
    events.push(
      {
        id: 'act-alex-day',
        memberId: alex.id,
        type: 'dayCompleted',
        metadata: { day: TEAM_DAY - 1 },
        createdAt: minutesAgo(60 * 20),
      },
      {
        id: 'act-alex-badge',
        memberId: alex.id,
        type: 'achievementUnlocked',
        metadata: { achievementId: 'perfectQuiz' },
        createdAt: minutesAgo(60 * 26),
      },
    );
  }
  if (mia) {
    events.push({
      id: 'act-mia-streak',
      memberId: mia.id,
      type: 'streakMilestone',
      metadata: { days: 50 },
      createdAt: minutesAgo(60 * 3),
    });
  }
  return events;
}

/** The team on Day 89, rebuilt from scratch through the same repositories the app uses. */
export async function applyTeamScenario(ctx: DevContext, scenario: TeamScenario): Promise<void> {
  const spec: TeamScenarioSpec = TEAM_SCENARIOS[scenario];
  await freshStart(ctx, TEAM_DAY);
  await seedDaysBefore(ctx, TEAM_DAY);
  const plan = await ctx.repositories.challenge.getDailyChallenge(TEAM_DAY);
  const questCount = plan.quests.length;
  await seedCompletedQuests(ctx, plan.quests.slice(0, Math.min(spec.youToday, questCount)), {
    perfect: false,
  });

  if (!spec.team) {
    await devRepository(ctx).replaceTeam(null, [], []);
  } else {
    const friends = Array.from({ length: spec.friends }, (_, index) =>
      demoFriend(index, spec, spec.friendsToday[index] ?? 0, questCount),
    );
    await devRepository(ctx).replaceTeam(demoTeam(), friends, demoActivity(friends));
  }
  await settleAchievements(ctx);

  if (spec.finishYourDay) {
    const done = new Set((await ctx.repositories.progress.getCompletions()).map((c) => c.questId));
    for (const quest of plan.quests.filter((item) => !done.has(item.id))) {
      await completeQuest(ctx.repositories, {
        questId: quest.id,
        correctCount: 5,
        totalCount: 6,
        source: 'dev',
      });
    }
  }
  invalidateAll(ctx);
}

/** A friend joins (the demo of what a server would push): Mia, or Alex if the team is empty. */
export async function simulateFriendJoined(ctx: DevContext): Promise<string> {
  const team = await ctx.repositories.friends.getMyTeam();
  if (!team) throw new Error('Create a team first (e.g. "1 member").');
  const members = await ctx.repositories.friends.getTeamMembers();
  const next = DEMO_FRIENDS.findIndex((friend) => !members.some((m) => m.id === friend.id));
  if (next < 0) throw new Error('Both demo friends are already in the team.');
  const state = await loadProgressState(ctx.repositories);
  const plan = await ctx.repositories.challenge.getDailyChallenge(state.currentDay);
  const friend = DEMO_FRIENDS[next] ?? DEMO_FRIENDS[0];
  const member: TeamMember = {
    id: friend.id,
    displayName: friend.displayName,
    avatarUrl: null,
    // Joined today: the days before are not theirs to finish.
    joinedDay: state.currentDay,
    completedDays: [],
    today: { day: state.currentDay, questsDone: Math.min(1, plan.quests.length) },
    totalXp: 20,
    achievementsUnlocked: 0,
    lastActivityAt: new Date().toISOString(),
  };
  await devRepository(ctx).addTeamMember(member, [
    {
      id: `act-join-${friend.id}-${Date.now()}`,
      memberId: friend.id,
      type: 'memberJoined',
      metadata: {},
      createdAt: new Date().toISOString(),
    },
  ]);
  await settleAchievements(ctx);
  invalidateAll(ctx);
  return friend.displayName;
}

/** Finishes your remaining quests today through the real completion use case. */
export async function finishMyDay(ctx: DevContext): Promise<void> {
  const state = await loadProgressState(ctx.repositories);
  const plan = await ctx.repositories.challenge.getDailyChallenge(state.currentDay);
  const done = new Set(state.todayCompletedQuestIds);
  for (const quest of plan.quests.filter((item) => !done.has(item.id))) {
    await completeQuest(ctx.repositories, {
      questId: quest.id,
      correctCount: 5,
      totalCount: 6,
      source: 'dev',
    });
  }
  invalidateAll(ctx);
}
