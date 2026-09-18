/** 4pt spacing scale (design-system `spacing`). */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export type SpacingToken = keyof typeof spacing;

export const layout = {
  screenPaddingX: spacing[5],
  sectionGap: 28,
  maxContentWidth: 600,
  /** Minimum touch target (design-system accessibility.minimumTouchTarget). */
  minTouchTarget: 44,
} as const;
