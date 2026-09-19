import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, type TextColor, type TypographyVariant } from '@/theme';

export type GapSentenceProps = {
  before: string;
  after: string;
  /** The right answer, shown in the gap once the question is answered. */
  fill: string | null;
  /** The filled gap's color: the right answer by default; a neutral pick in the exam. */
  fillColor?: TextColor;
  variant?: TypographyVariant;
};

/** A sentence with one gap: an underlined blank, then the right answer in it. */
export function GapSentence({
  before,
  after,
  fill,
  fillColor = 'brand',
  variant = 'title1',
}: GapSentenceProps) {
  return (
    <AppText
      variant={variant}
      accessibilityRole="header"
      accessibilityLabel={`${before}${fill ?? 'blank'}${after}`}>
      {before}
      <AppText variant={variant} color={fill ? fillColor : 'wood'} style={styles.gap}>
        {fill ?? '______'}
      </AppText>
      {after}
    </AppText>
  );
}

const styles = StyleSheet.create({
  gap: { textDecorationLine: 'underline', textDecorationColor: colors.wood.light },
});
