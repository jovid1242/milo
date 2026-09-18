import { useEffect, useState } from 'react';
import {
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { easings } from '@/theme';

/** A gain to count up once per `key`, from `from` to `to`. */
export type CountUp = { key: number | string; from: number; to: number };

/**
 * The number to display for `value`: it simply follows `value`, except when a
 * new `countUp` arrives — then it counts calmly from `from` to `to`. Runs on
 * the UI thread; React only re-renders when the shown integer changes.
 */
export function useCountUp(
  value: number,
  countUp: CountUp | null,
  { durationMs = 700, delayMs = 150 }: { durationMs?: number; delayMs?: number } = {},
): number {
  const reduceMotion = useReducedMotion();
  const counter = useSharedValue(value);
  const [shown, setShown] = useState(value);

  const key = countUp?.key ?? null;
  const from = countUp?.from ?? 0;
  const to = countUp?.to ?? 0;

  useAnimatedReaction(
    () => Math.round(counter.get()),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setShown, current);
    },
  );

  // Plain value changes (a reset, another day) just show the new number…
  useEffect(() => {
    counter.set(value);
  }, [value, counter]);

  // …a gain counts up. Declared second so it wins when both change together.
  useEffect(() => {
    if (key === null || to <= from || reduceMotion) return;
    counter.set(
      withSequence(
        withTiming(from, { duration: 0 }),
        withDelay(delayMs, withTiming(to, { duration: durationMs, easing: easings.decelerate })),
      ),
    );
  }, [key, from, to, reduceMotion, counter, delayMs, durationMs]);

  return shown;
}
