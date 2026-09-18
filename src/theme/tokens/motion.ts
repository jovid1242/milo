import { Easing, type WithSpringConfig } from 'react-native-reanimated';

/** Durations in ms (design-system `motion.duration`, plus reward moments). */
export const durations = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 450,
  reward: 700,
  celebration: 900,
} as const;

export const easings = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  decelerate: Easing.bezier(0, 0, 0, 1),
  accelerate: Easing.bezier(0.3, 0, 1, 1),
} as const;

export const springs = {
  /** Button press / release. */
  press: { damping: 22, stiffness: 420, mass: 0.6 },
  /** Elements settling into place (badges, Milo entrance). */
  gentle: { damping: 18, stiffness: 170, mass: 1 },
  /** Playful overshoot for rewards. */
  bouncy: { damping: 11, stiffness: 190, mass: 0.9 },
} as const satisfies Record<string, WithSpringConfig>;

export const pressScale = 0.97;
