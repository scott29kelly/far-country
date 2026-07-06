/** Shared easing curves — one definition for the boot rite's descent and the
 *  camera arrival (they must feel like the same motion). */

export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
