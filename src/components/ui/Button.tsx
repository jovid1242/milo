import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { playSound, type SoundName } from '@/services/audio/sound-manager';
import { triggerHaptic, type HapticPattern } from '@/services/haptics/haptics';
import { colors, radius, spacing, type TextColor } from '@/theme';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Defaults to a light impact; pass `null` for silent controls. */
  haptic?: HapticPattern | null;
  /** Off by default — sound is reserved for meaningful actions. */
  sound?: SoundName | null;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const HEIGHTS: Record<ButtonSize, number> = { sm: 40, md: 48, lg: 56 };
const RADII: Record<ButtonSize, number> = { sm: radius.sm, md: radius.md, lg: radius.lg };

const BACKGROUNDS: Record<ButtonVariant, string> = {
  primary: colors.brand.primary,
  secondary: colors.surface.warm,
  ghost: 'transparent',
  danger: colors.feedback.dangerSoft,
};

const LABEL_COLORS: Record<ButtonVariant, TextColor> = {
  primary: 'inverse',
  secondary: 'primary',
  ghost: 'brand',
  danger: 'danger',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  haptic = 'press',
  sound = null,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const isInteractive = !disabled && !loading;
  const labelColor: TextColor = disabled ? 'disabled' : LABEL_COLORS[variant];

  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      disabled={!isInteractive}
      onPress={() => {
        if (haptic) triggerHaptic(haptic);
        if (sound) playSound(sound);
        onPress();
      }}
      style={[
        styles.base,
        {
          height: HEIGHTS[size],
          borderRadius: RADII[size],
          backgroundColor: BACKGROUNDS[variant],
          borderWidth: variant === 'secondary' ? 1 : 0,
          opacity: disabled ? 0.55 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.text.inverse : colors.brand.primary}
        />
      ) : (
        <View style={styles.content}>
          {Icon ? (
            <Icon size={size === 'sm' ? 16 : 18} color={colors.text[labelColor]} strokeWidth={2} />
          ) : null}
          <AppText variant={size === 'sm' ? 'label' : 'bodyStrong'} color={labelColor}>
            {label}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    borderColor: colors.border.warm,
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
});
