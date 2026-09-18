import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { AppText } from '@/components/ui';
import { easings } from '@/theme';
import { formatNumber } from '@/utils/number';

/** XP just earned: the counter counts up `from → to` once per `key`. */
export type XpGain = { key: number; from: number; to: number };

export type XpCounterProps = {
  value: number;
  gain: XpGain | null;
};

const COUNT_MS = 700;

/** Total XP with a calm count-up after a reward — no slot-machine spinning. */
export function XpCounter({ value, gain }: XpCounterProps) {
  const reduceMotion = useReducedMotion();
  const counter = useSharedValue(value);
  const float = useSharedValue(0);
  const [shown, setShown] = useState(value);

  const gainKey = gain?.key ?? null;
  const gainFrom = gain?.from ?? 0;
  const gainTo = gain?.to ?? 0;

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
    if (gainKey === null || gainTo <= gainFrom || reduceMotion) return;
    counter.set(
      withSequence(
        withTiming(gainFrom, { duration: 0 }),
        withDelay(150, withTiming(gainTo, { duration: COUNT_MS, easing: easings.decelerate })),
      ),
    );
    float.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 1200 })));
  }, [gainKey, gainFrom, gainTo, reduceMotion, counter, float]);

  const floatStyle = useAnimatedStyle(() => {
    const t = float.get();
    return {
      // Fades in fast, drifts up, fades out: a small "+20" that never lingers.
      opacity: t <= 0 || t >= 1 ? 0 : Math.min(1, t * 6, (1 - t) * 3),
      transform: [{ translateY: -2 - t * 14 }],
    };
  });

  const earned = gainTo - gainFrom;

  return (
    <View accessible accessibilityLabel={`${formatNumber(value)} XP`} style={styles.container}>
      {earned > 0 ? (
        <Animated.View style={[styles.float, floatStyle]}>
          <AppText variant="label" color="reward">{`+${formatNumber(earned)}`}</AppText>
        </Animated.View>
      ) : null}
      <AppText variant="label" color="reward">{`${formatNumber(shown)} XP`}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-end' },
  float: { position: 'absolute', right: 0, bottom: '100%' },
});
