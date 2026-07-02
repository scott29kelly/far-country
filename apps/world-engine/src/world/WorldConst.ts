/**
 * World constants — the single place defining world dimensions, grid sizes,
 * vertical scale, and biome identifiers. The macro layout (where the massif,
 * valley, karst zone, and lake live) is in MacroMap.ts.
 */

/**
 * World edge length in meters; world spans [-WORLD_HALF, +WORLD_HALF]².
 *
 * SCENE-SELECTED (ADR 0015): the New Jerusalem scene runs a 12.3 km detailed
 * domain so the plain around its ±2 km city sits inside the detailed ring
 * (at 4096² that is ~3 m/texel macro — shader-side micro detail is
 * unaffected); the wild demo scenes keep the original 4 km at 1 m/texel,
 * whose tuned look is texel-density dependent. `?worldsize=N` overrides for
 * A/B. Read once at module load — everything below derives from it.
 */
const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const wsOverride = Number(q?.get('worldsize') ?? NaN);
const njScene = (q?.get('scene') ?? '') === 'newjerusalem';
export const WORLD_SIZE =
  Number.isFinite(wsOverride) && wsOverride >= 2048 ? wsOverride : njScene ? 12288 : 4096;
export const WORLD_HALF = WORLD_SIZE / 2;

/** final composed heightfield resolution (1 m/texel at WORLD_SIZE 4096) */
export const HEIGHT_RES = 4096;
/** erosion / hydrology simulation grid (2 m/texel at 4096) — spec floor ≥2048 */
export const SIM_RES = 2048;

/** vertical range: heights are meters above sea/datum 0 */
export const LAKE_LEVEL = 142;
export const VALLEY_FLOOR = 165;
export const KARST_PLATEAU = 380;
export const TREELINE = 950;
export const SNOWLINE_BASE = 1050;
export const SUMMIT_MAX = 1620;

/** far-shell vista ring: analytic terrain from WORLD_HALF out to FAR_RADIUS.
 *  Derived so the shell keeps its ~12 km depth at any domain size (14000 at
 *  the original WORLD_HALF 2048). */
export const FAR_RADIUS = WORLD_HALF + 11952;

/** biome ids (stored quantized in classification texture r-channel) */
export const enum Biome {
  Alpine = 0, // rock, scree, snow above treeline
  Subalpine = 1, // krummholz, sparse stunted conifers, heath
  Conifer = 2, // montane spruce/pine forest
  KarstForest = 3, // broadleaf forest among karst towers & ravines (refs 1–3)
  Meadow = 4, // grassland with flowers
  Wetland = 5, // lake margins, sedges, moisture-lovers
  COUNT = 6,
}

export const BIOME_NAMES: readonly string[] = [
  'alpine',
  'subalpine',
  'conifer',
  'karst-forest',
  'meadow',
  'wetland',
];

/** quality presets — smaller grids, never fewer systems */
export interface QualityConfig {
  heightRes: number;
  simRes: number;
  erosionIters: number;
  tileVerts: number; // vertices per tile edge
}

export function qualityConfig(preset: 'low' | 'high' | 'ultra'): QualityConfig {
  switch (preset) {
    case 'low':
      return { heightRes: 2048, simRes: 1024, erosionIters: 500, tileVerts: 49 };
    case 'ultra':
      return { heightRes: 4096, simRes: 2048, erosionIters: 900, tileVerts: 81 };
    case 'high':
      return { heightRes: HEIGHT_RES, simRes: SIM_RES, erosionIters: 640, tileVerts: 65 };
  }
}
