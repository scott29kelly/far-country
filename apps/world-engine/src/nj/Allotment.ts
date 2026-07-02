/**
 * The Holy Allotment — Ezekiel 45/48, placeholder scale.
 *
 * Composes the regional layout from Willis's video aerial: the New Jerusalem
 * at the SOUTH-CENTRE of the district, with the priests' dwelling grid and a
 * standalone temple to the NORTH (the temple sits OUTSIDE the city,
 * Ezek 48:10).
 *
 * TERRAIN-INTEGRATED (ADR 0015): the plain itself is REAL TERRAIN — a broad,
 * gently-rolling plateau rise injected into the heightfield by
 * NewJerusalemScene's macroPatch. The old flat-box platform/skirt/rock-chunk
 * plateau, the box crop-field planes and hedges, and the 19-km perimeter
 * wall are GONE: grass, groves, debris and streams come from the engine's
 * own systems now. Field plots and hedgerows return properly with the
 * allotment ZONE-MAP milestone (managed planting), not as floating boxes.
 *
 * Convention (matches cityModel): +X east, -X west, +Z south, -Z north;
 * local y = 0 is the city plaza top. Outlying content (dwellings, temple)
 * snaps to the rolling ground via the `groundAt` sampler (local units).
 *
 * Placeholder proportions only (ADR 0009 rule 6): compressed from the
 * earlier layout so the whole district fits the far shell (the real
 * allotment is ~57 mi wide; the ratio is approximated, not the scale).
 */

import { BoxGeometry, Color, Group, Mesh } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';

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

const DWELL = new Color(0x6b6358); // darker stone so the grid reads from afar

// The old placeholder temple (a smaller gold copy of the city's own idiom)
// is GONE — the Ezekiel temple is now a world-space, literal-cubit build
// from the cited measurement dataset: src/nj/Temple.ts (ADR 0017/0018,
// RENDERING-DECISIONS #7). Its site in world coords:
const TEMPLE_LX = 0; // local x (world 0)
const TEMPLE_LZ = -280; // local z (world -5600)
const TEMPLE_CLEAR = 35; // local units (700 m) kept free of dwellings

/**
 * Built content of the Holy Allotment, resting on the terrain plateau.
 * `groundAt(lx, lz)` returns the LOCAL-frame ground height at a local (x, z)
 * (the scene wires it to the heightfield); outlying objects snap to it.
 */
export function buildHolyAllotment(
  groundAt?: (lx: number, lz: number) => number,
  deps: AllotmentDeps = {},
): Group {
  const gi = deps.gi ?? null;
  const allot = new Group();
  allot.name = 'holy-allotment';
  const ground = (lx: number, lz: number): number => groundAt?.(lx, lz) ?? 0;

  // Priests' dwelling grid, north of the city (Zadok priests' portion) — a
  // dense, darker grid so it reads clearly across the plain. Each dwelling
  // snaps to the rolling meadow it stands on.
  const dwellMat = new MeshStandardNodeMaterial();
  dwellMat.color.copy(DWELL);
  dwellMat.roughness = 0.85;
  const gx0 = -300;
  const gx1 = 300;
  const gz0 = -500;
  const gz1 = -260;
  const cols = 12;
  const rows = 7;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = gx0 + (gx1 - gx0) * ((i + 0.5) / cols);
      const z = gz0 + (gz1 - gz0) * ((j + 0.5) / rows);
      // the campus makes room for its sanctuary: the temple close stays
      // free of dwellings (Temple.ts builds there in world space)
      if (Math.abs(x - TEMPLE_LX) < TEMPLE_CLEAR && Math.abs(z - TEMPLE_LZ) < TEMPLE_CLEAR) {
        continue;
      }
      const d = new Mesh(new BoxGeometry(34, 12, 22), dwellMat);
      d.position.set(x, ground(x, z) + 6 - 1.5, z); // sunk 1.5 into the meadow
      d.castShadow = true;
      d.receiveShadow = true;
      allot.add(d);
    }
  }

  // The New Jerusalem at the south-centre, on the flat core (plaza at y = 0).
  allot.add(buildCityMassing(gi));

  // The river of life cascading the south terraces to the plain (Rev 22:1) —
  // crystal-water pass; shares the city's local frame. Trees of life are
  // world-space pipeline trees (TreesOfLife.ts), not built here.
  allot.add(buildRiverOfLife(deps));

  return allot;
}
