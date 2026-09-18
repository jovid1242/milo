import { CHALLENGE } from '@/constants/challenge';
import type {
  Chapter,
  DailyChallenge,
  DayKind,
  DayNumber,
  ProgressState,
  Quest,
  QuestCompletion,
  QuestSession,
} from '@/schemas';

/**
 * Today's quests form one route: done in order, so every quest after the
 * current one is locked until the user gets there.
 */
export type QuestStatus = 'completed' | 'inProgress' | 'available' | 'locked';

export type JourneyStep = {
  quest: Quest;
  status: QuestStatus;
  /** Share done, 0…1: 1 when completed, the session's progress while in progress. */
  progress: number;
  /** XP actually received; 0 until the quest is completed. */
  xpEarned: number;
};

/** Everything the Home screen shows, derived from persisted progress. */
export type TodayJourney = {
  day: DayNumber;
  totalDays: number;
  dayKind: DayKind;
  chapter: Chapter;
  /** Chapter ends along the 90-day trail (the last two sit on the summit itself). */
  checkpointDays: DayNumber[];
  steps: JourneyStep[];
  /** The step to do next; `null` once the day is complete. */
  current: JourneyStep | null;
  completedCount: number;
  isComplete: boolean;
  /** XP earned from today's quests, bonuses included. */
  xpEarnedToday: number;
  /** Estimated minutes for the quests still open today. */
  minutesLeft: number;
  streak: number;
  totalXp: number;
  /** Fully completed challenge days. */
  completedDays: number;
  daysToSummit: number;
};

export type TodayJourneyInput = {
  plan: DailyChallenge;
  chapters: readonly Chapter[];
  progress: ProgressState;
  /** Completions of any day; only the plan's quests are used. */
  completions: readonly QuestCompletion[];
  sessions: readonly QuestSession[];
};

export function buildTodayJourney({
  plan,
  chapters,
  progress,
  completions,
  sessions,
}: TodayJourneyInput): TodayJourney {
  const completionById = new Map(completions.map((c) => [c.questId, c]));
  const sessionById = new Map(sessions.map((s) => [s.questId, s]));
  const currentIndex = plan.quests.findIndex((quest) => !completionById.has(quest.id));

  const steps = plan.quests.map((quest, index): JourneyStep => {
    const completion = completionById.get(quest.id);
    if (completion) {
      return { quest, status: 'completed', progress: 1, xpEarned: completion.xpEarned };
    }
    if (index !== currentIndex) return { quest, status: 'locked', progress: 0, xpEarned: 0 };

    const session = sessionById.get(quest.id);
    return session
      ? { quest, status: 'inProgress', progress: session.progress, xpEarned: 0 }
      : { quest, status: 'available', progress: 0, xpEarned: 0 };
  });

  const chapter = chapters.find((c) => plan.day >= c.startDay && plan.day <= c.endDay);
  if (!chapter) throw new Error(`No chapter covers day ${plan.day}`);

  const open = steps.filter((step) => step.status !== 'completed');

  return {
    day: plan.day,
    totalDays: CHALLENGE.totalDays,
    dayKind: plan.kind,
    chapter,
    checkpointDays: chapters.map((c) => c.endDay).filter((day) => day < CHALLENGE.totalDays - 1),
    steps,
    current: steps[currentIndex] ?? null,
    completedCount: steps.length - open.length,
    isComplete: open.length === 0,
    xpEarnedToday: steps.reduce((sum, step) => sum + step.xpEarned, 0),
    minutesLeft: open.reduce((sum, step) => sum + step.quest.estimatedMinutes, 0),
    streak: progress.streak,
    totalXp: progress.totalXp,
    completedDays: progress.completedDays.length,
    daysToSummit: CHALLENGE.totalDays - plan.day,
  };
}
