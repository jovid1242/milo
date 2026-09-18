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

const DURATION_MS = 2600;

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

  useEffect(() => {
    confettiOpacity.set(
      withSequence(
        withTiming(1, { duration: 180 }),
        withDelay(1300, withTiming(0, { duration: 800 })),
      ),
    );
    confetti.set(withTiming(1, { duration: 2300, easing: Easing.out(Easing.quad) }));
    sparkle.set(
      withSequence(
        withDelay(120, withTiming(1, { duration: 380 })),
        withDelay(450, withTiming(0, { duration: 650 })),
      ),
    );
  }, [confetti, confettiOpacity, sparkle]);

  const confettiStyle = useAnimatedStyle(() => ({
    opacity: confettiOpacity.get(),
    transform: reduceMotion
      ? []
      : [{ translateY: -60 + confetti.get() * 140 }, { scale: 0.94 + confetti.get() * 0.1 }],
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
