/**
 * CPU contract probe for the M3.6 population pass — no browser, no GPU, no
 * dev server. Verifies:
 *
 *  A. the PLACEMENT TABLES derive correctly from the shared owner tables:
 *     every figure stands EXACTLY on a floor cityCollide.cityFloorLocalY
 *     exposes to the walker (plaza slab / terrace cornice rings — the same
 *     tables geometry and collision consume); assemblies clear the gate
 *     corridors and the river meridian; host clusters ring the summit above
 *     the crown and clear both cardinal planes; every emissive constant
 *     stays under the 1.5 bloom threshold (only crown + glory may cross);
 *  B. the PICK REGISTRY integration: an assembly picks `great-multitude`
 *     over the street slab underfoot, a host cluster picks
 *     `myriads-of-angels`, the summit glory still picks the throne down a
 *     cardinal approach (the off-meridian invariant doing its job), and the
 *     walk-mode proximity cases (gate corridor, plaza interior) are
 *     unchanged by the new volumes.
 *
 *  Slug-to-canonical-dataset validation (every registry slug exists as a
 *  cited export) lives in probe-entitypick.ts section C, which now covers
 *  `great-multitude` and `myriads-of-angels` automatically.
 *
 *   npx tsx tools/probe-population.ts
 */

export {}; // top-level await needs module context

import { makeChecker } from './check';

// minimal window shim: WorldConst/others read location.search when defined
Object.defineProperty(globalThis, 'window', {
  value: { location: { search: '?scene=newjerusalem' }, addEventListener() {} },
  configurable: true,
});

const {
  FIGURE,
  HEAD_EMISSIVE,
  HOST,
  HOST_CORE_EMISSIVE,
  HOST_HALO_EMISSIVE,
  PALM_EMISSIVE,
  ROBE_EMISSIVE,
  assemblyVolumes,
  hostClusterVolumes,
  hostPlacements,
  multitudeAssemblies,
  multitudePlacements,
  populationInvariants,
} = await import('../src/nj/populationModel');
const { cityFloorLocalY } = await import('../src/nj/cityCollide');
const { CITY_SUMMIT_Y, CITY_TIERS } = await import('../src/nj/cityModel');
const { buildEntityPicks, nearestEntityAt, pickEntityAt } = await import('../src/nj/entityPicks');
const { NJ_SCALE } = await import('../src/nj/rimModel');

const c = makeChecker();

// ---- A: placement tables ----------------------------------------------------

const stations = multitudeAssemblies();
const placements = multitudePlacements();
c.check(
  'A1 assembly plan: 16 plaza + 24 terrace stations, a real multitude',
  stations.length === 40 &&
    stations.filter((s) => s.floor === 0).length === 16 &&
    placements.length > 8000,
  `${stations.length} stations, ${placements.length} figures`,
);

let floorBad = 0;
let sample = '';
for (const p of placements) {
  const f = cityFloorLocalY(p.x, p.z, p.y + 0.01);
  if (f !== p.y) {
    floorBad++;
    if (!sample) sample = `(${p.x.toFixed(1)}, ${p.z.toFixed(1)}) floor ${f} != ${p.y}`;
  }
}
c.check(
  'A2 every figure stands exactly on a walkable city floor',
  floorBad === 0,
  floorBad === 0 ? `${placements.length} figures checked` : `${floorBad} off-floor, first ${sample}`,
);

const inv = populationInvariants();
c.check('A3 gate-corridor / river-meridian / cardinal-plane clearances', inv.ok, inv.detail);

const hosts = hostPlacements();
const crownHalf = CITY_TIERS[CITY_TIERS.length - 1].half;
c.check(
  'A4 hosts ring the summit above the crown, beyond its edge',
  hosts.length === 48 &&
    hosts.every(
      (h) =>
        h.baseY >= CITY_SUMMIT_Y + 1.5 && Math.hypot(h.x, h.z) > crownHalf,
    ),
  `${hosts.length} hosts, baseY ${Math.min(...hosts.map((h) => h.baseY)).toFixed(1)}..${Math.max(...hosts.map((h) => h.baseY)).toFixed(1)} (summit ${CITY_SUMMIT_Y})`,
);

// bloom contract: luminance of every population emissive stays under 1.5
const lum = (r: number, g: number, b: number, k: number): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) * k;
const worst = Math.max(
  lum(1.0, 0.953, 0.886, ROBE_EMISSIVE),
  lum(0.74, 0.63, 0.55, HEAD_EMISSIVE),
  lum(0.165, 0.29, 0.118, PALM_EMISSIVE),
  lum(1.0, 0.93, 0.78, HOST_CORE_EMISSIVE),
  lum(1.0, 0.93, 0.78, HOST_HALO_EMISSIVE),
);
c.check(
  'A5 bloom contract: every population emissive under the 1.5 threshold',
  worst < 1.5,
  `worst luminance ${worst.toFixed(3)}`,
);

c.check(
  'A6 figures are human-scale world content',
  FIGURE.robeH + FIGURE.headR * 2 < 2.1 &&
    (FIGURE.scaleMin + FIGURE.scaleRange) * (FIGURE.robeH + FIGURE.headR * 2) < 2.5 &&
    HOST.coreLen + HOST.coreR * 2 > 20,
  `figure ~${(FIGURE.robeH + FIGURE.headR * 2).toFixed(2)} m, host core ~${HOST.coreLen + HOST.coreR * 2} m`,
);

// ---- B: pick-registry integration (probe-entitypick's fixture) --------------

const PLAZA_Y = 470;
const GROUND = 460;
const flat = (): number => GROUND;
const vols = buildEntityPicks(PLAZA_Y, flat);
const S = NJ_SCALE;

const mVols = vols.filter((v) => v.slug === 'great-multitude');
const hVols = vols.filter((v) => v.slug === 'myriads-of-angels');
c.check(
  'B1 registry carries one volume per assembly and per host cluster',
  mVols.length === assemblyVolumes().length && hVols.length === hostClusterVolumes().length,
  `${mVols.length} assemblies, ${hVols.length} clusters`,
);

// down-ray onto the south plaza assembly at u=25 (world x=500, z=1880)
const b2 = pickEntityAt([500, PLAZA_Y + 400, 94 * S], [0, -1, 0], vols, flat);
c.check(
  'B2 an assembly picks the multitude over the street slab underfoot',
  b2?.slug === 'great-multitude',
  `got ${b2?.slug ?? 'null'}`,
);

// lateral ray straight at cluster 0's centre, at its mid height
const h0 = hostClusterVolumes()[0];
const hMid = PLAZA_Y + ((h0.y0 + h0.y1) / 2) * S;
const b3 = pickEntityAt([h0.x * S + 2000, hMid, h0.z * S], [-1, 0, 0], vols, flat);
c.check(
  'B3 a host cluster picks the angelic hosts',
  b3?.slug === 'myriads-of-angels',
  `got ${b3?.slug ?? 'null'}`,
);

// the glory down the south cardinal approach — the off-meridian invariant
const gloryY = PLAZA_Y + (CITY_SUMMIT_Y + 10) * S;
const b4 = pickEntityAt([0, gloryY, 2000], [0, 0, -1], vols, flat);
c.check(
  'B4 the summit glory still picks the throne past the host ring',
  b4?.slug === 'throne-of-god',
  `got ${b4?.slug ?? 'null'}`,
);

// walk-mode proximity: standing inside the same south assembly at eye height
const n1 = nearestEntityAt([500, PLAZA_Y + 2, 94 * S], vols);
c.check(
  'B5 walking into an assembly auto-surfaces the multitude',
  n1?.slug === 'great-multitude',
  `got ${n1?.slug ?? 'null'}`,
);

// regressions: the gate corridor and the open plaza interior are unchanged
const n2 = nearestEntityAt([1000, PLAZA_Y + 30, 2000], vols);
c.check(
  'B6 gate corridor proximity unchanged (Zebulun Gate · S)',
  n2?.label === 'Zebulun Gate · S',
  `got ${n2?.label ?? 'null'}`,
);
const n3 = nearestEntityAt([300, PLAZA_Y + 2, 1000], vols);
c.check(
  'B7 plaza interior proximity unchanged (street of gold)',
  n3?.slug === 'street-of-gold',
  `got ${n3?.slug ?? 'null'}`,
);

c.finish();
