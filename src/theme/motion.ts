/**
 * One place for motion feel, so every screen moves the same way.
 * Springs for things people touch, timings for things that simply appear.
 */
export const spring = {
  /** Buttons and chips: quick, barely overshoots. */
  snappy: { damping: 18, stiffness: 420, mass: 0.6 },
  /** Medals, chests, celebrations: a confident bounce. */
  bouncy: { damping: 9, stiffness: 170, mass: 0.8 },
  /** Cards settling into place. */
  gentle: { damping: 16, stiffness: 140, mass: 1 },
} as const;

export const duration = {
  quick: 160,
  base: 260,
  slow: 520,
  sweep: 1100,
} as const;

/** Delay between items in a staggered entrance. */
export const stagger = 70;
