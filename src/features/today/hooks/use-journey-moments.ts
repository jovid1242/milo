import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { wasQuestCelebrated } from '@/features/quests/celebrations';
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

/**
 * Detects reward moments on Home: a quest finished, the day completed, the
 * streak grew. Moments are only taken while Home is on screen, so a quest
 * finished elsewhere is celebrated when the user comes back — and reopening the
 * app later shows the finished state without replaying anything.
 */
export function useJourneyMoments(journey: TodayJourney): HomeMoment | null {
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
      if (diff) {
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

  useEffect(() => {
    if (!moment) return;
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
