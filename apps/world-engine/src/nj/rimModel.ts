/**
 * Shared Holy-Allotment rim geometry — the single source of truth for the
 * plateau footprint and mesa-cliff profile (ADR 0016). Consumed by:
 *   - NewJerusalemScene's macroPatch (GPU: MacroMap.macroTerrain composites
 *     the same numbers into the heightfield bake and the far shell), and
 *   - the CPU-side rim scanner that finds waterfall sites (RimFalls).
 * Duplicated literals between those two were the same desync class as the
 * old RiverOfLife tier-table mirror — this file exists so they can't drift.
 *
 * NOTE: the GPU profile adds a ±70 m noise meander to the lip (geology, not
 * a machined rounded rect). The CPU functions here are the UNWOBBLED SDF —
 * callers that need the true lip must refine along the outward normal
 * against the real heightfield.
 */

import { ALLOT_X, ALLOT_Z_NORTH, ALLOT_Z_SOUTH } from './Allotment';

/** Citywide scale (ADR 0014): local city units × NJ_SCALE = world metres. */
export const NJ_SCALE = 20;

/** Nominal plateau-top elevation (m, absolute — ADR 0015). */
export const PLATEAU_Y = 470;

/** Plateau footprint (world m) — mirrors the scene's macroPatch. */
export const RIM = {
  cx: 0,
  cz: ((ALLOT_Z_SOUTH + ALLOT_Z_NORTH) / 2) * NJ_SCALE,
  hx: ALLOT_X * NJ_SCALE + 400,
  hz: ((ALLOT_Z_SOUTH - ALLOT_Z_NORTH) / 2) * NJ_SCALE + 400,
  cornerR: 1600,
} as const;

/**
 * Mesa-cliff profile (ADR 0016 / USER-REFS directive #2): shoulder width
 * inside the lip, stepped face width, the ABSOLUTE wall height dropped
 * across shoulder+face (guaranteed regardless of the wild fringe), bench
 * count, and the talus tail width.
 */
export const RIM_CLIFF = {
  lip: 90,
  face: 170,
  wallH: 260,
  benches: 3,
  talus: 550,
} as const;

/** Rounded-rect SDF of the plateau footprint (≤0 inside; world m). */
export function rimSdf(x: number, z: number): number {
  const qx = Math.abs(x - RIM.cx) - (RIM.hx - RIM.cornerR);
  const qz = Math.abs(z - RIM.cz) - (RIM.hz - RIM.cornerR);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  return outside + Math.min(Math.max(qx, qz), 0) - RIM.cornerR;
}

/** Outward (downhill) rim normal from the SDF gradient (unit XZ). */
export function rimOutwardNormal(x: number, z: number): [number, number] {
  const e = 2;
  const nx = rimSdf(x + e, z) - rimSdf(x - e, z);
  const nz = rimSdf(x, z + e) - rimSdf(x, z - e);
  const l = Math.hypot(nx, nz) || 1;
  return [nx / l, nz / l];
}
