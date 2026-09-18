import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing, type SpacingToken } from '@/theme';

export type CardProps = {
  children: ReactNode;
  tone?: 'base' | 'warm' | 'brand';
  padding?: SpacingToken;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Use sparingly: the design system prefers whitespace and separators over
 * wrapping everything in cards.
 */
export function Card({ children, tone = 'base', padding = 4, elevated = false, style }: CardProps) {
  const backgrounds = {
    base: colors.surface.base,
    warm: colors.surface.warm,
    brand: colors.surface.brandSoft,
  } as const;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: backgrounds[tone], padding: spacing[padding] },
        elevated ? shadows.card : styles.bordered,
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg },
  bordered: { borderWidth: 1, borderColor: colors.border.subtle },
});
