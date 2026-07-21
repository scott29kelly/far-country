/**
 * Processional ascent model — walkable ramps between the city floors
 * (Phase 3 traversability: a walker ascends plaza → plinth → terraces →
 * crown without switching to fly).
 *
 * INTERPRETIVE ARCHITECTURE, not a cited feature: Scripture gives the city's
 * height (Rev 21:16) but no stair; the ascent belongs to the same
 * `debated`-tier step-mountain rendering decision the tiers themselves come
 * from (RENDERING-DECISIONS #1, extended by entry #10). The ramps therefore
 * carry NO entity pick volume — clicking one cites nothing, exactly like the
 * dwelling campus (no canonical entity may be invented for them).
 *
 * Layout: one boustrophedon chain per side (east + west, mirrored), each
 * climb a single straight wedge ramp hugging the face it scales, standing
 * proud of the tier's cornice-slab overhang so the walker tops out flush
 * with the pavement lip. Every climb above the base carries a solid HEAD PAD
 * — a flat platform continuing past the wedge head at the top pavement
 * level — so the landing is real masonry, never a floor claim floating over
 * air. The base climb instead rises under the tier-0 slab that roofs the
 * whole plaza ring and tops out ON it, which needs the stairwell slots
 * `baseCorniceHoles()` describes. The authored z-spans dodge the gate
 * corridors (the Ezek 48:30-34 gates own the plaza approaches) and every
 * worship assembly (populationModel's fixed-seed placements) —
 * probe-asserted, tools/probe-ascent.ts.
 *
 * Shared-table discipline: CityMassing builds the wedges and pads,
 * cityCollide claims the surfaces and blocks the flanks, and the probe
 * walks the chain — all from THIS table. Pure module: no three.js, no DOM.
 */

import { CITY_SUMMIT_Y, CITY_TIERS, cityTierBottoms, PLINTH_HALF } from './cityModel';

/** ramp width (local; 70 m world) — fits the narrowest ring (plinth, 6) */
export const RAMP_W = 3.5;
/** cornice slab overhang past each tier face (CityMassing's +5 / 2) */
export const SLAB_PROUD = 2.5;
/** horizontal run per unit rise on the tier climbs (~35.5 deg) */
const RUN_PER_RISE = 1.4;
/** the base climb is shorter and steeper (~46 deg): the only span of the
 *  east/west plaza ring clear of both gate corridors and the floor-0
 *  worship assemblies is the corner run */
const BASE_RUN = 15.5;
/** head-pad length past the wedge head (flat landing platform, local) */
const PAD_LEN = 4;
/** how far below the base pavement the solids sink (hides the coplanar seam
 *  inside the supporting slab — the crown-cornice idiom) */
export const RAMP_SINK = 0.3;

export type AscentRamp = {
  /** which mirrored chain this ramp belongs to */
  side: 'east' | 'west';
  /** signed x band, x0 < x1 (local) */
  x0: number;
  x1: number;
  /** base-end z → top-end z (climb direction is the sign of zB - zA) */
  zA: number;
  zB: number;
  /** base / top pavement heights (local) */
  y0: number;
  y1: number;
  /** solid flat landing platform past the head (full x band, top y1) —
   *  null on the base climb, whose head lands ON the tier-0 slab */
  pad: { z0: number; z1: number } | null;
  /** top landing pavement claim: bridges the ramp head / pad, the cornice
   *  lip outside the ring-claim boundary, and the next climb's base */
  land: { x0: number; x1: number; z0: number; z1: number; y: number };
};

/** per-climb authored z anchors (east chain; west mirrors in x only):
 *  zA = base end; direction alternates so each landing sits near the next
 *  ramp's base. Values chosen against the gate-corridor and assembly maps —
 *  see module doc. */
const CLIMB_Z: Array<{ zA: number; dir: 1 | -1 }> = [
  { zA: 95, dir: -1 }, // plaza → plinth top: SE corner run, clear of (94,75)
  { zA: 77, dir: -1 }, // plinth → tier-1 top
  { zA: 16, dir: -1 }, // tier-1 → tier-2 top
  { zA: -35, dir: 1 }, // tier-2 → tier-3 top
  { zA: 19, dir: -1 }, // tier-3 → crown (pad stays inside the crown face)
];

let cache: AscentRamp[] | null = null;

/** The ten ascent ramps (five climbs × two mirrored chains), local units. */
export function ascentRamps(): AscentRamp[] {
  if (cache) return cache;
  const b = cityTierBottoms();
  // climb i scales the face of the mass ABOVE floor i: plinth face first,
  // then tier faces 1..last
  const faces = [PLINTH_HALF, ...CITY_TIERS.slice(1).map((t) => t.half)];
  const tops = [b[1], ...CITY_TIERS.slice(1).map((t, i) => b[i + 1] + t.h)];
  const out: AscentRamp[] = [];
  for (let i = 0; i < faces.length; i++) {
    const y0 = i === 0 ? 0 : tops[i - 1];
    const y1 = tops[i];
    const run = i === 0 ? BASE_RUN : (y1 - y0) * RUN_PER_RISE;
    const { zA, dir } = CLIMB_Z[i];
    const zB = zA + dir * run;
    const x0 = faces[i] + SLAB_PROUD;
    const x1 = x0 + RAMP_W;
    const pad =
      i === 0 ? null : dir === -1 ? { z0: zB - PAD_LEN, z1: zB } : { z0: zB, z1: zB + PAD_LEN };
    // landing claim: from the ring/crown claim boundary (or, on the base
    // climb, the plinth-ring lip for the wall-top walk) out past the band,
    // spanning the head of the climb on the side real pavement exists
    const land =
      i === 0
        ? { x0: CITY_TIERS[1].half + SLAB_PROUD, x1, z0: zB - 5.5, z1: zB - 0.1, y: y1 }
        : {
            x0: faces[i],
            x1,
            z0: Math.min(zB, zB + dir * PAD_LEN),
            z1: Math.max(zB, zB + dir * PAD_LEN),
            y: y1,
          };
    out.push({ side: 'east', x0, x1, zA, zB, y0, y1, pad, land });
    out.push({
      side: 'west',
      x0: -x1,
      x1: -x0,
      zA,
      zB,
      y0,
      y1,
      pad: pad ? { ...pad } : null,
      land: { x0: -land.x1, x1: -land.x0, z0: land.z0, z1: land.z1, y: land.y },
    });
  }
  cache = out;
  return out;
}

/** Ramp surface height at z (local) — clamped to the span ends. */
export function rampSurfaceY(r: AscentRamp, z: number): number {
  const t = Math.min(1, Math.max(0, (z - r.zA) / (r.zB - r.zA)));
  return r.y0 + t * (r.y1 - r.y0);
}

/** Rectangular stairwell slots the tier-0 cornice slab opens over the base
 *  climbs (the slab roofs the whole plaza ring; the walker's head rises
 *  through its plane on the final stretch of the base ramp). */
export function baseCorniceHoles(): Array<{ x0: number; x1: number; z0: number; z1: number }> {
  return ascentRamps()
    .filter((r) => r.pad === null)
    .map((r) => ({ x0: r.x0 - 1, x1: r.x1 + 1, z0: r.zB, z1: r.zB + 3 }));
}

/** sanity export for probes: the chain must land exactly on the summit */
export const ASCENT_SUMMIT_Y = CITY_SUMMIT_Y;
