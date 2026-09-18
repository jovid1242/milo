import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AssetImage } from '@/components/AssetImage';
import { effects } from '@/constants/assets';

const DURATION_MS = 2000;

/**
 * The Day Complete moment: confetti drifts down over the top of Home and a
 * burst of sparkles lights up around Milo, then everything is unmounted. Plays
 * once per `playKey` — reopening Home never replays it.
 */
export function CelebrationOverlay({ playKey }: { playKey: number | null }) {
  const [finishedKey, setFinishedKey] = useState<number | null>(null);

  useEffect(() => {
    if (playKey === null) return;
    const timer = setTimeout(() => setFinishedKey(playKey), DURATION_MS);
    return () => clearTimeout(timer);
  }, [playKey]);

  if (playKey === null || playKey === finishedKey) return null;
  return <Burst key={playKey} />;
}

function Burst() {
  const reduceMotion = useReducedMotion();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const confetti = useSharedValue(0);
  const confettiOpacity = useSharedValue(0);
  const sparkle = useSharedValue(0);

  // A quick sweep: confetti falls through the header and is gone in under two
  // seconds, so "Day 12 complete" is readable almost at once.
  useEffect(() => {
    confettiOpacity.set(
      withSequence(
        withTiming(0.9, { duration: 160 }),
        withDelay(600, withTiming(0, { duration: 750 })),
      ),
    );
    confetti.set(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }));
    sparkle.set(
      withSequence(
        withDelay(120, withTiming(1, { duration: 360 })),
        withDelay(400, withTiming(0, { duration: 600 })),
      ),
    );
  }, [confetti, confettiOpacity, sparkle]);

  const confettiStyle = useAnimatedStyle(() => ({
    opacity: confettiOpacity.get(),
    transform: reduceMotion
      ? []
      : [{ translateY: -150 + confetti.get() * 190 }, { scale: 1 + confetti.get() * 0.06 }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkle.get(),
    transform: reduceMotion ? [] : [{ scale: 0.75 + sparkle.get() * 0.3 }],
  }));

  return (
    <>
      <Animated.View style={[styles.layer, { top: insets.top }, confettiStyle]}>
        <AssetImage asset={effects.confetti} width={width} />
      </Animated.View>
      <Animated.View
        style={[styles.layer, { top: insets.top + 96, left: width * 0.05 }, sparkleStyle]}>
        <AssetImage asset={effects.sparkles} width={width * 0.9} />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0 },
});
