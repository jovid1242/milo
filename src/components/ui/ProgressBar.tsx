import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, durations, easings, radius } from '@/theme';
import { clamp } from '@/utils/number';

export type ProgressBarProps = {
  /** 0…1 */
  progress: number;
  tone?: 'reward' | 'brand';
  height?: number;
  /** Announced by screen readers, e.g. "Today's quests". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({
  progress,
  tone = 'reward',
  height = 8,
  accessibilityLabel,
  style,
}: ProgressBarProps) {
  const reduceMotion = useReducedMotion();
  const target = clamp(progress, 0, 1);
  const value = useSharedValue(target);

  useEffect(() => {
    value.set(
      reduceMotion
        ? target
        : withTiming(target, { duration: durations.slow, easing: easings.standard }),
    );
  }, [target, reduceMotion, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
      style={[styles.track, { height, borderRadius: height / 2 }, style]}>
      <Animated.View
        style={[
          styles.fill,
          fillStyle,
          {
            borderRadius: height / 2,
            backgroundColor: tone === 'reward' ? colors.reward.gold : colors.brand.primary,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.reward.track,
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%',
  },
  fill: { height: '100%' },
});
