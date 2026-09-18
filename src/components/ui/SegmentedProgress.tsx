import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, durations, easings, radius, spacing } from '@/theme';

export type SegmentedProgressProps = {
  /** Segments per group, e.g. `[6, 6]` for six words then six questions. */
  groups: readonly number[];
  /** Filled segments, counted across groups. */
  done: number;
  /** Fixed segment width; omit to share the available width. */
  segmentWidth?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** Progress as discrete steps; a segment fills with a short sweep when reached. */
export function SegmentedProgress({
  groups,
  done,
  segmentWidth,
  height = 6,
  style,
}: SegmentedProgressProps) {
  // Index of each group's first segment in the overall count.
  const starts = groups.map((_, group) =>
    groups.slice(0, group).reduce((sum, count) => sum + count, 0),
  );
  return (
    <View style={[styles.row, style]}>
      {groups.map((count, group) => {
        const first = starts[group] ?? 0;
        return (
          <View key={group} style={[styles.group, segmentWidth === undefined && styles.stretch]}>
            {Array.from({ length: count }, (_, index) => (
              <Segment
                key={index}
                filled={first + index < done}
                width={segmentWidth}
                height={height}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function Segment({
  filled,
  width,
  height,
}: {
  filled: boolean;
  width: number | undefined;
  height: number;
}) {
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
    <View
      style={[
        styles.segment,
        { height, borderRadius: height / 2 },
        width === undefined ? styles.stretch : { width },
      ]}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing[3] },
  group: { flexDirection: 'row', gap: spacing[1] },
  stretch: { flex: 1 },
  segment: { backgroundColor: colors.reward.track, overflow: 'hidden', borderRadius: radius.pill },
  fill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.reward.gold,
    transformOrigin: 'left',
  },
});
