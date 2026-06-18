/**
 * New Jerusalem dimensional model — ported for the engine scene.
 *
 * SOURCE OF TRUTH: apps/web/src/lib/world/data/{points-of-interest,world-geometry}.ts,
 * which trace to docs/sources/willis-new-jerusalem-model.md, RENDERING-DECISIONS.md,
 * and ADR 0009. These constants are duplicated here (not imported) because the
 * engine is a separate package from apps/web; unifying behind a shared package is
 * deferred (see docs/specs/phase-3-engine-integration.md §2). Keep the two in sync.
 *
 * Convention (matches the R3F world): city centred at the origin, Y up, +X east,
 * -X west, +Z south, -Z north. The whole city is placed at the engine origin and
 * sits on a base platform on the new-earth terrain. Scale is the ~200 m
 * placeholder (ADR 0009 rule 6); true 12,000-stadia scale stays deferred.
 */

/** Half-width of the placeholder city (base footprint), in metres. */
export const CITY_HALF = 100;

/**
 * Willis step-pyramid (terraced ziggurat) parameters.
 *
 * Seven visible terraces follow Willis's own artwork and the video walkthrough
 * (the ~11mi-cubed bounding read as a 7-tier ziggurat). The twelve gem
 * foundations (Rev 21:19-20) are NOT the visible terraces — they become the
 * jewelled bedrock courses beneath the base tier (added in a later increment).
 *
 * NOTE: the engine copy intentionally diverges from the 12-step apps/web R3F
 * model (legacy, being retired). Sync deferred per phase-3 spec.
 */
export const PYRAMID = {
  baseHalf: 68,
  summitHalf: 18,
  steps: 7,
  stepHeight: 16,
} as const;

/** Y of the summit terrace top — where the throne / glory sits. */
export const SUMMIT_Y = PYRAMID.steps * PYRAMID.stepHeight; // 112

export const WALL_HEIGHT = 30;
export const WALL_THICKNESS = 2;
export const GATE_WIDTH = 8;
export const GATE_HEIGHT = 16;
export const GATE_OFFSETS = [-50, 0, 50] as const;

export type Side = 'north' | 'south' | 'east' | 'west';

export const SIDE_COMPASS: Record<Side, string> = {
  north: 'N',
  east: 'E',
  south: 'S',
  west: 'W',
};

/** Half-width of terrace level `i` (0 = base, steps = summit). */
export function halfAtLevel(i: number): number {
  const t = i / PYRAMID.steps;
  return PYRAMID.baseHalf + (PYRAMID.summitHalf - PYRAMID.baseHalf) * t;
}

/** Top-face Y of terrace level `i`. */
export function topYAtLevel(i: number): number {
  return i * PYRAMID.stepHeight;
}

export type Terrace = { level: number; half: number; topY: number };

/** Rendered terrace boxes, levels 1..steps (level 0 is the base plaza). */
export const TERRACES: Terrace[] = Array.from({ length: PYRAMID.steps }, (_, k) => {
  const level = k + 1;
  return { level, half: halfAtLevel(level), topY: topYAtLevel(level) };
});

export type GateDef = {
  side: Side;
  offset: number;
  position: [number, number, number];
  tribe: string;
};

/**
 * Twelve gates named for the tribes per EZEKIEL 48:30-34 (Willis harmonisation,
 * keeping Dan and Joseph). N: Reuben/Judah/Levi · E: Joseph/Benjamin/Dan ·
 * S: Simeon/Issachar/Zebulun · W: Gad/Asher/Naphtali.
 */
export const GATES: GateDef[] = [
  { side: 'north', offset: -50, position: [-50, 0, -CITY_HALF], tribe: 'Reuben' },
  { side: 'north', offset: 0, position: [0, 0, -CITY_HALF], tribe: 'Judah' },
  { side: 'north', offset: 50, position: [50, 0, -CITY_HALF], tribe: 'Levi' },
  { side: 'east', offset: -50, position: [CITY_HALF, 0, -50], tribe: 'Joseph' },
  { side: 'east', offset: 0, position: [CITY_HALF, 0, 0], tribe: 'Benjamin' },
  { side: 'east', offset: 50, position: [CITY_HALF, 0, 50], tribe: 'Dan' },
  { side: 'south', offset: -50, position: [-50, 0, CITY_HALF], tribe: 'Simeon' },
  { side: 'south', offset: 0, position: [0, 0, CITY_HALF], tribe: 'Issachar' },
  { side: 'south', offset: 50, position: [50, 0, CITY_HALF], tribe: 'Zebulun' },
  { side: 'west', offset: -50, position: [-CITY_HALF, 0, -50], tribe: 'Gad' },
  { side: 'west', offset: 0, position: [-CITY_HALF, 0, 0], tribe: 'Asher' },
  { side: 'west', offset: 50, position: [-CITY_HALF, 0, 50], tribe: 'Naphtali' },
];

export type Gem = { name: string; color: string };

/** Twelve foundation stones in ESV order (Rev 21:19-20); stylised gem hues. */
export const FOUNDATION_GEMS: Gem[] = [
  { name: 'Jasper', color: '#8FB3C9' },
  { name: 'Sapphire', color: '#3457D5' },
  { name: 'Agate', color: '#B7C7C9' },
  { name: 'Emerald', color: '#1FA968' },
  { name: 'Onyx', color: '#5A5A66' },
  { name: 'Carnelian', color: '#B33A2B' },
  { name: 'Chrysolite', color: '#BFD43A' },
  { name: 'Beryl', color: '#5FD3C4' },
  { name: 'Topaz', color: '#E8B23A' },
  { name: 'Chrysoprase', color: '#6FBF73' },
  { name: 'Jacinth', color: '#E07B2E' },
  { name: 'Amethyst', color: '#8E5BC2' },
];

export const FOUNDATION_BAND_OFFSETS = [(-2 * CITY_HALF) / 3, 0, (2 * CITY_HALF) / 3] as const;
export const FOUNDATION_BAND_LENGTH = (2 * CITY_HALF) / 3;

export type FoundationBand = {
  side: Side;
  gem: number;
  offset: number;
  position: [number, number, number];
};

/** Twelve foundation bands clockwise: N (1-3), E (4-6), S (7-9), W (10-12). */
export const FOUNDATION_BANDS: FoundationBand[] = (() => {
  const sides: Side[] = ['north', 'east', 'south', 'west'];
  const bands: FoundationBand[] = [];
  let gem = 0;
  for (const side of sides) {
    for (const offset of FOUNDATION_BAND_OFFSETS) {
      const position: [number, number, number] =
        side === 'north'
          ? [offset, 0, -CITY_HALF]
          : side === 'south'
            ? [offset, 0, CITY_HALF]
            : side === 'east'
              ? [CITY_HALF, 0, offset]
              : [-CITY_HALF, 0, offset];
      bands.push({ side, gem, offset, position });
      gem += 1;
    }
  }
  return bands;
})();

/** River of the Water of Life (Rev 22:1) — a single cascade from the summit. */
export const RIVER = { width: 5, surfaceY: 0.05 } as const;

export type CascadeChannel = { y: number; z0: number; z1: number };
export type CascadeFall = { z: number; y0: number; y1: number };

/** Channel reaches (per terrace top + base plaza) and vertical fall ribbons. */
export function cascadeSegments(): { channels: CascadeChannel[]; falls: CascadeFall[] } {
  const channels: CascadeChannel[] = [];
  const falls: CascadeFall[] = [];
  for (let i = PYRAMID.steps; i >= 1; i--) {
    const topY = topYAtLevel(i);
    const outer = halfAtLevel(i);
    const inner = i === PYRAMID.steps ? 0 : halfAtLevel(i + 1);
    channels.push({ y: topY, z0: inner, z1: outer });
    falls.push({ z: outer, y0: topY, y1: topYAtLevel(i - 1) });
  }
  channels.push({ y: 0, z0: halfAtLevel(1), z1: CITY_HALF });
  return { channels, falls };
}

/** Tree of Life flanking positions (Rev 22:2), [x, z] on the base plaza. */
export const TREE_POSITIONS: Array<[number, number]> = [
  [-12, 80],
  [12, 80],
];
export const TREE_TRUNK_RADIUS = 0.7;
export const TREE_TRUNK_HEIGHT = 9;
export const TREE_CANOPY_RADIUS = 3.4;
