import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui';
import { useCountUp, type CountUp } from '@/hooks/use-count-up';
import { formatNumber } from '@/utils/number';

/** XP just earned: the counter counts up `from → to` once per `key`. */
export type XpGain = CountUp;

export type XpCounterProps = {
  value: number;
  gain: XpGain | null;
};

/** Total XP with a calm count-up after a reward — no slot-machine spinning. */
export function XpCounter({ value, gain }: XpCounterProps) {
  const reduceMotion = useReducedMotion();
  const shown = useCountUp(value, gain);
  const float = useSharedValue(0);

  const gainKey = gain?.key ?? null;
  const earned = gain ? gain.to - gain.from : 0;

  useEffect(() => {
    if (gainKey === null || earned <= 0 || reduceMotion) return;
    float.set(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 1200 })));
  }, [gainKey, earned, reduceMotion, float]);

  const floatStyle = useAnimatedStyle(() => {
    const t = float.get();
    return {
      // Fades in fast, drifts up, fades out: a small "+20" that never lingers.
      opacity: t <= 0 || t >= 1 ? 0 : Math.min(1, t * 6, (1 - t) * 3),
      transform: [{ translateY: -2 - t * 14 }],
    };
  });

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
