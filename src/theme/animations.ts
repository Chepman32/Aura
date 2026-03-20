import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * Bouncy spring — used for playful press feedback and list item entrances.
 * Low damping produces visible overshoot.
 */
export const SPRING_BOUNCY: WithSpringConfig = {
  damping: 12,
  stiffness: 180,
  mass: 0.5,
};

/**
 * Stiff spring — used for snappy UI transitions that settle quickly.
 * High stiffness + damping eliminates overshoot.
 */
export const SPRING_STIFF: WithSpringConfig = {
  damping: 20,
  stiffness: 300,
};

/**
 * Gentle spring — used for subtle background animations and opacity fades.
 * Low stiffness makes motion feel unhurried.
 */
export const SPRING_GENTLE: WithSpringConfig = {
  damping: 15,
  stiffness: 120,
};
