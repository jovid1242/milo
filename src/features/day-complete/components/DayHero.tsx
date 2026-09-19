import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { effects, journey, mascots } from '@/constants/assets';
import { durations } from '@/theme';

const SCENE_RATIO = journey.campfire.height / journey.campfire.width;

export type DayHeroProps = {
  width: number;
  /** Milo hops in (first visit) instead of simply being there. */
  animated: boolean;
  /** Sparkles over the fire, once, when the celebration peaks. */
  sparkle: boolean;
};

/**
 * Camp reached: the lit campfire with Milo in front of it. (The dedicated
 * "day complete" illustration shows real brand logos and waits for visual
 * review, so the scene is composed from approved art.)
 */
export function DayHero({ width, animated, sparkle }: DayHeroProps) {
  const height = Math.round(width * SCENE_RATIO);
  const miloWidth = Math.round(width * 0.36);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!sparkle) return;
    glow.set(
      withSequence(
        withTiming(1, { duration: 380 }),
        withTiming(1, { duration: 500 }),
        withTiming(0, { duration: 700 }),
      ),
    );
  }, [sparkle, glow]);

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: glow.get(),
    transform: [{ scale: 0.8 + glow.get() * 0.25 }],
  }));

  return (
    <View
      style={[styles.scene, { width, height }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Milo at the camp. The fire is lit.">
      <Animated.View entering={animated ? FadeIn.duration(durations.slow) : undefined}>
        <AssetImage asset={journey.campfire} width={width} />
      </Animated.View>
      {sparkle ? (
        <Animated.View style={[styles.sparkles, { width }, sparkleStyle]} pointerEvents="none">
          <AssetImage asset={effects.sparkles} width={width} />
        </Animated.View>
      ) : null}
      <Animated.View
        entering={animated ? ZoomIn.springify().damping(13).stiffness(170).delay(120) : undefined}
        style={[styles.milo, { width: miloWidth, left: Math.round(width * 0.02) }]}>
        <AssetImage asset={mascots.idle} width={miloWidth} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { alignSelf: 'center' },
  sparkles: { position: 'absolute', top: '-12%', left: 0 },
  milo: { position: 'absolute', bottom: '-6%' },
});
