/**
 * Walk collision + walkable floors for the Ezekiel temple compound — the
 * STATUS debt "dwellings/temple floors and collision remain open" (temple
 * half). Before this, a walker phased through the perimeter wall, the
 * sanctuary and the altar, and stood at meadow height inside the courts.
 *
 * Shared-table discipline (the cityCollide idiom, taken one step further):
 * cityCollide DERIVES its volumes from cityModel's tables, which works
 * because the city massing is a handful of concentric square rings. The
 * temple is forty-odd individually placed boxes whose layout arithmetic
 * lives inline in the builder, so deriving a parallel description here would
 * be exactly the hand-mirrored copy the idiom forbids. Instead `buildTemple`
 * RECORDS the world AABB of each mass as it creates it (`solidBox`), and
 * this module consumes that list — the collider set cannot desync from the
 * geometry because it IS the geometry.
 *
 * What collides (the MASSING): the plinth, the perimeter wall segments with
 * their three real gate gaps (east/north/south — no west gate, Ezek
 * 42:15-20), corner towers, gatehouse jambs and lintels, the inner terrace,
 * the altar stack and its east steps, the house platform and its steps, the
 * side-chamber shoulder and sanctuary core, the western building and the
 * priests' chamber blocks. What does NOT collide (filigree, the same class
 * cityCollide excludes): merlons, lattice windows, arch heads, trim course
 * bands and cornice caps, the vestibule pillars, the altar horns, and the
 * glowing portal membranes.
 *
 * Floors fall out of the same list: the top face of any mass is walkable
 * when it is within reach of the feet (FLOOR_STEP_UP_M, shared with
 * cityCollide), which is what makes the outer court, the inner terrace, and
 * the house platform real pavements rather than places to wade through.
 *
 * The resolvers are generic over any recorded solids list — the DWELLING
 * CAMPUS (Dwellings.ts, the other half of the same debt) wraps these exact
 * functions over its own record-at-build AABBs, so both content sites share
 * one collision semantics and one probe-tested resolver.
 *
 * Pure module: no three.js, no DOM — CPU-probe testable.
 */

import type { MoveProbe } from '../core/FlyCamera';
import { FLOOR_STEP_UP_M } from './cityCollide';
import type { TempleAabb } from './Temple';

/** Lateral clearance kept off every face (world m — the compound is 1:1). */
const SKIN = 0.35;
/**
 * A mass whose top is at most this far above the body does not block
 * laterally — it is a curb or a stair tread to be stepped over, not a wall.
 * Without it the plinth (a 0.8 m lip ringing the whole compound) walls the
 * gates off as surely as the masonry does, and the counted stair flights
 * (Ezek 40:22, 26, 49) become impassable ridges. Deliberately far tighter
 * than FLOOR_STEP_UP_M: the floor rule governs what a walker may STAND on
 * once past a face, this governs what they may walk THROUGH, and a 3.15 m
 * perimeter wall must stay solid from the outer court.
 */
const STEP_OVER = 1.0;
/** Swept-resolve substep (world m), matching cityCollide's tunnel guard. */
const SUBSTEP = 1.0;
/** eye height above the feet (matches FlyCamera's EYE_HEIGHT) */
const EYE_M = 1.7;
/** No floor is claimed below this drop from the feet — a walker on the
 *  outer court must not be yanked down onto the meadow-level plinth skirt. */
const FLOOR_REACH_DOWN_M = 60;

/** Cheap whole-compound bound so the common frame costs one comparison. */
export interface TempleBounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}

export function templeBounds(solids: readonly TempleAabb[]): TempleBounds {
  const b: TempleBounds = {
    x0: Infinity,
    x1: -Infinity,
    z0: Infinity,
    z1: -Infinity,
    y0: Infinity,
    y1: -Infinity,
  };
  for (const s of solids) {
    if (s.x0 < b.x0) b.x0 = s.x0;
    if (s.x1 > b.x1) b.x1 = s.x1;
    if (s.z0 < b.z0) b.z0 = s.z0;
    if (s.z1 > b.z1) b.z1 = s.z1;
    if (s.y0 < b.y0) b.y0 = s.y0;
    if (s.y1 > b.y1) b.y1 = s.y1;
  }
  return b;
}

/** Is (x, z) inside a solid temple mass at height y? WORLD units. */
export function templeBlockedWorld(
  solids: readonly TempleAabb[],
  x: number,
  z: number,
  y: number,
): boolean {
  for (const s of solids) {
    if (
      y >= s.y0 &&
      y < s.y1 &&
      s.y1 - y > STEP_OVER &&
      x > s.x0 - SKIN &&
      x < s.x1 + SKIN &&
      z > s.z0 - SKIN &&
      z < s.z1 + SKIN
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve a proposed horizontal move against the compound. WORLD units.
 * Axis-separated incremental substeps — a blocked axis stops at the face
 * while the other keeps sliding, and no single frame (however long a
 * dt-spike makes it) can tunnel a wall, because each candidate advances one
 * substep from where the body actually stands. A start already inside a
 * solid moves freely: programmatic poses place the camera anywhere and must
 * never be trapped (cityCollide's exact-placement semantics).
 */
export function resolveTempleMoveWorld(
  solids: readonly TempleAabb[],
  bounds: TempleBounds,
  fx: number,
  fz: number,
  tx: number,
  tz: number,
  y: number,
): { x: number; z: number } {
  if (y < bounds.y0 || y >= bounds.y1) return { x: tx, z: tz };
  const dist = Math.hypot(tx - fx, tz - fz);
  // whole move stays clear of the compound bound (the common frame)
  if (
    fx + dist < bounds.x0 - SKIN ||
    fx - dist > bounds.x1 + SKIN ||
    fz + dist < bounds.z0 - SKIN ||
    fz - dist > bounds.z1 + SKIN
  ) {
    return { x: tx, z: tz };
  }
  if (templeBlockedWorld(solids, fx, fz, y)) return { x: tx, z: tz };
  if (dist === 0) return { x: tx, z: tz };
  const steps = Math.max(1, Math.ceil(dist / SUBSTEP));
  const stepX = (tx - fx) / steps;
  const stepZ = (tz - fz) / steps;
  let cx = fx;
  let cz = fz;
  for (let i = 1; i <= steps; i++) {
    const nx = cx + stepX;
    if (!templeBlockedWorld(solids, nx, cz, y)) cx = nx;
    const nz = cz + stepZ;
    if (!templeBlockedWorld(solids, cx, nz, y)) cz = nz;
  }
  return { x: cx, z: cz };
}

/**
 * Highest walkable temple surface at (x, z) whose top is <= maxFloorY —
 * -1e6 when none. Every recorded mass contributes its top face; the y-aware
 * cap is what keeps the sanctuary roof from claiming a walker standing in
 * the court beside it.
 */
export function templeFloorWorldY(
  solids: readonly TempleAabb[],
  x: number,
  z: number,
  maxFloorY: number,
  minFloorY: number,
): number {
  let best = -1e6;
  for (const s of solids) {
    if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
    if (s.y1 <= maxFloorY && s.y1 > best && s.y1 >= minFloorY) best = s.y1;
  }
  return best;
}

/**
 * Compose an existing MoveProbe with the temple's lateral collision. The
 * city wrap runs first (they are 5.6 km apart and never both claim a frame),
 * so this chains rather than replaces.
 */
export function wrapMoveWithTempleCollision(
  base: MoveProbe | null,
  solids: readonly TempleAabb[],
): MoveProbe {
  const bounds = templeBounds(solids);
  return (fromX, fromZ, toX, toZ, y) => {
    const first = base ? base(fromX, fromZ, toX, toZ, y) : { x: toX, z: toZ };
    return resolveTempleMoveWorld(solids, bounds, fromX, fromZ, first.x, first.z, y);
  };
}

/**
 * Compose a GroundProbe with the temple floors — the cityCollide wrap idiom
 * (y-aware, so stacked pavements only claim when the querying eye could be
 * standing on them). Water passes through untouched.
 */
export function wrapGroundProbeWithTempleFloors(
  base: (x: number, z: number, y?: number) => { ground: number; water: number },
  solids: readonly TempleAabb[],
): (x: number, z: number, y?: number) => { ground: number; water: number } {
  const bounds = templeBounds(solids);
  return (x, z, y) => {
    const g = base(x, z, y);
    if (x < bounds.x0 || x > bounds.x1 || z < bounds.z0 || z > bounds.z1) return g;
    // Without a y the caller wants the ground-level answer (map placement,
    // navigation) — only surfaces at or below the compound's base pavement
    // may claim, never the sanctuary roof.
    const feet = y === undefined ? bounds.y0 : y - EYE_M;
    const maxFloor = feet + FLOOR_STEP_UP_M;
    const floor = templeFloorWorldY(solids, x, z, maxFloor, feet - FLOOR_REACH_DOWN_M);
    if (floor === -1e6) return g;
    return { ground: Math.max(g.ground, floor), water: g.water };
  };
}
