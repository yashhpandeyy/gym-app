import { applyBrandOverride, baseBrand, type Brand, type BrandOverride } from './brand';

/**
 * The brand currently on screen, readable from plain functions (money formatting, opening hours,
 * pass codes) that can't use a React hook. The store keeps it in step with the signed-in gym.
 */
let current: Brand = baseBrand;

export const activeBrand = () => current;

export function setActiveOverride(o: BrandOverride | null) {
  current = applyBrandOverride(baseBrand, o);
}
