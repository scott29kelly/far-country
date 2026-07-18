/**
 * The Holy Allotment — Ezekiel 45/48, placeholder scale.
 *
 * Composes the regional layout from Willis's video aerial: the New Jerusalem
 * at the SOUTH-CENTRE of the district, with the priests' dwelling campus and
 * the temple to the NORTH (the temple sits OUTSIDE the city, Ezek 48:10).
 *
 * TERRAIN-INTEGRATED (ADR 0015): the plain itself is REAL TERRAIN — a broad,
 * gently-rolling plateau rise injected into the heightfield by
 * NewJerusalemScene's macroPatch. The old flat-box platform/skirt/rock-chunk
 * plateau, the box crop-field planes and hedges, and the 19-km perimeter
 * wall are GONE: grass, groves, debris and streams come from the engine's
 * own systems now; field plots and hedgerows come from the allotment ZONE
 * MAP (allotmentZones.ts).
 *
 * The dwelling campus and the temple are WORLD-SPACE builds, not children of
 * this ×20 group: the Ezekiel temple is the literal-cubit compound of
 * src/nj/Temple.ts (ADR 0017/0018, RENDERING-DECISIONS #7); the priests' and
 * Levites' dwelling bands are the human-scale garden-court campus of
 * src/nj/Dwellings.ts (RENDERING-DECISIONS #8). The ×20 megabox dwelling
 * grid this group used to carry is gone with them.
 *
 * Convention (matches cityModel): +X east, -X west, +Z south, -Z north;
 * local y = 0 is the city plaza top.
 *
 * Placeholder proportions only (ADR 0009 rule 6): compressed from the
 * earlier layout so the whole district fits the far shell (the real
 * allotment is ~57 mi wide; the ratio is approximated, not the scale).
 */

import { Group } from 'three';

import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Atmosphere } from '../sky/Atmosphere';
import type { Heightfield } from '../world/Heightfield';
import { buildCityMassing } from './CityMassing';
import { buildRiverOfLife } from './RiverOfLife';

export interface AllotmentDeps {
  gi?: ProbeGI | null;
  hf?: Heightfield | null;
  atm?: Atmosphere | null;
}

export const ALLOT_X = 360; // E-W half-extent (local units; ×NJ_SCALE = world m)
export const ALLOT_Z_SOUTH = 200; // +Z edge (south, behind the spawn meadow)
export const ALLOT_Z_NORTH = -540; // -Z edge (north, beyond the temple)

/**
 * Built content of the Holy Allotment that shares the city's ×20 local frame.
 * (The `groundAt` sampler parameter is gone with the dwelling grid — the
 * remaining content sits on the flat core at plaza height.)
 */
export function buildHolyAllotment(deps: AllotmentDeps = {}): Group {
  const gi = deps.gi ?? null;
  const allot = new Group();
  allot.name = 'holy-allotment';
  // ?resizeprobe=city,river — diagnostic ablation used by tools/probe-resize.ts
  // (--ablate) to bisect render-target-lifetime regressions; never set in
  // normal navigation
  const resizeProbeAblate = new Set(
    (new URLSearchParams(window.location.search).get('resizeprobe') ?? '').split(','),
  );

  // The New Jerusalem at the south-centre, on the flat core (plaza at y = 0).
  if (!resizeProbeAblate.has('city')) allot.add(buildCityMassing(gi));

  // The river of life cascading the south terraces to the plain (Rev 22:1) —
  // crystal-water pass; shares the city's local frame. Trees of life are
  // world-space pipeline trees (TreesOfLife.ts), not built here.
  if (!resizeProbeAblate.has('river')) allot.add(buildRiverOfLife(deps));

  return allot;
}
