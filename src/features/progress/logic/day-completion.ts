import type {
  DailyChallenge,
  DayCompletion,
  DayNumber,
  QuestCompletion,
  Timestamp,
} from '@/schemas';

import { streakEndingAt } from './streak';

/** The days whose every quest has a completion. */
export function findCompletedDays(
  plans: readonly DailyChallenge[],
  completions: readonly QuestCompletion[],
): Set<DayNumber> {
  const done = new Set(completions.map((completion) => completion.questId));
  return new Set(
    plans
      .filter((plan) => plan.quests.every((quest) => done.has(quest.id)))
      .map((plan) => plan.day),
  );
}

/** A quest counts towards a perfect day when every scored answer was right. */
const isPerfectCompletion = (completion: QuestCompletion) =>
  completion.correctCount === completion.totalCount;

/**
 * What finishing `plan` means — the XP its quests earned, the streak before and
 * after, whether every answer was right. `null` while any quest is still open:
 * a day is complete only when all of its quests are.
 */
export function buildDayCompletion(input: {
  plan: DailyChallenge;
  completions: readonly QuestCompletion[];
  completedDays: ReadonlySet<DayNumber>;
  completedAt: Timestamp;
  celebratedAt?: Timestamp | null;
}): DayCompletion | null {
  const { plan, completions, completedDays } = input;
  const byQuest = new Map(completions.map((completion) => [completion.questId, completion]));
  const dayCompletions = plan.quests.map((quest) => byQuest.get(quest.id));
  if (dayCompletions.some((completion) => completion === undefined)) return null;
  const done = dayCompletions as QuestCompletion[];

  const streakBefore = streakEndingAt(completedDays, plan.day - 1);
  return {
    day: plan.day,
    completedAt: input.completedAt,
    questCount: done.length,
    xpEarned: done.reduce((sum, completion) => sum + completion.xpEarned, 0),
    streakBefore,
    streakAfter: streakBefore + 1,
    isPerfect: done.every(isPerfectCompletion),
    celebratedAt: input.celebratedAt ?? null,
  };
}
