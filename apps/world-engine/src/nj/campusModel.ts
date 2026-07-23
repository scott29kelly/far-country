/**
 * Dwelling-campus layout tables — the shared owner tables for the Ezek
 * 45:4-5 / 48:10-14 campus bands, extracted from Dwellings.ts so the pick
 * registry (entityPicks) and reading key (keyModel) derive zone volumes
 * from the SAME numbers the builder consumes (never hand-mirrored
 * constants — the cityModel idiom).
 *
 * Grounding posture (RENDERING-DECISIONS entries #8 -> #11): the band
 * EXTENTS are now resolver-driven from the cited Ezek 45/48 measurement
 * records (`allotmentMeasurements.gen.ts`, EZA) at the declared district
 * scale (config.ts, ADR 0018) — equal 10,000-cubit breadths, the shared
 * 25,000-cubit length, adjacency, and the sanctuary centered in the
 * priests' portion are the text's own proportions. The CONTENT built
 * inside the zones (block kit, pitches, lane/processional clearings, the
 * grid fit, the far-band meadow break) remains interpretive art direction;
 * houses assert nothing.
 *
 * Pure module: no three.js, no DOM — CPU-probe testable.
 */

import { districtMeters } from './config';
import { TEMPLE_SITE } from './templeModel';

export type ZoneRect = { x0: number; x1: number; z0: number; z1: number };

// ---------------------------------------------------------------------------
// Cited band extents (district scale — config.ts resolver over EZA)
// ---------------------------------------------------------------------------

/** priests' portion, 25,000 x 10,000 long cubits (Ezek 45:3; 48:10) */
const PRIESTS_LENGTH = districtMeters('eza-priests-portion-length'); // 2500
const PRIESTS_BREADTH = districtMeters('eza-priests-portion-breadth'); // 1000
/** Levites' portion, equal alongside (Ezek 45:5; 48:13) */
const LEVITES_LENGTH = districtMeters('eza-levites-portion-length'); // 2500
const LEVITES_BREADTH = districtMeters('eza-levites-portion-breadth'); // 1000

/**
 * The priests' band straddles the sanctuary — "in their midst" (Ezek
 * 48:10) — so its breadth centers on TEMPLE_SITE.z; the shared 25,000-cubit
 * length centers on the city -> temple meridian (x = 0).
 */
export const PRIESTS_RECT: ZoneRect = {
  x0: -PRIESTS_LENGTH / 2, // -1250
  x1: PRIESTS_LENGTH / 2, // 1250
  z0: TEMPLE_SITE.z - PRIESTS_BREADTH / 2, // -6100 (north)
  z1: TEMPLE_SITE.z + PRIESTS_BREADTH / 2, // -5100 (south)
};

/** the Levites' portion lies ALONGSIDE the priests' territory (Ezek 48:13) */
export const LEVITES_RECT: ZoneRect = {
  x0: -LEVITES_LENGTH / 2, // -1250
  x1: LEVITES_LENGTH / 2, // 1250
  z0: PRIESTS_RECT.z0 - LEVITES_BREADTH, // -7100 (north)
  z1: PRIESTS_RECT.z0, // -6100 (adjacent)
};

// ---------------------------------------------------------------------------
// Priests' (Zadok) band — garden-court block grid flanking the temple
// (content: interpretive art direction fitted INSIDE the cited rect)
// ---------------------------------------------------------------------------

/** priests' band block grid: 108 m garden-court blocks on a 150 m pitch */
export const BLOCK = 108;
export const PITCH = 150;
/** meridian lane on x = 0 (city -> temple axis): col centers at ±(PITCH/2 + k·PITCH) */
export const COLS_PER_SIDE =
  Math.floor((PRIESTS_RECT.x1 - PITCH / 2 - BLOCK / 2) / PITCH) + 1; // 8/side, edge ±1229
/**
 * Row centers, south -> north, straddling the temple row-gap so the block
 * set stays symmetric about the sanctuary's z (the 48:10 centering).
 */
export const NEAR_ROWS: readonly number[] = (() => {
  const maxK = Math.floor((PRIESTS_BREADTH / 2 - BLOCK / 2 - PITCH / 2) / PITCH); // 2
  const rows: number[] = [];
  for (let k = maxK; k >= 0; k--) rows.push(TEMPLE_SITE.z + PITCH / 2 + k * PITCH);
  for (let k = 0; k <= maxK; k++) rows.push(TEMPLE_SITE.z - PITCH / 2 - k * PITCH);
  return rows; // 6 rows: -5225 .. -5975
})();
/** temple close: blocks whose rect intersects the plinth + this margin are cleared */
export const TEMPLE_MARGIN = 40;
/** east processional: cleared cells east of the temple gate on the gate-axis rows */
export const PROCESSIONAL_X1 = 1030;
export const PROCESSIONAL_ZHALF = 160; // clears the two rows straddling z = -5600

// ---------------------------------------------------------------------------
// Levites' band — podium blocks on the far shell
// ---------------------------------------------------------------------------

export const FAR_BLOCK = 190;
export const FAR_PITCH = 300;
export const FAR_COLS_PER_SIDE =
  Math.floor((LEVITES_RECT.x1 - FAR_PITCH / 2 - FAR_BLOCK / 2) / FAR_PITCH) + 1; // 4/side, edge ±1145
/**
 * Southmost podium row: a meadow break past the tile/shell seam at -6144
 * (the podium regime needs the far shell; the break keeps footings off the
 * LOD boundary). The break is interpretive — the ZONE itself starts at the
 * cited LEVITES_RECT.z1 = -6100.
 */
export const FAR_ROW0 = -6450;
/** rows fitted northward inside the cited rect */
export const FAR_ROWS =
  Math.floor((FAR_ROW0 - (LEVITES_RECT.z0 + FAR_BLOCK / 2)) / FAR_PITCH) + 1; // 2, to -6750
/** far shell renders macroTerrain('far') minus this sink (TerrainTiles farH) */
export const FAR_SHELL_SINK = 2.5;

// ---------------------------------------------------------------------------
// Derived zone rects (world space) — consumed by entityPicks / keyModel
// ---------------------------------------------------------------------------

/** half-width of the cleared meridian lane between the innermost columns */
export const LANE_HALF = PITCH / 2 - BLOCK / 2;

/**
 * The priests' band as two strips flanking the cleared meridian lane, so a
 * ray down the city -> temple axis reaches the temple compound instead of
 * a phantom campus face. `side` selects the strip; extents are the CITED
 * rect's (the lane split is pick mechanics, not a zone claim).
 */
export function priestsBandRect(side: 'west' | 'east'): ZoneRect {
  const { x0, x1, z0, z1 } = PRIESTS_RECT;
  return side === 'west'
    ? { x0, x1: -LANE_HALF, z0, z1 }
    : { x0: LANE_HALF, x1, z0, z1 };
}

/** the Levites' portion as one cited zone rect */
export function levitesBandRect(): ZoneRect {
  return { ...LEVITES_RECT };
}
