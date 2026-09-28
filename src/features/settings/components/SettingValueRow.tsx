import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/theme';

export type SettingValueRowProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  onPress: () => void;
  accessibilityHint?: string;
};

/** A setting shown by its current value; tapping it opens a way to change it. */
export function SettingValueRow({
  icon: Icon,
  label,
  value,
  onPress,
  accessibilityHint,
}: SettingValueRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        <Icon size={18} color={colors.text.brand} strokeWidth={2} />
      </View>
      <AppText variant="bodyStrong" style={styles.label}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" color="brand">
        {value}
      </AppText>
      <ChevronRight size={18} color={colors.text.tertiary} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: layout.minTouchTarget + 12,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.overlay.pressed },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
});
