import { CHAPTERS } from '@/data/content/chapters';
import { buildAllDailyChallenges, questId } from '@/data/content/schedule';
import { getStartDateForDay } from '@/features/challenge/logic/calendar';
import { findTomorrow } from '@/features/challenge/logic/tomorrow';
import { buildProgressState } from '@/features/progress/logic/progress-state';
import type { QuestCompletion, QuestSession, QuestType } from '@/schemas';

import { buildTodayJourney, type TodayJourney } from '../today-journey';

export const NOW = new Date(2026, 8, 18, 12, 0, 0);
export const PLANS = buildAllDailyChallenges();

const completion = (
  day: number,
  type: QuestType,
  xpEarned: number,
  perfect = false,
): QuestCompletion => ({
  questId: questId(day, type),
  day,
  questType: type,
  score: perfect ? 1 : 0.8,
  correctCount: perfect ? 5 : 4,
  totalCount: 5,
  xpEarned,
  source: 'user',
  completedAt: NOW.toISOString(),
});

export type JourneyFixture = {
  day: number;
  /** Earlier days that are fully complete. */
  pastDays?: number[];
  /** Quest types finished today. */
  doneToday?: QuestType[];
  /** Quest types opened but not finished. */
  started?: { type: QuestType; progress: number }[];
  totalXp?: number;
  /** Today's quests were answered without a mistake. */
  perfect?: boolean;
  /** An exam day: whether today's handed-in exam is passed. */
  examPassed?: boolean | null;
};

/** A TodayJourney built through the real progress pipeline. */
export function journeyFor({
  day,
  pastDays = [],
  doneToday = [],
  started = [],
  totalXp = 0,
  perfect = false,
  examPassed = null,
}: JourneyFixture): TodayJourney {
  const plan = PLANS.find((item) => item.day === day);
  if (!plan) throw new Error(`no plan for day ${day}`);

  const completions = [
    ...PLANS.filter((item) => pastDays.includes(item.day)).flatMap((item) =>
      item.quests.map((quest) => completion(item.day, quest.type, quest.xpReward)),
    ),
    ...plan.quests
      .filter((quest) => doneToday.includes(quest.type))
      .map((quest) => completion(day, quest.type, quest.xpReward, perfect)),
  ];
  const sessions: QuestSession[] = started.map(({ type, progress }) => ({
    questId: questId(day, type),
    startedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    progress,
    state: null,
  }));

  const progress = buildProgressState({
    user: {
      id: 'local-user',
      displayName: 'Explorer',
      challengeStartDate: getStartDateForDay(day, NOW),
      goal: null,
      onboardedAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
    },
    chapters: CHAPTERS,
    dailyChallenges: PLANS,
    completions,
    totalXp,
    unlocks: [],
    wordsLearned: 0,
    now: NOW,
  });

  const exam = plan.quests.find(
    (quest) => quest.type === 'weeklyExam' || quest.type === 'finalBattle',
  );
  return buildTodayJourney({
    exam: exam && examPassed !== null ? { questId: exam.id, passed: examPassed } : null,
    plan,
    chapters: CHAPTERS,
    progress,
    completions,
    sessions,
    tomorrow: findTomorrow(PLANS, day),
  });
}
