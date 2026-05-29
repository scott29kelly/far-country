/**
 * Collision geometry for the placeholder pyramid-city.
 *
 * Two mechanisms work together:
 *
 * 1. **AABB blockers** — 2D axis-aligned rectangles in the X-Z plane for the
 *    base walls, the summit throne, and the tree trunks. These block
 *    horizontally regardless of height (the base walls ring the plaza; the
 *    throne sits on the summit terrace where the player stands at y≈SUMMIT_Y;
 *    the trees stand on the plaza).
 *
 * 2. **Terrace risers** — the step pyramid's vertical faces. Rather than model
 *    each riser as a blocker, we read the terrain height via groundHeightAt():
 *    a horizontal step is blocked if it would climb more than MAX_STEP_UP onto
 *    a higher terrace *while the player is grounded*. Flying (airborne) clears
 *    the check, so the player ascends terraces with Space and walks off edges
 *    freely (a downward step is never blocked).
 *
 * Resolution strategy (in FirstPersonControls): X and Z steps are resolved
 * independently against horizontalBlocked() so the player slides along walls
 * and riser faces instead of sticking.
 */
import { groundHeightAt, TREE_POSITIONS, TREE_TRUNK_RADIUS } from "./world-geometry";
import {
  CITY_HALF,
  GATE_OFFSETS,
  GATE_WIDTH,
  SUMMIT_Y,
  WALL_THICKNESS,
} from "./points-of-interest";

export type Rect = {
  /** Inclusive min on X. */
  minX: number;
  /** Inclusive max on X. */
  maxX: number;
  /** Inclusive min on Z. */
  minZ: number;
  /** Inclusive max on Z. */
  maxZ: number;
};

/** Player radius in metres — keeps the camera from clipping the inside of walls. */
export const PLAYER_RADIUS = 0.6;

/**
 * Largest vertical rise a grounded player may step up without flying. The
 * pyramid risers are stepHeight (12m) tall, so any riser blocks; this only
 * exists to tolerate tiny float wobble in groundHeightAt at terrace seams.
 */
export const MAX_STEP_UP = 1.5;

/** Throne footprint at the summit. Slightly larger than the base so you don't bump it. */
const THRONE_HALF = 9.5;

/**
 * For a side of length 2 * CITY_HALF with gates at GATE_OFFSETS, return
 * the spans (start, end) of solid wall segments along that side.
 */
function wallSpans(): Array<[number, number]> {
  const half = CITY_HALF;
  const halfGate = GATE_WIDTH / 2;
  const cutouts = [...GATE_OFFSETS]
    .sort((a, b) => a - b)
    .map((o) => [o - halfGate, o + halfGate] as const);
  const spans: Array<[number, number]> = [];
  let cursor = -half;
  for (const [s, e] of cutouts) {
    if (s > cursor) spans.push([cursor, s]);
    cursor = e;
  }
  if (cursor < half) spans.push([cursor, half]);
  return spans;
}

/**
 * All solid wall + throne + tree rectangles in the X-Z plane.
 *
 * Wall thickness is grown by PLAYER_RADIUS on every face so we never clip
 * inside a wall in the first place.
 */
export function buildBlockers(): Rect[] {
  const spans = wallSpans();
  const r = PLAYER_RADIUS;
  const t = WALL_THICKNESS / 2 + r;
  const rects: Rect[] = [];

  // North wall (Z = -CITY_HALF), spans are X intervals.
  for (const [a, b] of spans) {
    rects.push({ minX: a - r, maxX: b + r, minZ: -CITY_HALF - t, maxZ: -CITY_HALF + t });
  }
  // South wall (Z = +CITY_HALF).
  for (const [a, b] of spans) {
    rects.push({ minX: a - r, maxX: b + r, minZ: CITY_HALF - t, maxZ: CITY_HALF + t });
  }
  // East wall (X = +CITY_HALF), spans are Z intervals.
  for (const [a, b] of spans) {
    rects.push({ minX: CITY_HALF - t, maxX: CITY_HALF + t, minZ: a - r, maxZ: b + r });
  }
  // West wall (X = -CITY_HALF).
  for (const [a, b] of spans) {
    rects.push({ minX: -CITY_HALF - t, maxX: -CITY_HALF + t, minZ: a - r, maxZ: b + r });
  }

  // Throne (axis-aligned square at the summit, footprint at origin in X-Z).
  rects.push({
    minX: -THRONE_HALF - r,
    maxX: THRONE_HALF + r,
    minZ: -THRONE_HALF - r,
    maxZ: THRONE_HALF + r,
  });

  // Tree trunks — small AABB around each trunk footprint (canopy is overhead).
  const trunkR = TREE_TRUNK_RADIUS + r;
  for (const [tx, tz] of TREE_POSITIONS) {
    rects.push({ minX: tx - trunkR, maxX: tx + trunkR, minZ: tz - trunkR, maxZ: tz + trunkR });
  }

  return rects;
}

export const BLOCKERS: Rect[] = buildBlockers();

export function inside(rect: Rect, x: number, z: number): boolean {
  return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
}

export function anyBlockerContains(rects: Rect[], x: number, z: number): boolean {
  for (const r of rects) if (inside(r, x, z)) return true;
  return false;
}

/**
 * Whether a horizontal step to (x, z) is blocked for a player whose feet are at
 * `feetY`. Combines AABB blockers with the terrace-riser height test. When
 * `airborne` is true, only AABB blockers apply (the player flies over risers).
 */
export function horizontalBlocked(
  feetY: number,
  x: number,
  z: number,
  airborne: boolean,
): boolean {
  if (anyBlockerContains(BLOCKERS, x, z)) return true;
  if (!airborne) {
    const ground = groundHeightAt(x, z);
    if (ground - feetY > MAX_STEP_UP) return true;
  }
  return false;
}

// Re-export so movement code can pull the terrain sampler from one place.
export { groundHeightAt, SUMMIT_Y };
