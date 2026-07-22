/**
 * Dwelling-campus layout tables — the shared owner tables for the Ezek
 * 45:4-5 / 48:10-14 campus bands, extracted from Dwellings.ts so the pick
 * registry (entityPicks) and reading key (keyModel) derive zone volumes
 * from the SAME numbers the builder consumes (never hand-mirrored
 * constants — the cityModel idiom).
 *
 * Grounding posture is unchanged (RENDERING-DECISIONS entry #8): Scripture
 * grounds the ZONES — the priests' portion, "a place for their houses"
 * (Ezek 45:4; 48:10-12), and the Levites' portion alongside (Ezek 45:5;
 * 48:13-14), both now cited measurement-backed canonical entities
 * (`priests-portion`, `levites-portion`, Track A) — while every dimension,
 * count, and form below remains interpretive art direction.
 *
 * Pure module: no three.js, no DOM — CPU-probe testable.
 */

// ---------------------------------------------------------------------------
// Priests' (Zadok) band — garden-court block grid flanking the temple
// ---------------------------------------------------------------------------

/** priests' band block grid: 108 m garden-court blocks on a 150 m pitch */
export const BLOCK = 108;
export const PITCH = 150;
/** meridian lane on x = 0 (city -> temple axis): col centers at ±(PITCH/2 + k·PITCH) */
export const COLS_PER_SIDE = 40; // 80 cols, outermost block edge at ±5979
export const NEAR_ROWS = [-5075, -5225, -5375, -5525, -5675, -5825, -5975] as const;
/** temple close: blocks whose rect intersects the plinth + this margin are cleared */
export const TEMPLE_MARGIN = 40;
/** east processional: cleared cells east of the temple gate on the gate-axis rows */
export const PROCESSIONAL_X1 = 1030;
export const PROCESSIONAL_ZHALF = 160; // clears the two rows straddling z = -5600

// ---------------------------------------------------------------------------
// Levites' band — podium blocks beyond the detailed ring
// ---------------------------------------------------------------------------

export const FAR_BLOCK = 190;
export const FAR_PITCH = 300;
export const FAR_COLS_PER_SIDE = 20; // 40 cols, outermost edge ±5945
export const FAR_ROW0 = -6450; // 300 m meadow break past the tile/shell seam at -6144
export const FAR_ROWS = 13; // to -10050 (podium edge -10145)
/** far shell renders macroTerrain('far') minus this sink (TerrainTiles farH) */
export const FAR_SHELL_SINK = 2.5;

// ---------------------------------------------------------------------------
// Derived zone rects (world space) — consumed by entityPicks / keyModel
// ---------------------------------------------------------------------------

export type ZoneRect = { x0: number; x1: number; z0: number; z1: number };

/** half-width of the cleared meridian lane between the innermost columns */
export const LANE_HALF = PITCH / 2 - BLOCK / 2;

/** outermost priests'-band block edge from the column grid */
const NEAR_X_EDGE = PITCH / 2 + (COLS_PER_SIDE - 1) * PITCH + BLOCK / 2;

/**
 * The priests' band as two strips flanking the cleared meridian lane, so a
 * ray down the city -> temple axis reaches the temple compound instead of
 * a phantom campus face. `side` selects the strip.
 */
export function priestsBandRect(side: 'west' | 'east'): ZoneRect {
  const z0 = NEAR_ROWS[NEAR_ROWS.length - 1] - BLOCK / 2; // -6029 (north)
  const z1 = NEAR_ROWS[0] + BLOCK / 2; // -5021 (south)
  return side === 'west'
    ? { x0: -NEAR_X_EDGE, x1: -LANE_HALF, z0, z1 }
    : { x0: LANE_HALF, x1: NEAR_X_EDGE, z0, z1 };
}

/** the Levites' band as one zone rect (podium edge to podium edge) */
export function levitesBandRect(): ZoneRect {
  const xEdge = FAR_PITCH / 2 + (FAR_COLS_PER_SIDE - 1) * FAR_PITCH + FAR_BLOCK / 2;
  return {
    x0: -xEdge,
    x1: xEdge,
    z0: FAR_ROW0 - (FAR_ROWS - 1) * FAR_PITCH - FAR_BLOCK / 2, // -10145
    z1: FAR_ROW0 + FAR_BLOCK / 2, // -6355
  };
}
