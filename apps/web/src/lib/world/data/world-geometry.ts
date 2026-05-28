/**
 * Shared geometry constants for the Phase 3 world.
 *
 * Lives next to points-of-interest.ts but isolated so the river/tree
 * additions don't pollute the POI module. Multiple components and the
 * collision module read from here, so changes propagate consistently.
 */
import { CITY_HALF } from "./points-of-interest";

/**
 * River of the Water of Life — the south meridian channel.
 *
 * Runs from just south of the throne footprint (z ≈ 12, clear of the throne
 * collision box at z = ±9.5) to just inside the south gate (z ≈ 96, before
 * the wall). Width is a placeholder; same scale-deferred status as the
 * city walls (see ADR 0009 rule 6).
 */
export const RIVER = {
  startZ: 12,
  endZ: CITY_HALF - 4,
  width: 5,
  /** Tiny offset above the gold street to avoid z-fighting. */
  surfaceY: 0.02,
} as const;

/**
 * Tree of Life positions. Rev 22:2: "on either side of the river" — the
 * project renders this as two visible trees flanking the river at its
 * midpoint, which is the most spatially intuitive reading of the phrase.
 * The dataset preserves the singular "tree of life" descriptor; the
 * geometric pair is the rendering choice, not a textual claim of two trees.
 *
 * Each tree's trunk has a small AABB blocker added to collision so the
 * player walks around it.
 */
export const TREE_POSITIONS: Array<[number, number]> = [
  [-RIVER.width / 2 - 4, (RIVER.startZ + RIVER.endZ) / 2],
  [RIVER.width / 2 + 4, (RIVER.startZ + RIVER.endZ) / 2],
];

export const TREE_TRUNK_RADIUS = 0.8;
export const TREE_TRUNK_HEIGHT = 8;
export const TREE_CANOPY_RADIUS = 4.5;
