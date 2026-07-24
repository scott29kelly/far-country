/**
 * Lateral wall/gate collision for the city massing (STATUS "What's NOT
 * built" — walkers used to phase through every pier and tier).
 *
 * Shared-table discipline (the fling-fix idiom): the collision volumes are
 * DERIVED from the same cityModel tables CityMassing builds its geometry
 * from — CITY_TIERS, PLINTH_HALF, GATE_OFFSETS/GATE_WIDTH,
 * foundationCourseSpans — and the REAL resolver is exported;
 * tools/probe-wallcollide.ts composes it, no hand-mirrored copy to desync.
 *
 * What collides (the MASSING): the solid inner plinth, the jasper wall ring
 * with its twelve REAL gate openings (Ezek 48:30-34 order,
 * RENDERING-DECISIONS #2 — a walker passes through a gate gap, never through
 * a wall segment), the jewelled foundation course girdling the wall base
 * (notched at the gates, same table the geometry uses), and the terrace/crown
 * tier masses at the glass plane. What does NOT collide (relief filigree,
 * same class throughout): pilasters, piers, arch frames, dentil/arcade
 * courses, jambs (they overlap wall-segment extents anyway), and the thin
 * pearl arch membranes.
 *
 * Collision is LATERAL; the WALK FLOORS live at the bottom of this module
 * (wrapGroundProbeWithCityFloors — plaza slab, plinth top, terrace-top
 * cornice rings, crown top), composed onto the scene groundProbe with the
 * river wrap's y-aware claim idiom. The base-tier collision volume extends
 * ~10 m below the plaza top because walkers approach on the meadow 2.8 m
 * below the plaza line the city group sits at.
 *
 * Like wrapGroundProbeWithRiver, the wrap takes plazaTopY and scale as
 * PARAMS — importing rimModel here would cycle through the scene modules.
 */

import type { MoveProbe } from '../core/FlyCamera';
import { ascentRamps, rampSurfaceY } from './ascentModel';
import {
  CITY_HALF,
  CITY_SUMMIT_Y,
  CITY_TIERS,
  cityTierBottoms,
  FOUNDATION_COURSE,
  foundationCourseSpans,
  GATE_OFFSETS,
  GATE_WIDTH,
  PLINTH_HALF,
  TIER_GLASS_PROUD,
  WALL_INNER,
} from './cityModel';

/** Lateral clearance kept off every face (0.6 m world at NJ_SCALE 20). */
const SKIN = 0.03;
/** Base-tier volume floor below the plaza top (10 m world — the meadow). */
const Y_MIN = -0.5;
/** Swept-resolve substep (1 m world) — with the INCREMENTAL sweep below,
 *  no move (however long a dt-spike frame makes it) can tunnel the wall
 *  or skip a 160 m gate opening: an axis only ever advances one substep
 *  from where it actually stands, so a solid band always interposes. */
const SUBSTEP = 0.05;

const TIER_BOTTOMS = cityTierBottoms();
const COURSE_SPANS = foundationCourseSpans();
/** processional ascent ramps (ascentModel — shared with CityMassing).
 *  zMin/zMax span wedge + head pad; the claim overlap (0.3) bridges the
 *  base-climb head to its slab-top landing with no unclaimed seam. */
const RAMPS = ascentRamps().map((r) => ({
  ...r,
  zMin: Math.min(r.zA, r.zB, r.pad?.z0 ?? Infinity),
  zMax: Math.max(r.zA, r.zB, r.pad?.z1 ?? -Infinity),
}));
const RAMP_CLAIM_OVERLAP = 0.3;
/** Outer radial face of the foundation course (103.4 local). */
const COURSE_OUTER = CITY_HALF + FOUNDATION_COURSE.thick - FOUNDATION_COURSE.inset;
const COURSE_TOP = FOUNDATION_COURSE.h - FOUNDATION_COURSE.sink;

/** Is (x, z) inside a solid city volume at local height y? LOCAL units. */
export function cityBlockedLocal(x: number, z: number, y: number): boolean {
  if (y < Y_MIN || y >= CITY_SUMMIT_Y) return false;
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const a = Math.max(ax, az); // Chebyshev radius — everything is square rings
  if (a >= COURSE_OUTER + SKIN) return false;
  // Ascent wedges + head pads: solid from their base pavement up to the
  // sloped surface (pads sit at the top height throughout). A body ON the
  // surface (probe y rides ~1.7 m world above it) stays free; a body
  // entering the flank below the surface is masonry-blocked.
  for (const r of RAMPS) {
    if (
      x > r.x0 - SKIN &&
      x < r.x1 + SKIN &&
      z > r.zMin - SKIN &&
      z < r.zMax + SKIN &&
      y >= r.y0 - 0.5 &&
      y < rampSurfaceY(r, z) - 0.25
    ) {
      return true;
    }
  }
  if (y >= CITY_TIERS[0].h) {
    // terrace/crown masses: solid squares at the glass plane
    for (let i = 1; i < CITY_TIERS.length; i++) {
      if (y < TIER_BOTTOMS[i] + CITY_TIERS[i].h) {
        const proud = i < CITY_TIERS.length - 1 ? TIER_GLASS_PROUD : 0;
        return a < CITY_TIERS[i].half + proud + SKIN;
      }
    }
    return false;
  }
  // ---- base tier (extends down to Y_MIN — see module doc) ------------------
  if (a < PLINTH_HALF + SKIN) return true; // solid inner plinth
  const u = ax >= az ? z : x; // tangent coordinate on the dominant face
  // covered street-of-gold gallery between the plinth and the wall slab —
  // open space (the plaza-ring assemblies stand here; the base ascent climbs
  // here). Same WALL_INNER table the massing builds the slab from.
  if (a < WALL_INNER - SKIN) return false;
  if (a < CITY_HALF + SKIN) {
    // jasper wall slab — open only inside a gate gap (skin narrows it)
    return !GATE_OFFSETS.some((o) => Math.abs(u - o) < GATE_WIDTH / 2 - SKIN);
  }
  // jewelled foundation course outside the wall plane, notched at the gates
  if (y < COURSE_TOP) {
    return COURSE_SPANS.some((s) => u > s.u0 - SKIN && u < s.u1 + SKIN);
  }
  return false;
}

/**
 * Resolve a proposed horizontal move against the city volumes. LOCAL units.
 * Axis-separated swept substeps: a blocked axis is dropped while the other
 * continues, so oblique motion SLIDES along a face instead of sticking. A
 * start already inside a solid moves freely — programmatic poses can place
 * the camera anywhere (exact-placement semantics) and must never be trapped.
 */
export function resolveCityMoveLocal(
  fx: number,
  fz: number,
  tx: number,
  tz: number,
  y: number,
): { x: number; z: number } {
  if (y < Y_MIN || y >= CITY_SUMMIT_Y) return { x: tx, z: tz };
  const dist = Math.hypot(tx - fx, tz - fz);
  // Chebyshev radius changes by at most `dist` along the segment — the whole
  // move stays outside every volume (the overwhelmingly common frame)
  if (Math.max(Math.abs(fx), Math.abs(fz)) - dist >= COURSE_OUTER + SKIN) {
    return { x: tx, z: tz };
  }
  if (cityBlockedLocal(fx, fz, y)) return { x: tx, z: tz };
  if (dist === 0) return { x: tx, z: tz };
  const steps = Math.max(1, Math.ceil(dist / SUBSTEP));
  // Incremental sweep: each candidate advances ONE substep from the current
  // resolved position, never to the absolute interpolant. The old absolute
  // form let a single move long enough to span a whole solid band (a 100+ m
  // dt-spike frame at fly speed) land free beyond it and tunnel; a blocked
  // axis now simply stops at the face while the other keeps sliding.
  const stepX = (tx - fx) / steps;
  const stepZ = (tz - fz) / steps;
  let cx = fx;
  let cz = fz;
  for (let i = 1; i <= steps; i++) {
    const nx = cx + stepX;
    if (!cityBlockedLocal(nx, cz, y)) cx = nx;
    const nz = cz + stepZ;
    if (!cityBlockedLocal(cx, nz, y)) cz = nz;
  }
  return { x: cx, z: cz };
}

/**
 * World-space MoveProbe over the local resolver — what NewJerusalemScene
 * installs on hooks.moveProbe and FlyCamera consumes (walk stops at walls
 * and tier masses, passes gate gaps; fly soft-collides the same volumes).
 */
export function wrapMoveWithCityCollision(plazaTopY: number, scale: number): MoveProbe {
  return (fromX, fromZ, toX, toZ, y) => {
    const r = resolveCityMoveLocal(
      fromX / scale,
      fromZ / scale,
      toX / scale,
      toZ / scale,
      (y - plazaTopY) / scale,
    );
    return { x: r.x * scale, z: r.z * scale };
  };
}

// ---- walkable floors (the debt this module's header used to declare) --------

/** Slab margin past the wall line: covers the gate corridors (local units). */
const SLAB_MARGIN = 4;
/** A floor claims when its top is at most this far above the feet (world m) —
 *  the 2.8 m meadow→plaza step is walkable; an 840 m terrace overhang is not. */
export const FLOOR_STEP_UP_M = 3.5;
/** eye height above the feet (matches FlyCamera's EYE_HEIGHT) */
const EYE_M = 1.7;

/**
 * Highest city floor at (x, z) whose top is <= maxFloorY, both LOCAL units —
 * -1e6 when none. Floors are the pavements the massing exposes: the plaza
 * slab (street of gold, gate corridors included), the plinth top, each
 * terrace-top cornice ring, and the crown top (sea of glass). Same tables as
 * the geometry and the lateral collision — no mirrors.
 */
export function cityFloorLocalY(x: number, z: number, maxFloorY: number): number {
  const a = Math.max(Math.abs(x), Math.abs(z));
  if (a > CITY_HALF + SLAB_MARGIN) return -1e6;
  let best = -1e6;
  const claim = (floor: number): void => {
    if (floor <= maxFloorY && floor > best) best = floor;
  };
  claim(0); // plaza slab
  // Ascent ramps: the sloped surfaces and head pads walk (y-aware like
  // every stacked pavement), and each top landing claim bridges the head,
  // the cornice lip outside the ring-claim boundary, and the next climb's
  // base. The small claim overlap past the span ends rides the clamped
  // surface, so the base climb meets its slab-top landing seamlessly.
  for (const r of RAMPS) {
    if (
      x >= r.x0 &&
      x <= r.x1 &&
      z >= r.zMin - RAMP_CLAIM_OVERLAP &&
      z <= r.zMax + RAMP_CLAIM_OVERLAP
    ) {
      claim(rampSurfaceY(r, z));
    }
    const L = r.land;
    if (x >= L.x0 && x <= L.x1 && z >= L.z0 && z <= L.z1) claim(L.y);
  }
  if (a <= PLINTH_HALF && a > CITY_TIERS[1].half) claim(TIER_BOTTOMS[1]); // plinth top
  for (let i = 1; i < CITY_TIERS.length - 1; i++) {
    // terrace-top ring of tier i (the ivory cornice pavement)
    if (a <= CITY_TIERS[i].half && a > CITY_TIERS[i + 1].half) {
      claim(TIER_BOTTOMS[i] + CITY_TIERS[i].h);
    }
  }
  if (a <= CITY_TIERS[CITY_TIERS.length - 1].half) claim(CITY_SUMMIT_Y); // crown top
  return best;
}

/**
 * Compose a GroundProbe with the city floors — the river-wrap idiom
 * (y-aware, so the STACKED pavements only claim when the querying eye could
 * be standing on them; without `y` only the plaza slab claims). Water is
 * passed through untouched — the river wrap owns it.
 */
export function wrapGroundProbeWithCityFloors(
  base: (x: number, z: number, y?: number) => { ground: number; water: number },
  plazaTopY: number,
  scale: number,
): (x: number, z: number, y?: number) => { ground: number; water: number } {
  return (x, z, y) => {
    const g = base(x, z, y);
    const lx = x / scale;
    const lz = z / scale;
    if (Math.max(Math.abs(lx), Math.abs(lz)) > CITY_HALF + SLAB_MARGIN) return g;
    const maxFloorLocal =
      y === undefined ? 0.001 : (y - EYE_M + FLOOR_STEP_UP_M - plazaTopY) / scale;
    const floor = cityFloorLocalY(lx, lz, maxFloorLocal);
    if (floor === -1e6) return g;
    return { ground: Math.max(g.ground, plazaTopY + floor * scale), water: g.water };
  };
}
