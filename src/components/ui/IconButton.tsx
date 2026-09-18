import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { triggerHaptic, type HapticPattern } from '@/services/haptics/haptics';
import { colors, layout, radius } from '@/theme';

import { PressableScale } from './PressableScale';

export type IconButtonProps = {
  icon: LucideIcon;
  /** Required: icon-only controls must be announced by screen readers. */
  accessibilityLabel: string;
  onPress: () => void;
  variant?: 'plain' | 'soft';
  disabled?: boolean;
  haptic?: HapticPattern | null;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function IconButton({
  icon: Icon,
  accessibilityLabel,
  onPress,
  variant = 'plain',
  disabled = false,
  haptic = 'press',
  style,
  testID,
}: IconButtonProps) {
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        if (haptic) triggerHaptic(haptic);
        onPress();
      }}
      style={[
        styles.base,
        variant === 'soft' && { backgroundColor: colors.surface.warm },
        disabled && styles.disabled,
        style,
      ]}>
      <Icon
        size={22}
        color={disabled ? colors.text.disabled : colors.text.primary}
        strokeWidth={2}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});
