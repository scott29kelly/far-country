/**
 * Population placement model — the great multitude and the angelic hosts
 * (roadmap M3.6; RENDERING-DECISIONS entry #3; ADR 0011 population policy;
 * ADR 0010 aniconic lock on the divine persons, untouched here).
 *
 * Grounding (the entities these placements render; the pick registry anchors
 * the SAME slugs):
 *   - `great-multitude` — Rev 7:9, "a great multitude that no one could
 *     number... standing before the throne... clothed in white robes, with
 *     palm branches in their hands." Rendered as worship assemblies on the
 *     street-of-gold plaza ring and the ascending terrace pavements, every
 *     figure facing the summit light.
 *   - `myriads-of-angels` — Rev 5:11, "many angels, numbering myriads of
 *     myriads... around the throne." Rendered as abstract vertical beings of
 *     light ringing the summit (no wings, no figural form — the text does not
 *     fix their appearance and we do not invent it).
 *
 * Rendering choices (not textual claims, per entry #3): the rendered COUNT
 * (a legibility stand-in for "no one could number"), the cone-robe +
 * featureless-head silhouette, assembly groupings and exact positions, the
 * light-pillar host form, and the tone/scale variation implying "every
 * nation" without depicting anyone.
 *
 * Shared-table discipline: every placement derives from the cityModel owner
 * tables (CITY_TIERS / cityTierBottoms / PLINTH_HALF / CITY_HALF / gate and
 * river constants) and stands on the SAME floors cityCollide.cityFloorLocalY
 * exposes to the walker — tools/probe-population.ts asserts both. Assemblies
 * are authored to clear the twelve gate corridors and the river meridian so
 * the walker's entry paths stay open; host clusters are stationed OFF the
 * four cardinal meridians so a ray aimed at the summit glory never enters a
 * host volume first (probe-guarded invariants).
 *
 * Pure module: no three.js, no DOM — CPU-probe testable. All coordinates are
 * LOCAL city units (×NJ_SCALE = world metres, plazaTopY = local y 0); the
 * figure/host DIMENSIONS are world metres (the figures are human-scale
 * world-space content, like TreesOfLife and the Temple).
 */

import {
  CITY_HALF,
  CITY_SUMMIT_Y,
  CITY_TIERS,
  cityTierBottoms,
  GATE_OFFSETS,
  PLINTH_HALF,
  RIVER,
  type Side,
} from './cityModel';
import { NJ_SCALE } from './rimModel';

/** Figure dimensions, WORLD metres (legacy Inhabitants.tsx proportions). */
export const FIGURE = {
  robeH: 1.55,
  robeR: 0.31,
  headR: 0.16,
  palmH: 1.15,
  palmR: 0.07,
  /** per-figure uniform scale range: s = min + rng * range */
  scaleMin: 0.88,
  scaleRange: 0.3,
} as const;

/** Host (light-pillar) dimensions, WORLD metres — abstract, non-figural. */
export const HOST = {
  coreR: 2.6,
  coreLen: 26,
  haloR: 5.6,
  haloLen: 32,
  /** vertical bob amplitude range, world m (shader: amp = min + hash*range) */
  bobAmpMin: 6,
  bobAmpRange: 4,
  /** bob angular speed, rad/s — slow, stately */
  bobSpeed: 0.3,
  scaleMin: 0.75,
  scaleRange: 0.6,
} as const;

/**
 * Emissive constants (probe-asserted): the PostStack bloom threshold is
 * luminance 1.5 and only the crown + glory may cross it (CityMassing
 * contract). Every population emissive stays far below.
 */
export const ROBE_EMISSIVE = 0.22;
export const HEAD_EMISSIVE = 0.08;
export const PALM_EMISSIVE = 0.25;
export const HOST_CORE_EMISSIVE = 1.4; // lum 1.31 — under the 1.5 line
export const HOST_HALO_EMISSIVE = 1.0;

/** Clearance kept between an assembly edge and a gate-corridor lane (local). */
export const ASSEMBLY_GATE_CLEARANCE = 2;
/** Clearance kept between an assembly edge and the river meridian (local). */
export const ASSEMBLY_RIVER_CLEARANCE = RIVER.width / 2 + 2;

export type AssemblyStation = {
  side: Side;
  /** tangent-axis centre (x on north/south, z on east/west), local */
  u: number;
  /** radial (Chebyshev) centre of the disc, local */
  aCenter: number;
  /** disc radius, local */
  r: number;
  /** floor local Y the assembly stands on (0 = plaza) */
  floor: number;
  /** target figure spacing, local units (0.25 local = 5 m world) */
  spacing: number;
};

const SIDES: readonly Side[] = ['north', 'east', 'south', 'west'];

/**
 * Worship assembly stations: sixteen on the street-of-gold plaza ring
 * (four per side, straddling the between-gate arcs at u = ±25 / ±75 — every
 * edge ≥ 2 local units clear of the gate lanes at −50/0/+50 and ≥ 4.5 clear
 * of the river meridian), and eight per terrace-top cornice ring on tiers
 * 1–3, ascending toward the summit. Tier 4 is the crown (sea of glass,
 * before the throne) and carries no assembly.
 */
export function multitudeAssemblies(): AssemblyStation[] {
  const bottoms = cityTierBottoms();
  const out: AssemblyStation[] = [];
  // plaza ring: between the plinth (88) and the wall (100) — centre 94
  const plazaA = (PLINTH_HALF + CITY_HALF) / 2;
  for (const side of SIDES) {
    for (const u of [-75, -25, 25, 75]) {
      out.push({ side, u, aCenter: plazaA, r: 2.5, floor: 0, spacing: 0.2 });
    }
  }
  // terrace-top cornice rings (the walkable pavements cityFloorLocalY claims)
  const rings: Array<{ tier: number; u: number; r: number }> = [
    { tier: 1, u: 30, r: 2.2 },
    { tier: 2, u: 22, r: 2.0 },
    { tier: 3, u: 13, r: 1.8 },
  ];
  for (const ring of rings) {
    const aCenter = (CITY_TIERS[ring.tier].half + CITY_TIERS[ring.tier + 1].half) / 2;
    const floor = bottoms[ring.tier] + CITY_TIERS[ring.tier].h;
    for (const side of SIDES) {
      for (const sgn of [-1, 1]) {
        out.push({ side, u: sgn * ring.u, aCenter, r: ring.r, floor, spacing: 0.25 });
      }
    }
  }
  return out;
}

export type FigurePlacement = {
  x: number;
  z: number;
  /** floor local Y the figure stands on */
  y: number;
  /** uniform world scale */
  s: number;
  tiltX: number;
  tiltZ: number;
  /** index into multitudeAssemblies() */
  assembly: number;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** (u, a) on a side → local (x, z). `a` is the outward Chebyshev radial. */
function sideToXZ(side: Side, u: number, a: number): { x: number; z: number } {
  if (side === 'south') return { x: u, z: a };
  if (side === 'north') return { x: u, z: -a };
  if (side === 'east') return { x: a, z: u };
  return { x: -a, z: u };
}

const GOLDEN_ANGLE = 2.399963229728653;

/**
 * Deterministic figure placements: a jittered sunflower spiral per assembly
 * (even ~spacing without O(n²) rejection), fixed seed — independent of
 * ?seed so probes and stills are stable.
 */
export function multitudePlacements(): FigurePlacement[] {
  const out: FigurePlacement[] = [];
  const stations = multitudeAssemblies();
  stations.forEach((st, k) => {
    const rng = mulberry32(0x6a17c0de ^ Math.imul(k + 1, 2654435761));
    const n = Math.round((Math.PI * st.r * st.r) / (st.spacing * st.spacing));
    for (let i = 0; i < n; i++) {
      const rad = st.r * Math.sqrt((i + 0.5) / n) * (0.92 + rng() * 0.14);
      const th = i * GOLDEN_ANGLE + (rng() - 0.5) * 0.7;
      const du = Math.cos(th) * rad;
      const da = Math.sin(th) * rad;
      const { x, z } = sideToXZ(st.side, st.u + du, st.aCenter + da);
      out.push({
        x,
        z,
        y: st.floor,
        s: FIGURE.scaleMin + rng() * FIGURE.scaleRange,
        tiltX: (rng() * 2 - 1) * 0.22,
        tiltZ: (rng() * 2 - 1) * 0.22,
        assembly: k,
      });
    }
  });
  return out;
}

export type AssemblyVolume = {
  x: number;
  z: number;
  floor: number;
  /** covering radius (actual member spread + margin), local */
  r: number;
};

/** Per-assembly covering cylinders (centroid + spread) for the pick registry. */
export function assemblyVolumes(): AssemblyVolume[] {
  const stations = multitudeAssemblies();
  const sums = stations.map(() => ({ x: 0, z: 0, n: 0 }));
  const placements = multitudePlacements();
  for (const p of placements) {
    const s = sums[p.assembly];
    s.x += p.x;
    s.z += p.z;
    s.n += 1;
  }
  const vols = stations.map((st, k) => ({
    x: sums[k].x / Math.max(1, sums[k].n),
    z: sums[k].z / Math.max(1, sums[k].n),
    floor: st.floor,
    r: 0,
  }));
  for (const p of placements) {
    const v = vols[p.assembly];
    const d = Math.hypot(p.x - v.x, p.z - v.z);
    if (d > v.r) v.r = d;
  }
  for (const v of vols) v.r += 0.3;
  return vols;
}

export type HostPlacement = {
  x: number;
  z: number;
  /** capsule-centre local Y (the shader bobs around it) */
  baseY: number;
  /** uniform world scale */
  s: number;
  /** index into hostClusterVolumes() */
  cluster: number;
};

const HOST_CLUSTERS = 12;
const HOSTS_PER_CLUSTER = 4;
/** ring radii, local — beyond the crown edge (22) and the glory sphere (21) */
const HOST_RING_MIN = 28;
const HOST_RING_SPAN = 9;

/**
 * Angelic host placements: twelve clusters of four, ringing the summit at
 * cluster angles (i + 0.5) · 30° — deliberately OFF the four cardinal
 * meridians so no host volume can intercept a ray aimed at the glory down
 * a cardinal approach (probe invariant). Hovering: base heights start
 * 1.5 local (30 m) above the crown top; "slowly rising and falling" is a
 * shader-time bob (no CPU per-instance updates).
 */
export function hostPlacements(): HostPlacement[] {
  const out: HostPlacement[] = [];
  for (let c = 0; c < HOST_CLUSTERS; c++) {
    const rng = mulberry32(0x5eedf00d ^ Math.imul(c + 1, 747796405));
    const angC = ((c + 0.5) * Math.PI * 2) / HOST_CLUSTERS;
    const ringR = HOST_RING_MIN + rng() * HOST_RING_SPAN;
    for (let h = 0; h < HOSTS_PER_CLUSTER; h++) {
      const ang = angC + (rng() - 0.5) * 0.16;
      const rr = ringR + (rng() - 0.5) * 3;
      out.push({
        x: Math.cos(ang) * rr,
        z: Math.sin(ang) * rr,
        baseY: CITY_SUMMIT_Y + 1.5 + rng() * 11,
        s: HOST.scaleMin + rng() * HOST.scaleRange,
        cluster: c,
      });
    }
  }
  return out;
}

export type HostClusterVolume = {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
};

/** Per-cluster covering cylinders (bob + halo margins included), local. */
export function hostClusterVolumes(): HostClusterVolume[] {
  const hosts = hostPlacements();
  const vols: HostClusterVolume[] = [];
  for (let c = 0; c < HOST_CLUSTERS; c++) {
    const members = hosts.filter((h) => h.cluster === c);
    const x = members.reduce((a, h) => a + h.x, 0) / members.length;
    const z = members.reduce((a, h) => a + h.z, 0) / members.length;
    let r = 0;
    let y0 = Infinity;
    let y1 = -Infinity;
    // world-metre margins in local units: halo half-height at max scale +
    // bob amplitude, and halo radius laterally
    const S = NJ_SCALE;
    const maxS = HOST.scaleMin + HOST.scaleRange;
    const vMargin =
      ((HOST.haloLen / 2 + HOST.haloR) * maxS + HOST.bobAmpMin + HOST.bobAmpRange) / S;
    const lMargin = (HOST.haloR * maxS) / S + 0.3;
    for (const h of members) {
      const d = Math.hypot(h.x - x, h.z - z);
      if (d + lMargin > r) r = d + lMargin;
      if (h.baseY - vMargin < y0) y0 = h.baseY - vMargin;
      if (h.baseY + vMargin > y1) y1 = h.baseY + vMargin;
    }
    vols.push({ x, z, r, y0, y1 });
  }
  return vols;
}

/**
 * Authored-clearance invariants, exported for the probe:
 *  - every assembly edge clears every gate lane and the river meridian;
 *  - every host cluster volume clears both cardinal planes (x=0, z=0).
 */
export function populationInvariants(): { ok: boolean; detail: string } {
  for (const st of multitudeAssemblies()) {
    for (const g of GATE_OFFSETS) {
      if (st.floor === 0 && Math.abs(st.u - g) - st.r < ASSEMBLY_GATE_CLEARANCE) {
        return { ok: false, detail: `assembly u=${st.u} too close to gate lane ${g}` };
      }
    }
    if (Math.abs(st.u) - st.r < ASSEMBLY_RIVER_CLEARANCE) {
      return { ok: false, detail: `assembly u=${st.u} too close to the river meridian` };
    }
  }
  for (const v of hostClusterVolumes()) {
    if (Math.min(Math.abs(v.x), Math.abs(v.z)) <= v.r) {
      return { ok: false, detail: `host cluster at (${v.x.toFixed(1)}, ${v.z.toFixed(1)}) r=${v.r.toFixed(1)} touches a cardinal plane` };
    }
  }
  return { ok: true, detail: 'all clearances hold' };
}
