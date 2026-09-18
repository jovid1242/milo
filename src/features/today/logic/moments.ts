import type { FeedbackEvent } from '@/services/feedback';
import type { DayKind } from '@/schemas';

import type { TodayJourney } from './today-journey';

/** The facts Home compares between two visits to detect a reward moment. */
export type JourneySnapshot = {
  day: number;
  completedQuestIds: readonly string[];
  streak: number;
  totalXp: number;
  isComplete: boolean;
};

/** Something worth celebrating happened since Home last looked. */
export type JourneyMoment = {
  newlyCompletedQuestIds: string[];
  xpFrom: number;
  xpTo: number;
  streakFrom: number;
  streakTo: number;
  dayCompleted: boolean;
};

export type FeedbackCue = { event: FeedbackEvent; delayMs: number };

export function takeSnapshot(journey: TodayJourney): JourneySnapshot {
  return {
    day: journey.day,
    completedQuestIds: journey.steps
      .filter((step) => step.status === 'completed')
      .map((step) => step.quest.id),
    streak: journey.streak,
    totalXp: journey.totalXp,
    isComplete: journey.isComplete,
  };
}

export function isSameSnapshot(a: JourneySnapshot, b: JourneySnapshot): boolean {
  return (
    a.day === b.day &&
    a.streak === b.streak &&
    a.totalXp === b.totalXp &&
    a.isComplete === b.isComplete &&
    a.completedQuestIds.join() === b.completedQuestIds.join()
  );
}

/**
 * Only gains on the same day are moments. A new day, a reset or lower numbers
 * simply show the new state — no celebration replays when Home is reopened.
 */
export function diffJourney(
  previous: JourneySnapshot,
  next: JourneySnapshot,
): JourneyMoment | null {
  if (previous.day !== next.day) return null;

  const before = new Set(previous.completedQuestIds);
  const newlyCompletedQuestIds = next.completedQuestIds.filter((id) => !before.has(id));
  const dayCompleted = !previous.isComplete && next.isComplete;
  const xpGained = next.totalXp > previous.totalXp;
  const streakGained = next.streak > previous.streak;

  if (newlyCompletedQuestIds.length === 0 && !dayCompleted && !xpGained && !streakGained) {
    return null;
  }
  return {
    newlyCompletedQuestIds,
    xpFrom: previous.totalXp,
    xpTo: next.totalXp,
    streakFrom: previous.streak,
    streakTo: next.streak,
    dayCompleted,
  };
}

/**
 * One sound at a time: the biggest moment plays first and the streak follows
 * once it has landed, instead of three sounds stacking up.
 */
export function feedbackCues(moment: JourneyMoment, dayKind: DayKind): FeedbackCue[] {
  const cues: FeedbackCue[] = [];
  let streakDelay = 0;

  if (moment.dayCompleted) {
    const summit = dayKind === 'summit';
    cues.push({ event: summit ? 'summitVictory' : 'dayComplete', delayMs: 0 });
    streakDelay = summit ? 2200 : 1100;
  } else if (moment.newlyCompletedQuestIds.length > 0) {
    cues.push({ event: 'questComplete', delayMs: 0 });
    streakDelay = 500;
  }

  if (moment.streakTo > moment.streakFrom) cues.push({ event: 'streakUp', delayMs: streakDelay });
  return cues;
}
