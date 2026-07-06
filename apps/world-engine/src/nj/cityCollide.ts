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
 * Collision is LATERAL only — pavements/floors stay groundProbe territory
 * (the plaza and terrace tops are not yet walk floors; separate debt). The
 * base-tier volume extends ~10 m below the plaza top because walkers approach
 * on the meadow 2.8 m below the plaza line the city group sits at.
 *
 * Like wrapGroundProbeWithRiver, the wrap takes plazaTopY and scale as
 * PARAMS — importing rimModel here would cycle through the scene modules.
 */

import type { MoveProbe } from '../core/FlyCamera';
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
} from './cityModel';

/** Lateral clearance kept off every face (0.6 m world at NJ_SCALE 20). */
const SKIN = 0.03;
/** Base-tier volume floor below the plaza top (10 m world — the meadow). */
const Y_MIN = -0.5;
/** Swept-resolve substep (1 m world) — fast fly motion cannot tunnel the
 *  240 m wall or skip a 160 m gate opening between frames. */
const SUBSTEP = 0.05;

const TIER_BOTTOMS = cityTierBottoms();
const COURSE_SPANS = foundationCourseSpans();
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
  if (a < CITY_HALF + SKIN) {
    // jasper wall ring — open only inside a gate gap (skin narrows it)
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
  let cx = fx;
  let cz = fz;
  for (let i = 1; i <= steps; i++) {
    const nx = fx + ((tx - fx) * i) / steps;
    const nz = fz + ((tz - fz) * i) / steps;
    if (!cityBlockedLocal(nx, cz, y)) cx = nx;
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
