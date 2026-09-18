import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, durations, easings, spacing } from '@/theme';

import { DottedTrail } from './DottedTrail';

export type TrailConnectorProps = {
  /** The quest above is done: this stretch of trail has been walked. */
  walked: boolean;
  /** Set when it was just walked: the solid line draws itself downwards. */
  revealKey: number | null;
};

/** The piece of trail between two waypoints; stretches to fill its row. */
export function TrailConnector({ walked, revealKey }: TrailConnectorProps) {
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(walked ? 1 : 0);

  useEffect(() => {
    if (!walked) {
      reveal.set(0);
      return;
    }
    if (revealKey === null || reduceMotion) {
      reveal.set(1);
      return;
    }
    reveal.set(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(
          120,
          withTiming(1, { duration: durations.slow + 100, easing: easings.standard }),
        ),
      ),
    );
  }, [walked, revealKey, reduceMotion, reveal]);

  const walkedStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: reveal.get() }] }));

  return (
    <View style={styles.connector}>
      <DottedTrail orientation="vertical" color={colors.trail.ahead} />
      <Animated.View style={[styles.walked, walkedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Small gaps at both ends keep the trail reading as one line through the waypoints.
  connector: {
    flex: 1,
    width: 4,
    minHeight: spacing[5],
    marginVertical: spacing[1],
    alignSelf: 'center',
  },
  walked: {
    ...StyleSheet.absoluteFill,
    borderRadius: 2,
    backgroundColor: colors.trail.walked,
    transformOrigin: 'top',
  },
});
