import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AssetImage } from '@/components/AssetImage';
import { mascots } from '@/constants/assets';

import type { MapMilo } from '../logic/map-layout';

/** Milo where the user is: a tiny idle bob, facing today's node. */
export function MiloMarker({ milo, active }: { milo: MapMilo; active: boolean }) {
  const reduceMotion = useReducedMotion();
  const bob = useSharedValue(0);
  const moving = active && !reduceMotion;

  useEffect(() => {
    if (!moving) {
      cancelAnimation(bob);
      bob.set(0);
      return;
    }
    bob.set(
      withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true),
    );
    return () => cancelAnimation(bob);
  }, [moving, bob]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -2.5 * bob.get() }, { scaleX: milo.facing === 'left' ? -1 : 1 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.milo, { left: milo.x, top: milo.y }, style]}>
      <AssetImage asset={mascots.walking} width={milo.width} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  milo: { position: 'absolute' },
});
