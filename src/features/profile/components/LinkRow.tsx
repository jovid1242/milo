import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText, PressableScale } from '@/components/ui';
import { triggerHaptic } from '@/services/haptics/haptics';
import { colors, layout, radius, spacing } from '@/theme';

export type LinkRowProps = {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onPress: () => void;
};

export function LinkRow({ icon: Icon, label, hint, onPress }: LinkRowProps) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={styles.row}
      onPress={() => {
        triggerHaptic('press');
        onPress();
      }}>
      <View style={styles.iconWrap}>
        <Icon size={18} color={colors.text.brand} strokeWidth={2} />
      </View>
      <AppText variant="bodyStrong" style={styles.label}>
        {label}
      </AppText>
      <ChevronRight size={18} color={colors.text.tertiary} strokeWidth={2} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    minHeight: layout.minTouchTarget + 8,
  },
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
