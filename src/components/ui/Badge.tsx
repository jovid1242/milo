import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, type TextColor } from '@/theme';

import { AppText } from './AppText';

type BadgeTone = 'neutral' | 'brand' | 'reward' | 'danger' | 'wood';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
};

const BACKGROUNDS: Record<BadgeTone, string> = {
  neutral: colors.surface.warm,
  brand: colors.brand.tint,
  reward: colors.reward.goldSoft,
  danger: colors.feedback.dangerSoft,
  wood: colors.wood.light,
};

const LABEL_COLORS: Record<BadgeTone, TextColor> = {
  neutral: 'secondary',
  brand: 'brand',
  reward: 'reward',
  danger: 'danger',
  wood: 'wood',
};

/** Small status pill (not an achievement badge — those are images). */
export function Badge({ label, tone = 'neutral', icon: Icon, style }: BadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: BACKGROUNDS[tone] }, style]}>
      {Icon ? <Icon size={13} color={colors.text[LABEL_COLORS[tone]]} strokeWidth={2.5} /> : null}
      <AppText variant="caption" color={LABEL_COLORS[tone]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[1],
    borderRadius: radius.pill,
  },
});
