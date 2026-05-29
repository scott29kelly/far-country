/**
 * Points of interest in the /world scene.
 *
 * Each POI anchors an entity slug (matching apps/web/public/data/entities/*.json)
 * to a 3D position in the city. When the camera enters `radius` of the position,
 * the HUD surfaces that entity's descriptors.
 *
 * Geometry conventions (all values in metres; the placeholder city base is
 * ~200m square, NOT true 12,000-stadia scale — see ADR 0009 rule 6):
 *   - city center (base plaza) is the origin (0, 0, 0); the summit throne is
 *     at (0, SUMMIT_Y, 0)
 *   - +X is east, -X is west, +Z is south, -Z is north (right-handed, Y up)
 *   - city half-width is 100m; the base walls are at X=±100 and Z=±100
 *
 * "Global" POIs use `global: true` instead of a position; they appear when the
 * camera is anywhere inside the city and no closer POI is active.
 */
export type Poi =
  | {
      slug: string;
      label: string;
      position: [number, number, number];
      radius: number;
      global?: false;
    }
  | {
      slug: string;
      label: string;
      global: true;
    };

/** Half-width of the placeholder city (base footprint), in metres. */
export const CITY_HALF = 100;

/**
 * Step-pyramid parameters. Owned here (with the other dimensional constants)
 * so the geometry module can derive from them without a circular import.
 * Derived helpers (halfAtLevel, groundHeightAt, cascadeSegments, …) live in
 * world-geometry.ts. See RENDERING-DECISIONS.md entry #1.
 *
 *   - `baseHalf`   half-width of the level-0 base plaza (= CITY_HALF).
 *   - `summitHalf` half-width of the flat summit terrace that carries the throne.
 *   - `steps`      number of risers between level 0 (plaza) and the summit.
 *   - `stepHeight` vertical rise of each riser, in metres.
 */
export const PYRAMID = {
  baseHalf: CITY_HALF,
  summitHalf: 18,
  steps: 7,
  stepHeight: 12,
} as const;

/** Y of the summit terrace top — where the throne sits. */
export const SUMMIT_Y = PYRAMID.steps * PYRAMID.stepHeight; // 84

/** Wall height, in metres. */
export const WALL_HEIGHT = 30;

/** Wall thickness, in metres. */
export const WALL_THICKNESS = 2;

/** Gate width and height, in metres. */
export const GATE_WIDTH = 8;
export const GATE_HEIGHT = 16;

/**
 * Three gates per side, at offsets of ±50m and 0m from the side's midpoint.
 */
export const GATE_OFFSETS: number[] = [-50, 0, 50];

export type Side = "north" | "south" | "east" | "west";

/** Compass abbreviation per side, surfaced in gate labels. */
export const SIDE_COMPASS: Record<Side, string> = {
  north: "N",
  east: "E",
  south: "S",
  west: "W",
};

export type GateDef = {
  side: Side;
  offset: number;
  position: [number, number, number];
  tribe: string;
};

/**
 * Twelve gates named for the tribes, following EZEKIEL 48:30–34 (not Rev
 * 7:5–8). Willis harmonises the New Jerusalem's gate order to Ezekiel's, which
 * keeps Dan and Joseph (Rev 7 substitutes Manasseh for Dan). See
 * docs/sources/willis-new-jerusalem-model.md and RENDERING-DECISIONS.md.
 *
 *   N: Reuben, Judah, Levi   ·   E: Joseph, Benjamin, Dan
 *   S: Simeon, Issachar, Zebulun · W: Gad, Asher, Naphtali
 *
 * Gates remain at the base plaza (y=0); the pyramid rises behind them.
 */
export const GATES: GateDef[] = [
  // North wall (Z = -CITY_HALF) — Ezek 48:31.
  { side: "north", offset: -50, position: [-50, 0, -CITY_HALF], tribe: "Reuben" },
  { side: "north", offset: 0, position: [0, 0, -CITY_HALF], tribe: "Judah" },
  { side: "north", offset: 50, position: [50, 0, -CITY_HALF], tribe: "Levi" },
  // East wall (X = +CITY_HALF) — Ezek 48:32.
  { side: "east", offset: -50, position: [CITY_HALF, 0, -50], tribe: "Joseph" },
  { side: "east", offset: 0, position: [CITY_HALF, 0, 0], tribe: "Benjamin" },
  { side: "east", offset: 50, position: [CITY_HALF, 0, 50], tribe: "Dan" },
  // South wall (Z = +CITY_HALF) — Ezek 48:33.
  { side: "south", offset: -50, position: [-50, 0, CITY_HALF], tribe: "Simeon" },
  { side: "south", offset: 0, position: [0, 0, CITY_HALF], tribe: "Issachar" },
  { side: "south", offset: 50, position: [50, 0, CITY_HALF], tribe: "Zebulun" },
  // West wall (X = -CITY_HALF) — Ezek 48:34.
  { side: "west", offset: -50, position: [-CITY_HALF, 0, -50], tribe: "Gad" },
  { side: "west", offset: 0, position: [-CITY_HALF, 0, 0], tribe: "Asher" },
  { side: "west", offset: 50, position: [-CITY_HALF, 0, 50], tribe: "Naphtali" },
];

/**
 * The twelve foundation stones, in ESV order (Rev 21:19–20). Willis reads the
 * foundations as the pyramid's stepped courses ("great step-backs"); the MVP
 * renders them as a jewelled course at the base of the wall (Foundations.tsx),
 * three per side. Colours are stylised gem hues, not photoreal mineralogy
 * (ADR 0009 rule 2).
 */
export type Gem = { name: string; color: string };
export const FOUNDATION_GEMS: Gem[] = [
  { name: "Jasper", color: "#8FB3C9" },
  { name: "Sapphire", color: "#3457D5" },
  { name: "Agate", color: "#B7C7C9" },
  { name: "Emerald", color: "#1FA968" },
  { name: "Onyx", color: "#5A5A66" },
  { name: "Carnelian", color: "#B33A2B" },
  { name: "Chrysolite", color: "#BFD43A" },
  { name: "Beryl", color: "#5FD3C4" },
  { name: "Topaz", color: "#E8B23A" },
  { name: "Chrysoprase", color: "#6FBF73" },
  { name: "Jacinth", color: "#E07B2E" },
  { name: "Amethyst", color: "#8E5BC2" },
];

/** Local offsets of the three foundation bands along a side (thirds). */
export const FOUNDATION_BAND_OFFSETS: number[] = [
  (-2 * CITY_HALF) / 3,
  0,
  (2 * CITY_HALF) / 3,
];

/** Length of one foundation band along its side. */
export const FOUNDATION_BAND_LENGTH = (2 * CITY_HALF) / 3;

export type FoundationBand = {
  side: Side;
  /** Index into FOUNDATION_GEMS (ESV order). */
  gem: number;
  /** Offset of the band centre along the side. */
  offset: number;
  /** World position of the band centre, at the wall base. */
  position: [number, number, number];
};

/**
 * Twelve foundation bands laid clockwise: N (gems 1–3), E (4–6), S (7–9),
 * W (10–12), each side reading in increasing offset order.
 */
export const FOUNDATION_BANDS: FoundationBand[] = (() => {
  const sides: Side[] = ["north", "east", "south", "west"];
  const bands: FoundationBand[] = [];
  let gem = 0;
  for (const side of sides) {
    for (const offset of FOUNDATION_BAND_OFFSETS) {
      const position: [number, number, number] =
        side === "north"
          ? [offset, 0, -CITY_HALF]
          : side === "south"
            ? [offset, 0, CITY_HALF]
            : side === "east"
              ? [CITY_HALF, 0, offset]
              : [-CITY_HALF, 0, offset];
      bands.push({ side, gem, offset, position });
      gem += 1;
    }
  }
  return bands;
})();

/**
 * Anchored POIs. Order matters: when multiple radii overlap, the FIRST
 * matching entry wins. So put the most specific (smaller-radius) POIs above
 * the more general ones.
 *
 * Generated POIs (per-gate, per-foundation) are appended after the hand-tuned
 * core anchors below.
 */
function buildPois(): Poi[] {
  const pois: Poi[] = [];

  // Throne — at the summit. Tight radius so it dominates only when the user is
  // up on the apex terrace (ADR 0010: aniconic).
  pois.push({
    slug: "throne-of-god",
    label: "Throne",
    position: [0, SUMMIT_Y, 0],
    radius: 22,
  });

  // Glory of God illuminating the city — anchored above the summit throne.
  pois.push({
    slug: "glory-of-god-illuminating-the-city",
    label: "Glory of God",
    position: [0, SUMMIT_Y + 24, 0],
    radius: 40,
  });

  // Per-gate POIs (Ezekiel order). Each gate is a single pearl; label carries
  // the tribe and the compass side.
  for (const gate of GATES) {
    pois.push({
      slug: "gates-of-pearl",
      label: `${gate.tribe} Gate · ${SIDE_COMPASS[gate.side]}`,
      position: gate.position,
      radius: 13,
    });
  }

  // Per-foundation POIs — the jewelled course at the wall base.
  for (const band of FOUNDATION_BANDS) {
    pois.push({
      slug: "twelve-jeweled-foundations",
      label: `Foundation · ${FOUNDATION_GEMS[band.gem].name}`,
      position: [band.position[0], 2, band.position[2]],
      radius: 10,
    });
  }

  // Jasper wall — anchored a few metres inside each side's midpoint.
  for (const [x, z] of [
    [0, -CITY_HALF + 12],
    [CITY_HALF - 12, 0],
    [0, CITY_HALF - 12],
    [-CITY_HALF + 12, 0],
  ] as Array<[number, number]>) {
    pois.push({
      slug: "jasper-wall-and-gold-city",
      label: "Jasper Wall",
      position: [x, 0, z],
      radius: 11,
    });
  }

  // River of Life — anchored on the base plaza reach, just inside the south
  // gate where the cascade meets the floor.
  pois.push({
    slug: "river-of-the-water-of-life",
    label: "River of Life",
    position: [0, 0, 92],
    radius: 16,
  });

  // Tree of Life — both flanking trees share the slug.
  pois.push({
    slug: "tree-of-life",
    label: "Tree of Life",
    position: [-4, 0, 92],
    radius: 9,
  });
  pois.push({
    slug: "tree-of-life",
    label: "Tree of Life",
    position: [4, 0, 92],
    radius: 9,
  });

  // Street of gold — the base plaza floor.
  pois.push({
    slug: "street-of-gold",
    label: "Street of Gold",
    position: [-45, 0, 45],
    radius: 22,
  });

  // The city itself — global fallback inside the walls.
  pois.push({
    slug: "new-jerusalem",
    label: "New Jerusalem",
    global: true,
  });

  return pois;
}

export const POIS: Poi[] = buildPois();
