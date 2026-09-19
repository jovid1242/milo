import { findCompletedDays } from '@/features/progress/logic/day-completion';
import { computeStreak } from '@/features/progress/logic/streak';

import { longestRun } from './run';
import type {
  Achievement,
  AchievementId,
  AchievementProgress,
  AchievementRule,
  AchievementStatus,
  AchievementUnlock,
  DailyChallenge,
  DayCompletion,
  DayNumber,
  QuestCompletion,
  QuestType,
} from '@/schemas';

/**
 * Everything the 12 badges depend on — derived from stored progress, once, in
 * the domain layer. The UI never checks `streak >= 7` itself.
 */
export type AchievementFacts = {
  /** Fully completed challenge days, in total. */
  completedDays: number;
  /** Completed days in a row up to today (or yesterday, while today is open). */
  currentStreak: number;
  /** The longest run of completed days ever — what the streak badges need. */
  longestStreak: number;
  /** Different words learned; the same word counts once. */
  uniqueWords: number;
  /** A scored quest finished without a single mistake. */
  hasPerfectQuest: boolean;
  /** Perfect days in a row up to today (or yesterday). */
  currentPerfectRun: number;
  longestPerfectRun: number;
  /**
   * Days in a row the whole team finished: now, and the longest run. `null`
   * without a team — there is nobody to share a streak with.
   */
  teamStreak: { current: number; longest: number } | null;
};

export { longestRun } from './run';

/** The quests of an ordinary day — the only ones Perfect Quiz looks at. */
const DAILY_QUEST_TYPES: ReadonlySet<QuestType> = new Set([
  'vocabulary',
  'grammar',
  'reading',
  'review',
]);

/**
 * Completed days where every quest was answered without a mistake. The day
 * record decides when it exists; older days are judged by their quests.
 */
export function findPerfectDays(
  plans: readonly DailyChallenge[],
  completions: readonly QuestCompletion[],
  dayCompletions: readonly DayCompletion[],
): Set<DayNumber> {
  const completed = findCompletedDays(plans, completions);
  const byQuest = new Map(completions.map((completion) => [completion.questId, completion]));
  const records = new Map(dayCompletions.map((record) => [record.day, record]));
  const perfect = new Set<DayNumber>();
  for (const plan of plans) {
    if (!completed.has(plan.day)) continue;
    const isPerfect =
      records.get(plan.day)?.isPerfect ??
      plan.quests.every((quest) => {
        const completion = byQuest.get(quest.id);
        return completion !== undefined && completion.correctCount === completion.totalCount;
      });
    if (isPerfect) perfect.add(plan.day);
  }
  return perfect;
}

export function buildAchievementFacts(input: {
  plans: readonly DailyChallenge[];
  completions: readonly QuestCompletion[];
  dayCompletions: readonly DayCompletion[];
  uniqueWords: number;
  currentDay: DayNumber;
  teamStreak?: AchievementFacts['teamStreak'];
}): AchievementFacts {
  const completed = findCompletedDays(input.plans, input.completions);
  const perfect = findPerfectDays(input.plans, input.completions, input.dayCompletions);
  return {
    completedDays: completed.size,
    currentStreak: computeStreak(completed, input.currentDay),
    longestStreak: longestRun(completed),
    uniqueWords: input.uniqueWords,
    // A daily quest with at least one scored question, all of them right. Weekly
    // exams and the final battle are checkpoints, not quizzes: they never count.
    hasPerfectQuest: input.completions.some(
      (completion) =>
        DAILY_QUEST_TYPES.has(completion.questType) &&
        completion.totalCount > 0 &&
        completion.correctCount === completion.totalCount,
    ),
    currentPerfectRun: computeStreak(perfect, input.currentDay),
    longestPerfectRun: longestRun(perfect),
    teamStreak: input.teamStreak ?? null,
  };
}

export type RuleCheck = {
  /** `false` while the app cannot know (e.g. no Friends yet). */
  available: boolean;
  met: boolean;
  progress: AchievementProgress | null;
};

const toward = (current: number, target: number): AchievementProgress => ({
  current: Math.max(0, Math.min(current, target)),
  target,
});

/** One rule against the facts: met or not, and honest progress where it means something. */
export function checkRule(rule: AchievementRule, facts: AchievementFacts): RuleCheck {
  switch (rule.type) {
    case 'completedDays':
      return {
        available: true,
        met: facts.completedDays >= rule.count,
        // "0 / 1" says nothing: a single-step badge is simply locked.
        progress: rule.count > 1 ? toward(facts.completedDays, rule.count) : null,
      };
    case 'streak':
      // Unlocked by the longest streak ever; progress shows the streak running now.
      return {
        available: true,
        met: facts.longestStreak >= rule.count,
        progress: toward(facts.currentStreak, rule.count),
      };
    case 'uniqueWords':
      return {
        available: true,
        met: facts.uniqueWords >= rule.count,
        progress: toward(facts.uniqueWords, rule.count),
      };
    case 'perfectQuest':
      return { available: true, met: facts.hasPerfectQuest, progress: null };
    case 'perfectDaysInRow':
      return {
        available: true,
        met: facts.longestPerfectRun >= rule.count,
        progress: toward(facts.currentPerfectRun, rule.count),
      };
    case 'teamStreak':
      // Like the personal streaks: the longest run unlocks, the running one is progress.
      return facts.teamStreak === null
        ? { available: false, met: false, progress: null }
        : {
            available: true,
            met: facts.teamStreak.longest >= rule.count,
            progress: toward(facts.teamStreak.current, rule.count),
          };
  }
}

/**
 * Every badge as the user sees it. A persisted unlock always wins: a badge
 * never locks again, whatever happens to the streak later.
 */
export function evaluateAchievements(
  definitions: readonly Achievement[],
  facts: AchievementFacts,
  unlocks: readonly AchievementUnlock[],
): AchievementStatus[] {
  const unlocked = new Map(unlocks.map((unlock) => [unlock.achievementId, unlock]));
  return definitions.map((achievement): AchievementStatus => {
    const unlock = unlocked.get(achievement.id);
    if (unlock) {
      return { achievement, state: 'unlocked', unlockedAt: unlock.unlockedAt, progress: null };
    }
    const check = checkRule(achievement.rule, facts);
    return {
      achievement,
      state: check.available ? 'locked' : 'notAvailable',
      unlockedAt: null,
      progress: check.progress,
    };
  });
}

/** Earned now but not unlocked yet — exactly what a sync writes. */
export function findNewlyEarned(
  definitions: readonly Achievement[],
  facts: AchievementFacts,
  unlockedIds: ReadonlySet<AchievementId>,
): Achievement[] {
  return definitions.filter(
    (achievement) => !unlockedIds.has(achievement.id) && checkRule(achievement.rule, facts).met,
  );
}

/**
 * One celebration at a time: the biggest badge leads (largest reward, then
 * badge order), the rest are summed up under it — never a chain of popups.
 */
export function planCelebration(
  pending: readonly Achievement[],
): { lead: Achievement; others: Achievement[] } | null {
  const ordered = pending
    .map((achievement, index) => ({ achievement, index }))
    .sort((a, b) => b.achievement.xpReward - a.achievement.xpReward || a.index - b.index)
    .map(({ achievement }) => achievement);
  const [lead, ...others] = ordered;
  return lead ? { lead, others } : null;
}
