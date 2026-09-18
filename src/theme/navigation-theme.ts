import { DefaultTheme, type Theme } from 'expo-router';

import { colors } from './tokens/colors';

export const navigationTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.brand.primary,
    background: colors.background.base,
    card: colors.surface.base,
    text: colors.text.primary,
    border: colors.border.subtle,
    notification: colors.reward.goldDeep,
  },
};
