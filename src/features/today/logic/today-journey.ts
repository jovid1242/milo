import { CHALLENGE } from '@/constants/challenge';
import { trailCheckpoints } from '@/features/challenge/logic/calendar';
import type { Tomorrow } from '@/features/challenge/logic/tomorrow';
import type {
  Chapter,
  DailyChallenge,
  DayCompletion,
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
  /** Today's record once the day is complete (with whether it was celebrated yet). */
  dayCompletion: DayCompletion | null;
  /** Every answer of every quest today was right. Shown gently — never a badge. */
  isPerfectDay: boolean;
  /** XP earned from today's quests, bonuses included. */
  xpEarnedToday: number;
  /** Estimated minutes for the quests still open today. */
  minutesLeft: number;
  streak: number;
  totalXp: number;
  /** Fully completed challenge days. */
  completedDays: number;
  daysToSummit: number;
  /** `null` on the last day. */
  tomorrow: Tomorrow | null;
};

export type TodayJourneyInput = {
  plan: DailyChallenge;
  chapters: readonly Chapter[];
  progress: ProgressState;
  /** Completions of any day; only the plan's quests are used. */
  completions: readonly QuestCompletion[];
  sessions: readonly QuestSession[];
  dayCompletion?: DayCompletion | null;
  tomorrow?: Tomorrow | null;
};

export function buildTodayJourney({
  plan,
  chapters,
  progress,
  completions,
  sessions,
  dayCompletion = null,
  tomorrow = null,
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
  const isComplete = open.length === 0;
  const record = isComplete && dayCompletion?.day === plan.day ? dayCompletion : null;
  const allRight = plan.quests.every((quest) => {
    const completion = completionById.get(quest.id);
    return completion !== undefined && completion.correctCount === completion.totalCount;
  });

  return {
    day: plan.day,
    totalDays: CHALLENGE.totalDays,
    dayKind: plan.kind,
    chapter,
    checkpointDays: trailCheckpoints(chapters),
    steps,
    current: steps[currentIndex] ?? null,
    completedCount: steps.length - open.length,
    isComplete,
    dayCompletion: record,
    isPerfectDay: record ? record.isPerfect : isComplete && allRight,
    xpEarnedToday: steps.reduce((sum, step) => sum + step.xpEarned, 0),
    minutesLeft: open.reduce((sum, step) => sum + step.quest.estimatedMinutes, 0),
    streak: progress.streak,
    totalXp: progress.totalXp,
    completedDays: progress.completedDays.length,
    daysToSummit: CHALLENGE.totalDays - plan.day,
    tomorrow,
  };
}
