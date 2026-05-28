/**
 * Points of interest in the /world scene.
 *
 * Each POI anchors an entity slug (matching apps/web/public/data/entities/*.json)
 * to a 3D position in the city. When the camera enters `radius` of the position,
 * the HUD surfaces that entity's descriptors.
 *
 * Geometry conventions (all values in metres; the placeholder city is ~200m
 * square, NOT true 12,000-stadia scale — see Phase 3 MVP notes):
 *   - city center is the origin (0, 0, 0)
 *   - +X is east, -X is west, +Z is south, -Z is north (right-handed, Y up)
 *   - city half-width is 100m, walls are at X=±100 and Z=±100
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

/** Half-width of the placeholder city, in metres. */
export const CITY_HALF = 100;

/** Wall height, in metres. */
export const WALL_HEIGHT = 30;

/** Wall thickness, in metres. */
export const WALL_THICKNESS = 2;

/** Gate width and height, in metres. */
export const GATE_WIDTH = 8;
export const GATE_HEIGHT = 16;

/**
 * Twelve gate positions: three on each of the four cardinal sides, evenly
 * distributed at offsets of ±50m and 0m from the side's midpoint.
 *
 * Tribe names follow the order of Rev 7:5–8 for the side assignments
 * (a common but not authoritative ordering — Scripture does not specify
 * which tribes guard which side; this is illustrative).
 */
export const GATE_OFFSETS: number[] = [-50, 0, 50];

export type GateDef = {
  side: "north" | "south" | "east" | "west";
  offset: number;
  position: [number, number, number];
  tribe: string;
};

export const GATES: GateDef[] = [
  // North side (Z = -CITY_HALF), tribes Judah/Reuben/Gad (Rev 7:5)
  { side: "north", offset: -50, position: [-50, 0, -CITY_HALF], tribe: "Judah" },
  { side: "north", offset: 0, position: [0, 0, -CITY_HALF], tribe: "Reuben" },
  { side: "north", offset: 50, position: [50, 0, -CITY_HALF], tribe: "Gad" },
  // East side (X = +CITY_HALF), tribes Asher/Naphtali/Manasseh (Rev 7:6)
  { side: "east", offset: -50, position: [CITY_HALF, 0, -50], tribe: "Asher" },
  { side: "east", offset: 0, position: [CITY_HALF, 0, 0], tribe: "Naphtali" },
  { side: "east", offset: 50, position: [CITY_HALF, 0, 50], tribe: "Manasseh" },
  // South side (Z = +CITY_HALF), tribes Simeon/Levi/Issachar (Rev 7:7)
  { side: "south", offset: -50, position: [-50, 0, CITY_HALF], tribe: "Simeon" },
  { side: "south", offset: 0, position: [0, 0, CITY_HALF], tribe: "Levi" },
  { side: "south", offset: 50, position: [50, 0, CITY_HALF], tribe: "Issachar" },
  // West side (X = -CITY_HALF), tribes Zebulun/Joseph/Benjamin (Rev 7:8)
  { side: "west", offset: -50, position: [-CITY_HALF, 0, -50], tribe: "Zebulun" },
  { side: "west", offset: 0, position: [-CITY_HALF, 0, 0], tribe: "Joseph" },
  { side: "west", offset: 50, position: [-CITY_HALF, 0, 50], tribe: "Benjamin" },
];

/**
 * Anchored POIs. Order matters: when multiple radii overlap, the FIRST
 * matching entry wins. So put the most specific (smaller-radius) POIs above
 * the more general ones.
 */
export const POIS: Poi[] = [
  // Throne placeholder — city center, tight radius so the throne reading
  // dominates only when the user is right at the center.
  {
    slug: "throne-of-god",
    label: "Throne",
    position: [0, 0, 0],
    radius: 20,
  },
  // Pearl gates — collective POI; one trigger zone per gate position,
  // expressed as a single representative point near each side's middle gate.
  {
    slug: "gates-of-pearl",
    label: "Gate of Pearl",
    position: [0, 0, -CITY_HALF],
    radius: 18,
  },
  {
    slug: "gates-of-pearl",
    label: "Gate of Pearl",
    position: [CITY_HALF, 0, 0],
    radius: 18,
  },
  {
    slug: "gates-of-pearl",
    label: "Gate of Pearl",
    position: [0, 0, CITY_HALF],
    radius: 18,
  },
  {
    slug: "gates-of-pearl",
    label: "Gate of Pearl",
    position: [-CITY_HALF, 0, 0],
    radius: 18,
  },
  // Wall — anchored near (but not inside) the walls. We pick four points
  // a few metres inside each side at the midpoint between gates.
  {
    slug: "jasper-wall-and-gold-city",
    label: "Jasper Wall",
    position: [0, 0, -CITY_HALF + 12],
    radius: 12,
  },
  {
    slug: "jasper-wall-and-gold-city",
    label: "Jasper Wall",
    position: [CITY_HALF - 12, 0, 0],
    radius: 12,
  },
  {
    slug: "jasper-wall-and-gold-city",
    label: "Jasper Wall",
    position: [0, 0, CITY_HALF - 12],
    radius: 12,
  },
  {
    slug: "jasper-wall-and-gold-city",
    label: "Jasper Wall",
    position: [-CITY_HALF + 12, 0, 0],
    radius: 12,
  },
  // Twelve foundations of the apostles — corner anchors of the city.
  {
    slug: "twelve-foundations-of-the-apostles",
    label: "Twelve Foundations",
    position: [CITY_HALF, 0, -CITY_HALF],
    radius: 18,
  },
  {
    slug: "twelve-foundations-of-the-apostles",
    label: "Twelve Foundations",
    position: [CITY_HALF, 0, CITY_HALF],
    radius: 18,
  },
  {
    slug: "twelve-foundations-of-the-apostles",
    label: "Twelve Foundations",
    position: [-CITY_HALF, 0, CITY_HALF],
    radius: 18,
  },
  {
    slug: "twelve-foundations-of-the-apostles",
    label: "Twelve Foundations",
    position: [-CITY_HALF, 0, -CITY_HALF],
    radius: 18,
  },
  // Street of gold — mid-radius between throne and walls.
  {
    slug: "street-of-gold",
    label: "Street of Gold",
    position: [40, 0, 40],
    radius: 25,
  },
  {
    slug: "street-of-gold",
    label: "Street of Gold",
    position: [-40, 0, -40],
    radius: 25,
  },
  // Tree of Life — both flanking trees share the same entity slug; either
  // anchor wins when the player approaches that bank.
  {
    slug: "tree-of-life",
    label: "Tree of Life",
    position: [-5, 0, 55],
    radius: 10,
  },
  {
    slug: "tree-of-life",
    label: "Tree of Life",
    position: [5, 0, 55],
    radius: 10,
  },
  // River of Life — anchor in the middle of the channel. Wider radius so
  // walking alongside the river surfaces it.
  {
    slug: "river-of-the-water-of-life",
    label: "River of Life",
    position: [0, 0, 55],
    radius: 18,
  },
  // Glory of God illuminating the city — anchored high above the throne.
  // The radius is generous because the lit sky is a global condition.
  {
    slug: "glory-of-god-illuminating-the-city",
    label: "Glory of God",
    position: [0, 80, 0],
    radius: 60,
  },
  // The city itself — global fallback inside the walls.
  {
    slug: "new-jerusalem",
    label: "New Jerusalem",
    global: true,
  },
];
