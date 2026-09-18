import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { pressScale, springs } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
};

/** Shared press micro-interaction. Honors the system "Reduce Motion" setting. */
export function PressableScale({
  style,
  scaleTo = pressScale,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      style={[style, animatedStyle]}
      onPressIn={(event) => {
        if (!reduceMotion) scale.set(withSpring(scaleTo, springs.press));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        if (!reduceMotion) scale.set(withSpring(1, springs.press));
        onPressOut?.(event);
      }}
      {...rest}
    />
  );
}
