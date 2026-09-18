import type { ViewStyle } from 'react-native';

/**
 * Soft, warm-tinted shadows (wood-brown tint reads better on cream than grey).
 * `boxShadow` is cross-platform on the New Architecture.
 */
export const shadows = {
  none: {},
  subtle: { boxShadow: '0px 4px 12px rgba(76, 41, 12, 0.05)' },
  card: { boxShadow: '0px 8px 24px rgba(76, 41, 12, 0.08)' },
  floating: { boxShadow: '0px 12px 32px rgba(76, 41, 12, 0.12)' },
} as const satisfies Record<string, ViewStyle>;

export type ShadowToken = keyof typeof shadows;
