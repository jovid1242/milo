import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { AppText } from '@/components/ui';
import { mascots } from '@/constants/assets';
import { colors, durations, easings, radius, spacing, springs } from '@/theme';

import type { Greeting } from '../logic/greeting';

export type MiloGreetingProps = {
  greeting: Greeting;
  miloWidth: number;
  /** Set when the day was just completed: Milo hops once. */
  celebrateKey: number | null;
};

/** Milo, the companion on the trail, with one short line about today. */
export function MiloGreeting({ greeting, miloWidth, celebrateKey }: MiloGreetingProps) {
  const reduceMotion = useReducedMotion();
  const hop = useSharedValue(0);

  useEffect(() => {
    if (celebrateKey === null || reduceMotion) return;
    hop.set(
      withSequence(
        withTiming(-18, { duration: 200, easing: easings.decelerate }),
        withSpring(0, springs.bouncy),
      ),
    );
  }, [celebrateKey, reduceMotion, hop]);

  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.get() }] }));

  return (
    <View style={styles.row}>
      <Animated.View entering={FadeInDown.duration(durations.slow).delay(60)}>
        <Animated.View style={hopStyle}>
          <AssetImage
            asset={mascots[greeting.mascot]}
            width={miloWidth}
            transition={durations.normal}
          />
        </Animated.View>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(durations.normal).delay(160)} style={styles.bubble}>
        <View style={styles.tail} />
        {/* Re-keyed per line, so a new line fades in instead of snapping. */}
        <Animated.View
          key={`${greeting.title}|${greeting.subtitle}`}
          entering={FadeIn.duration(durations.normal)}
          accessible
          accessibilityLabel={`Milo says: ${greeting.title} ${greeting.subtitle}`}
          style={styles.lines}>
          <AppText variant="speech">{greeting.title}</AppText>
          <AppText variant="caption" color="secondary">
            {greeting.subtitle}
          </AppText>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const TAIL = 14;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  bubble: {
    flex: 1,
    backgroundColor: colors.surface.base,
    borderRadius: radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.warm,
  },
  // A small rotated square reads as the bubble's tail pointing at Milo.
  tail: {
    position: 'absolute',
    left: -TAIL / 2,
    top: '50%',
    marginTop: -TAIL / 2,
    width: TAIL,
    height: TAIL,
    backgroundColor: colors.surface.base,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.warm,
    transform: [{ rotate: '45deg' }],
  },
  lines: { gap: 2 },
});
