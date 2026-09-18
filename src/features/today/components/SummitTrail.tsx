import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { journey as journeyArt } from '@/constants/assets';
import { colors, durations, easings, radius, shadows, spacing, springs } from '@/theme';

import { DottedTrail } from './DottedTrail';

export type SummitTrailProps = {
  day: number;
  totalDays: number;
  completedDays: number;
  checkpointDays: readonly number[];
  isTodayComplete: boolean;
  /** Set when today was just completed: the "you are here" marker turns gold with a pop. */
  celebrateKey: number | null;
  summitWidth: number;
};

const MARKER = 14;
const TRACK_HEIGHT = 20;

/**
 * The whole 90-day expedition in one line: walked days in gold, the dotted way
 * ahead, chapter checkpoints, and the mountain at the end.
 */
export function SummitTrail({
  day,
  totalDays,
  completedDays,
  checkpointDays,
  isTodayComplete,
  celebrateKey,
  summitWidth,
}: SummitTrailProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const walked = completedDays / totalDays;
  const fill = useSharedValue(walked);
  const pop = useSharedValue(1);

  useEffect(() => {
    fill.set(
      reduceMotion
        ? walked
        : withTiming(walked, { duration: durations.reward, easing: easings.standard }),
    );
  }, [walked, reduceMotion, fill]);

  useEffect(() => {
    if (celebrateKey === null || reduceMotion) return;
    pop.set(
      withDelay(
        durations.normal,
        withSequence(withTiming(1.6, { duration: 160 }), withSpring(1, springs.bouncy)),
      ),
    );
  }, [celebrateKey, reduceMotion, pop]);

  const fillStyle = useAnimatedStyle(() => ({ width: fill.get() * width }));
  const markerStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  // "You are here": the middle of today's slot on the trail.
  const markerLeft = (width * (day - 0.5)) / totalDays - MARKER / 2;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Journey to the summit"
      accessibilityValue={{
        min: 0,
        max: totalDays,
        now: completedDays,
        text: `${completedDays} of ${totalDays} days completed`,
      }}
      style={styles.row}>
      <View style={styles.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <DottedTrail orientation="horizontal" color={colors.trail.ahead} />
        {width > 0 ? (
          <>
            <Animated.View style={[styles.walked, fillStyle]} />
            {checkpointDays.map((checkpoint) => (
              <View
                key={checkpoint}
                style={[
                  styles.checkpoint,
                  { left: (width * checkpoint) / totalDays - 4 },
                  checkpoint < day && styles.checkpointPassed,
                ]}
              />
            ))}
            <Animated.View
              style={[
                styles.marker,
                { left: Math.max(0, markerLeft) },
                isTodayComplete && styles.markerDone,
                markerStyle,
              ]}
            />
          </>
        ) : null}
      </View>
      <AssetImage asset={journeyArt.mountains} width={summitWidth} style={styles.mountain} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  track: { flex: 1, height: TRACK_HEIGHT, justifyContent: 'center', marginBottom: 2 },
  walked: {
    position: 'absolute',
    left: 0,
    top: (TRACK_HEIGHT - 4) / 2,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.trail.progress,
  },
  checkpoint: {
    position: 'absolute',
    top: (TRACK_HEIGHT - 8) / 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background.warm,
    borderWidth: 2,
    borderColor: colors.trail.ahead,
  },
  checkpointPassed: {
    backgroundColor: colors.reward.gold,
    borderColor: colors.reward.goldDeep,
  },
  marker: {
    position: 'absolute',
    top: (TRACK_HEIGHT - MARKER) / 2,
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    backgroundColor: colors.surface.base,
    borderWidth: 3,
    borderColor: colors.brand.primary,
    ...shadows.subtle,
  },
  markerDone: {
    backgroundColor: colors.reward.gold,
    borderColor: colors.surface.base,
  },
  mountain: { marginRight: -4 },
});
