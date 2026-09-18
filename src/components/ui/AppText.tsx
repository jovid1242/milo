import { Text, type TextProps, type TextStyle } from 'react-native';

import { colors, typography, type TextColor, type TypographyVariant } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: TextStyle['textAlign'];
};

/** Every piece of text in the app goes through here: no ad-hoc font styles. */
export function AppText({
  variant = 'body',
  color = 'primary',
  align,
  style,
  maxFontSizeMultiplier,
  ...rest
}: AppTextProps) {
  const token = typography[variant];
  return (
    <Text
      style={[
        token.style,
        { color: colors.text[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? token.maxFontSizeMultiplier}
      {...rest}
    />
  );
}
