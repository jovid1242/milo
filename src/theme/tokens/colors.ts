import { palette } from './palette';

/**
 * Semantic color tokens (light UI only — design-system: theme "light-only").
 *
 * Rules:
 * - forest is the brand/interactive color;
 * - gold is reserved for rewards, progress and achievements (fills, not body text);
 * - wood is for warm details (overlines, dividers in warm areas);
 * - text colors meet WCAG AA on white, except `tertiary` (large/non-essential text only).
 */
export const colors = {
  background: {
    base: palette.white,
    warm: palette.cream50,
    sunken: palette.ink50,
  },
  surface: {
    base: palette.white,
    warm: palette.cream100,
    warmStrong: palette.cream200,
    brandSoft: palette.forest50,
    inverse: palette.forest900,
  },
  text: {
    primary: palette.ink900,
    secondary: palette.ink500,
    tertiary: palette.ink400,
    disabled: palette.ink300,
    inverse: palette.white,
    brand: palette.forest700,
    wood: palette.wood600,
    reward: palette.gold700,
    danger: palette.red700,
  },
  border: {
    subtle: palette.ink100,
    default: palette.ink200,
    warm: palette.cream300,
    brand: palette.forest600,
  },
  brand: {
    primary: palette.forest600,
    pressed: palette.forest700,
    deep: palette.forest900,
    soft: palette.forest50,
    tint: palette.forest100,
  },
  reward: {
    gold: palette.gold400,
    goldDeep: palette.gold500,
    goldSoft: palette.gold100,
    track: palette.cream200,
  },
  wood: {
    light: palette.wood200,
    base: palette.wood500,
    dark: palette.wood700,
  },
  feedback: {
    success: palette.forest600,
    successSoft: palette.forest50,
    danger: palette.red500,
    dangerSoft: palette.red50,
    warning: palette.gold500,
    warningSoft: palette.gold50,
  },
  /** Map-like trails: the walked part is solid, the way ahead is dotted. */
  trail: {
    walked: palette.forest600,
    ahead: palette.wood300,
    progress: palette.gold400,
  },
  streak: palette.ember500,
  /** The 90-day map: each chapter's environment, always light. */
  journey: {
    beginning: palette.cream100,
    momentum: palette.forest50,
    habit: palette.river50,
    growth: palette.sky50,
    summit: palette.white,
  },
  overlay: {
    scrim: 'rgba(21, 26, 22, 0.45)',
    pressed: 'rgba(21, 26, 22, 0.04)',
  },
} as const;

/** Colors an `AppText` may use. */
export type TextColor = keyof typeof colors.text;
