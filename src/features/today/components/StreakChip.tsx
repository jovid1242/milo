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
import { AppText } from '@/components/ui';
import { effects } from '@/constants/assets';
import { colors, radius, spacing, springs } from '@/theme';

/** The streak just grew: one bounce after `delayMs`, then the number updates. */
export type StreakBump = { key: number; from: number; delayMs: number };

export type StreakChipProps = {
  streak: number;
  bump: StreakBump | null;
};

const streakLabel = (streak: number) => (streak > 0 ? `${streak} day streak` : 'No streak yet');

export function StreakChip({ streak, bump }: StreakChipProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const tilt = useSharedValue(0);
  // The number waits for the bounce, so "11 → 12" lands together with its sound.
  const [landedKey, setLandedKey] = useState<number | null>(null);
  const shown = bump && bump.key !== landedKey ? bump.from : streak;

  const bumpKey = bump?.key ?? null;
  const delayMs = bump?.delayMs ?? 0;

  useEffect(() => {
    if (bumpKey === null) return;
    const timer = setTimeout(() => setLandedKey(bumpKey), delayMs);
    if (!reduceMotion) {
      scale.set(
        withDelay(
          delayMs,
          withSequence(withTiming(1.4, { duration: 150 }), withSpring(1, springs.bouncy)),
        ),
      );
      tilt.set(
        withDelay(
          delayMs,
          withSequence(
            withTiming(-12, { duration: 90 }),
            withTiming(9, { duration: 120 }),
            withSpring(0, springs.gentle),
          ),
        ),
      );
    }
    return () => clearTimeout(timer);
  }, [bumpKey, delayMs, reduceMotion, scale, tilt]);

  const fireStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }, { rotate: `${tilt.get()}deg` }],
  }));

  const lit = shown > 0;

  return (
    <View accessible accessibilityLabel={streakLabel(shown)} style={styles.chip}>
      <Animated.View style={[fireStyle, !lit && styles.unlit]}>
        <AssetImage asset={effects.streakFire} width={22} />
      </Animated.View>
      <AppText variant="label" color={lit ? 'primary' : 'tertiary'}>
        {streakLabel(shown)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingLeft: spacing[2],
    paddingRight: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  unlit: { opacity: 0.35 },
});
