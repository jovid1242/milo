import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { effects, type ImageAsset } from '@/constants/assets';
import { durations } from '@/theme';

export type PerfectCelebrationProps = {
  mascot: ImageAsset;
  width: number;
  /** A perfect run adds slow golden rays and one spark of sparkles behind Milo. */
  perfect: boolean;
};

/** Milo at the result, celebrating once — then everything rests. */
export function PerfectCelebration({ mascot, width, perfect }: PerfectCelebrationProps) {
  const reduceMotion = useReducedMotion();
  const height = Math.round((width * mascot.height) / mascot.width);
  // The glow may reach a little past Milo, but never up into the progress bar.
  const raysWidth = Math.round(width * 1.4);
  const raysHeight = Math.round(
    (raysWidth * effects.perfectRays.height) / effects.perfectRays.width,
  );
  const raysOverflow = Math.max(0, Math.round((raysHeight - height) / 2));

  const rays = useSharedValue(0);
  const sparkle = useSharedValue(0);
  useEffect(() => {
    if (!perfect) return;
    rays.set(withTiming(1, { duration: 2600, easing: Easing.out(Easing.cubic) }));
    sparkle.set(
      withSequence(
        withDelay(250, withTiming(1, { duration: 400 })),
        withDelay(700, withTiming(0, { duration: 700 })),
      ),
    );
  }, [perfect, rays, sparkle]);

  const raysStyle = useAnimatedStyle(() => ({
    opacity: Math.min(0.85, rays.get() * 3),
    transform: reduceMotion
      ? []
      : [{ rotate: `${rays.get() * 24}deg` }, { scale: 0.8 + rays.get() * 0.2 }],
  }));
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkle.get(),
    transform: reduceMotion ? [] : [{ scale: 0.85 + sparkle.get() * 0.2 }],
  }));

  return (
    <View style={[styles.hero, { height, marginTop: perfect ? raysOverflow : 0 }]}>
      {perfect ? (
        <Animated.View style={[styles.layer, raysStyle]}>
          <AssetImage asset={effects.perfectRays} width={raysWidth} />
        </Animated.View>
      ) : null}
      <Animated.View entering={ZoomIn.duration(durations.slow)}>
        <AssetImage asset={mascot} width={width} />
      </Animated.View>
      {perfect ? (
        <Animated.View style={[styles.layer, sparkleStyle]}>
          <AssetImage asset={effects.sparkles} width={Math.round(width * 1.3)} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', justifyContent: 'center' },
  layer: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
