/**
 * Shared geometry constants for the Phase 3 world.
 *
 * The city's vertical form follows Janet Willis's step-pyramid (terraced
 * ziggurat) reading of the New Jerusalem — see RENDERING-DECISIONS.md entry
 * #1, docs/sources/willis-new-jerusalem-model.md, and ADR 0009 rule 4. The
 * cube alternative (Holy-of-Holies reading) is preserved in that decision
 * record but not the rendered form.
 *
 * Scale stays the ~200m placeholder of the MVP (ADR 0009 rule 6): only the
 * *shape* changes here, not the deferred true-scale decision. The pyramid foot
 * (PYRAMID.baseHalf) is now narrower than CITY_HALF, leaving a walkable
 * street-of-gold plaza ring between the mountain and the walls/gates (which
 * stay at CITY_HALF).
 *
 * Multiple components and the collision module read from here, so changes
 * propagate consistently.
 */
import { CITY_HALF, PYRAMID, SUMMIT_Y } from "./points-of-interest";

// Re-exported so components/collision can pull the pyramid constants from the
// geometry module alongside the derived helpers. The constants themselves are
// defined in points-of-interest.ts to keep this module's import one-directional.
export { PYRAMID, SUMMIT_Y };

/**
 * Levels are indexed 0..steps. Level 0 is the base plaza at y=0 (so the walls
 * and gates keep their footing). Level `steps` is the summit. The half-width
 * shrinks linearly from base to summit; the terrace top rises by `stepHeight`
 * per level.
 */

/** Half-width of terrace level `i` (0 = base, steps = summit). */
export function halfAtLevel(i: number): number {
  const t = i / PYRAMID.steps;
  return PYRAMID.baseHalf + (PYRAMID.summitHalf - PYRAMID.baseHalf) * t;
}

/** Top-face Y of terrace level `i`. */
export function topYAtLevel(i: number): number {
  return i * PYRAMID.stepHeight;
}

export type Terrace = { level: number; half: number; topY: number };

/**
 * Rendered terrace boxes, levels 1..steps. Level 0 (the base plaza) is not a
 * box — it is the gold ground at y=0. Each box is a centred cube of footprint
 * `2*half` rising from y=0 to `topY`; nesting the boxes (tall+narrow at the
 * centre, short+wide at the rim) produces the step silhouette.
 */
export const TERRACES: Terrace[] = Array.from(
  { length: PYRAMID.steps },
  (_, k) => {
    const level = k + 1;
    return { level, half: halfAtLevel(level), topY: topYAtLevel(level) };
  },
);

/**
 * Ground height (walkable terrace top) directly below an (x, z) point.
 *
 * A point at planar radius `r = max(|x|, |z|)` stands on the highest terrace
 * whose half-width still covers it. Because half-width shrinks and top-Y rises
 * with the level index, the deepest-inside (smallest r) point lands on the
 * summit. Returns 0 (the base plaza) outside the pyramid footprint.
 */
export function groundHeightAt(x: number, z: number): number {
  const r = Math.max(Math.abs(x), Math.abs(z));
  let best = 0;
  for (let i = 0; i <= PYRAMID.steps; i++) {
    if (halfAtLevel(i) >= r) {
      const t = topYAtLevel(i);
      if (t > best) best = t;
    }
  }
  return best;
}

/**
 * River of the Water of Life — a SINGLE river (Rev 22:1: "a river... flowing
 * from the throne"). Not branched: the four-headed river is Eden's (Gen 2:10),
 * dividing downstream of the garden; Revelation's universal scope is carried by
 * the foursquare twelve-gate city, not by multiplying the river. See
 * roadmap.md Phase 3 rendering note and ADR 0009.
 *
 * In the pyramid the river is a CASCADE: it falls from the summit throne down
 * the south meridian (x=0, +Z face), terrace by terrace, to the south gate.
 */
export const RIVER = {
  /** Channel width along x, in metres. */
  width: 5,
  /** Small offset above each terrace top / plaza to avoid z-fighting. */
  surfaceY: 0.05,
} as const;

/** A flat channel reach on a terrace top: runs along x=0 from z0 to z1 at `y`. */
export type CascadeChannel = { y: number; z0: number; z1: number };
/** A vertical fall ribbon down a riser face at planar z, from y0 down to y1. */
export type CascadeFall = { z: number; y0: number; y1: number };

/**
 * Decompose the cascade into flat channel reaches (one per terrace top, plus
 * the base plaza reach to the south gate) and vertical fall ribbons (one per
 * riser). Computed once and consumed by River.tsx.
 */
export function cascadeSegments(): {
  channels: CascadeChannel[];
  falls: CascadeFall[];
} {
  const channels: CascadeChannel[] = [];
  const falls: CascadeFall[] = [];

  for (let i = PYRAMID.steps; i >= 1; i--) {
    const topY = topYAtLevel(i);
    const outer = halfAtLevel(i); // south rim of this terrace
    const inner = i === PYRAMID.steps ? 0 : halfAtLevel(i + 1); // riser of the terrace above
    channels.push({ y: topY, z0: inner, z1: outer });
    falls.push({ z: outer, y0: topY, y1: topYAtLevel(i - 1) });
  }

  // Base plaza reach: from the foot of the pyramid (south rim of level 1) out
  // to the south wall / gate at z = CITY_HALF.
  channels.push({ y: 0, z0: halfAtLevel(1), z1: CITY_HALF });

  return { channels, falls };
}

/**
 * Tree of Life positions. Rev 22:2: "on either side of the river" — rendered as
 * two trees flanking the river near its base, on the plaza just inside the
 * south gate. The dataset preserves the singular "tree of life" descriptor;
 * the geometric pair is the rendering choice, not a textual claim of two trees.
 *
 * Each tree's trunk gets a small AABB blocker in collision so the player walks
 * around it.
 */
export const TREE_POSITIONS: Array<[number, number]> = [
  [-12, 80],
  [12, 80],
];

export const TREE_TRUNK_RADIUS = 0.7;
export const TREE_TRUNK_HEIGHT = 9;
export const TREE_CANOPY_RADIUS = 3.4;
