import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, layout, radius, spacing } from '@/theme';

export type SettingToggleRowProps = {
  icon: LucideIcon;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SettingToggleRow({
  icon: Icon,
  label,
  description,
  value,
  onValueChange,
}: SettingToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Icon size={18} color={colors.text.brand} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" color="secondary">
          {description}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={label}
        accessibilityHint={description}
        trackColor={{ false: colors.border.default, true: colors.brand.primary }}
        thumbColor={colors.surface.base}
        ios_backgroundColor={colors.border.default}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: layout.minTouchTarget + 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.brand.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing[1] },
});
