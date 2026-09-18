import type { TextStyle } from 'react-native';

/**
 * Two families:
 * - Fraunces (soft old-style serif) for display moments: day numbers, chapter
 *   and screen titles, big stats. Warm, bookish, adventure-journal feel.
 * - Inter for all UI text (design-system `typography.fontFamily.primary`).
 *
 * Font files are registered under these exact names in `theme/fonts.ts`.
 * Never combine a custom fontFamily with `fontWeight` — iOS would synthesize it.
 */
export const fontFamilies = {
  displaySemiBold: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

type TypographyToken = {
  style: TextStyle;
  /** Upper bound for Dynamic Type scaling so layouts stay intact. */
  maxFontSizeMultiplier: number;
};

export const typography = {
  displayLarge: {
    style: {
      fontFamily: fontFamilies.displayBold,
      fontSize: 44,
      lineHeight: 50,
      letterSpacing: -0.8,
    },
    maxFontSizeMultiplier: 1.2,
  },
  display: {
    style: {
      fontFamily: fontFamilies.displayBold,
      fontSize: 36,
      lineHeight: 42,
      letterSpacing: -0.6,
    },
    maxFontSizeMultiplier: 1.2,
  },
  title1: {
    style: {
      fontFamily: fontFamilies.displaySemiBold,
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.3,
    },
    maxFontSizeMultiplier: 1.3,
  },
  title2: {
    style: {
      fontFamily: fontFamilies.displaySemiBold,
      fontSize: 22,
      lineHeight: 28,
      letterSpacing: -0.2,
    },
    maxFontSizeMultiplier: 1.3,
  },
  /**
   * Large text in Russian (translations). Fraunces has no Cyrillic, so it
   * would fall back to the system font; Inter has it.
   */
  headline: {
    style: { fontFamily: fontFamilies.semiBold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
    maxFontSizeMultiplier: 1.3,
  },
  /** Milo's voice: short lines in speech bubbles. */
  speech: {
    style: {
      fontFamily: fontFamilies.displaySemiBold,
      fontSize: 20,
      lineHeight: 26,
      letterSpacing: -0.2,
    },
    maxFontSizeMultiplier: 1.3,
  },
  title3: {
    style: { fontFamily: fontFamilies.semiBold, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 },
    maxFontSizeMultiplier: 1.4,
  },
  bodyLarge: {
    style: { fontFamily: fontFamilies.regular, fontSize: 17, lineHeight: 25 },
    maxFontSizeMultiplier: 1.6,
  },
  body: {
    style: { fontFamily: fontFamilies.regular, fontSize: 15, lineHeight: 22 },
    maxFontSizeMultiplier: 1.6,
  },
  bodyMedium: {
    style: { fontFamily: fontFamilies.medium, fontSize: 15, lineHeight: 22 },
    maxFontSizeMultiplier: 1.6,
  },
  bodyStrong: {
    style: { fontFamily: fontFamilies.semiBold, fontSize: 15, lineHeight: 22 },
    maxFontSizeMultiplier: 1.6,
  },
  label: {
    style: { fontFamily: fontFamilies.semiBold, fontSize: 13, lineHeight: 18, letterSpacing: 0.1 },
    maxFontSizeMultiplier: 1.5,
  },
  caption: {
    style: { fontFamily: fontFamilies.medium, fontSize: 12, lineHeight: 16 },
    maxFontSizeMultiplier: 1.5,
  },
  overline: {
    style: {
      fontFamily: fontFamilies.bold,
      fontSize: 11,
      lineHeight: 14,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    maxFontSizeMultiplier: 1.4,
  },
  statNumber: {
    style: {
      fontFamily: fontFamilies.displaySemiBold,
      fontSize: 24,
      lineHeight: 28,
      letterSpacing: -0.3,
    },
    maxFontSizeMultiplier: 1.3,
  },
} as const satisfies Record<string, TypographyToken>;

export type TypographyVariant = keyof typeof typography;
