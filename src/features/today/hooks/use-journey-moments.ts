import { useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { useRepositories } from '@/data/repository-provider';
import { invalidateProgress } from '@/features/progress/queries';
import { claimDayCelebration } from '@/features/progress/use-cases';
import {
  rememberDayCelebrated,
  wasDayCelebrated,
  wasQuestCelebrated,
} from '@/features/quests/celebrations';
import { logger } from '@/lib/logger';
import { playFeedback } from '@/services/feedback';

import {
  diffJourney,
  feedbackCues,
  isSameSnapshot,
  takeSnapshot,
  type FeedbackCue,
  type JourneyMoment,
  type JourneySnapshot,
} from '../logic/moments';
import type { TodayJourney } from '../logic/today-journey';

export type HomeMoment = JourneyMoment & {
  /** Increments per moment; components restart their animation when it changes. */
  id: number;
  cues: FeedbackCue[];
  /** When the streak bump plays, in step with its sound. */
  streakDelayMs: number;
  announcement: string | null;
};

/** The day already had its moment — on the Day Complete screen, or earlier on Home. */
function isDayCelebrated(journey: TodayJourney): boolean {
  const record = journey.dayCompletion;
  return record !== null && (record.celebratedAt !== null || wasDayCelebrated(record));
}

/**
 * Detects reward moments on Home: a quest finished, the day completed, the
 * streak grew. Moments are only taken while Home is on screen, so a quest
 * finished elsewhere is celebrated when the user comes back — and reopening the
 * app later shows the finished state without replaying anything.
 *
 * A day celebrated on its Day Complete screen is not celebrated again: Home
 * simply shows the calm, finished day. Only when the user skipped that screen
 * does Home play the day's moment — and claims it, so it never plays twice.
 */
export function useJourneyMoments(journey: TodayJourney): HomeMoment | null {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const [snapshot, setSnapshot] = useState<JourneySnapshot | null>(null);
  const [moment, setMoment] = useState<HomeMoment | null>(null);

  // Adjusting state while rendering (instead of in an effect) avoids painting
  // one frame of the new numbers before their animation starts.
  if (isFocused) {
    const next = takeSnapshot(journey);
    if (snapshot === null || !isSameSnapshot(snapshot, next)) {
      setSnapshot(next);
      const diff = snapshot ? diffJourney(snapshot, next) : null;
      if (diff && !(diff.dayCompleted && isDayCelebrated(journey))) {
        const cues = feedbackCues(diff, journey.dayKind);
        setMoment({
          ...diff,
          id: (moment?.id ?? 0) + 1,
          cues,
          streakDelayMs: cues.find((cue) => cue.event === 'streakUp')?.delayMs ?? 0,
          announcement: diff.dayCompleted
            ? `Day ${journey.day} complete. ${journey.xpEarnedToday} XP earned today.`
            : null,
        });
      }
    }
  }

  const claimDay = useEffectEvent(() => {
    if (journey.dayCompletion) rememberDayCelebrated(journey.dayCompletion);
    claimDayCelebration(repositories, journey.day)
      .then(() => invalidateProgress(queryClient))
      .catch((error: unknown) => logger.warn('could not save the day celebration', error));
  });

  useEffect(() => {
    if (!moment) return;
    if (moment.dayCompleted) claimDay();
    // A quest that already had its own result moment is not chimed twice on Home.
    const alreadyCelebrated =
      moment.newlyCompletedQuestIds.length > 0 &&
      moment.newlyCompletedQuestIds.every(wasQuestCelebrated);
    const cues = alreadyCelebrated
      ? moment.cues.filter((cue) => cue.event !== 'questComplete')
      : moment.cues;
    const timers = cues.map((cue) => setTimeout(() => playFeedback(cue.event), cue.delayMs));
    if (moment.announcement) AccessibilityInfo.announceForAccessibility(moment.announcement);
    return () => timers.forEach(clearTimeout);
  }, [moment]);

  return moment;
}
