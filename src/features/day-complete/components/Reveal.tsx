import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { durations, easings } from '@/theme';

/**
 * Keeps its place in the layout and fades up when `shown` turns true — so the
 * celebration's beats appear one by one without the screen jumping.
 */
export function Reveal({
  shown,
  children,
  style,
}: {
  shown: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(shown ? 1 : 0);

  useEffect(() => {
    progress.set(
      withTiming(shown ? 1 : 0, { duration: durations.slow, easing: easings.decelerate }),
    );
  }, [shown, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * 12 }],
  }));

  return (
    <Animated.View
      style={[style, animatedStyle]}
      importantForAccessibility={shown ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!shown}>
      {children}
    </Animated.View>
  );
}
