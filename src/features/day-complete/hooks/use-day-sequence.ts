import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { playFeedback } from '@/services/feedback';

import {
  BEAT_AT_MS,
  DAY_BEATS,
  beatsReached,
  isBeatReached,
  type DayBeat,
} from '../logic/day-sequence';

export type DaySequence = {
  /** The beat has happened — every beat has once the sequence is over, skipped or quiet. */
  reached: (beat: DayBeat) => boolean;
  /** Motion plays: a first visit, not skipped, and Reduce Motion is off. */
  animated: boolean;
  /** Beats are still to come; a tap can skip them. */
  running: boolean;
  skip: () => void;
};

/**
 * Drives the Day Complete celebration. With `celebrate` it plays the day's
 * sound and haptic once and then the beats; otherwise (a reopened day)
 * everything is simply there, silently. Reduce Motion keeps the sound and the
 * haptic but shows the final state at once.
 */
export function useDaySequence(celebrate: boolean, announcement: string): DaySequence {
  const reduceMotion = useReducedMotion();
  const motion = celebrate && !reduceMotion;
  const [reached, setReached] = useState(() => (motion ? beatsReached(0) : DAY_BEATS.length));
  const [skipped, setSkipped] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const played = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const announce = useEffectEvent(() => AccessibilityInfo.announceForAccessibility(announcement));

  useEffect(() => {
    if (!celebrate || played.current) return;
    played.current = true;
    // One sound for the whole moment; the streak step below is felt, not heard.
    playFeedback('dayComplete');
    announce();
  }, [celebrate]);

  useEffect(() => {
    if (!motion) return;
    for (const beat of DAY_BEATS) {
      const at = BEAT_AT_MS[beat];
      if (at === 0) continue;
      timers.current.push(
        setTimeout(() => {
          setReached((current) => Math.max(current, beatsReached(at)));
          if (beat === 'streak') playFeedback('streakStep');
        }, at),
      );
    }
    return clearTimers;
  }, [motion]);

  const running = motion && !skipped && reached < DAY_BEATS.length;
  return {
    reached: (beat) => isBeatReached(beat, reached),
    animated: motion && !skipped,
    running,
    skip: () => {
      if (!running) return;
      clearTimers();
      setSkipped(true);
      setReached(DAY_BEATS.length);
    },
  };
}
