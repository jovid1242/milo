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

export type XpCounterProps = {
  value: number;
  /** Set when XP was just earned: counts up from `from` and floats "+N". */
  gain: { key: number; from: number } | null;
};

const COUNT_MS = 700;

/** Total XP with a calm count-up after a reward — no slot-machine spinning. */
export function XpCounter({ value, gain }: XpCounterProps) {
  const reduceMotion = useReducedMotion();
  const counter = useSharedValue(value);
  const float = useSharedValue(0);
  const [shown, setShown] = useState(value);

  useAnimatedReaction(
    () => Math.round(counter.get()),
    (current, previous) => {
      if (current !== previous) scheduleOnRN(setShown, current);
    },
  );

  useEffect(() => {
    if (!gain || gain.from >= value || reduceMotion) {
      counter.set(value);
      return;
    }
    counter.set(
      withSequence(
        withTiming(gain.from, { duration: 0 }),
        withDelay(150, withTiming(value, { duration: COUNT_MS, easing: easings.decelerate })),
      ),
    );
    float.set(
      withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: COUNT_MS + 500 })),
    );
  }, [gain, value, reduceMotion, counter, float]);

  const floatStyle = useAnimatedStyle(() => {
    const t = float.get();
    return {
      // Fade in fast, drift up, fade out: a small "+20" that never lingers.
      opacity: t === 0 || t === 1 ? 0 : Math.min(1, t * 6, (1 - t) * 3),
      transform: [{ translateY: -4 - t * 14 }],
    };
  });

  const earned = gain ? value - gain.from : 0;

  return (
    <View
      accessible
      accessibilityLabel={`${formatNumber(value)} XP`}
      style={styles.container}>
      {earned > 0 ? (
        <Animated.View style={[styles.float, floatStyle]}>
          <AppText variant="label" color="reward">{`+${earned}`}</AppText>
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
