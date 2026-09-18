import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, durations, easings, radius, spacing } from '@/theme';

/** Today's progress as one pip per quest; a pip fills when its quest is done. */
export function QuestPips({ total, done }: { total: number; done: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, index) => (
        <Pip key={index} filled={index < done} />
      ))}
    </View>
  );
}

function Pip({ filled }: { filled: boolean }) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    const target = filled ? 1 : 0;
    fill.set(
      reduceMotion
        ? target
        : withTiming(target, { duration: durations.slow, easing: easings.standard }),
    );
  }, [filled, reduceMotion, fill]);

  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.get() }] }));

  return (
    <View style={styles.pip}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[1] },
  pip: {
    width: 16,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.reward.track,
    overflow: 'hidden',
  },
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.reward.gold,
    transformOrigin: 'left',
  },
});
