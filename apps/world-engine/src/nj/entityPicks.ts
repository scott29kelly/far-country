/**
 * Entity pick registry — "geometry that footnotes itself" (roadmap M3.4).
 *
 * Maps the rendered New Jerusalem structures to canonical dataset entity
 * slugs (the SAME per-entity JSON exports the apps/web browse UI consumes —
 * no descriptor content lives here, only slugs + analytic pick volumes).
 * Volumes derive from the shared owner tables (cityModel, riverReaches,
 * templeModel, TreesOfLife stations) — never hand-mirrored constants.
 *
 * Zone-level citation discipline (RENDERING-DECISIONS #7/#8): the temple
 * compound picks as ONE zone (`sanctuary-in-the-midst`), and the dwelling
 * campus picks as its two Track A zone entities — the priests' band
 * (`priests-portion`, Ezek 45:3-4; 48:10-12) and the Levites' band
 * (`levites-portion`, Ezek 45:5; 48:13-14) — each a measurement-backed
 * canonical entity. No volume anchors a citation to an invented individual
 * house, hedge, well or court: the zones are cited, their contents stay
 * interpretive art direction (entry #8).
 *
 * Pure module: no three.js, no DOM — CPU-probe testable
 * (tools/probe-entitypick.ts).
 */

import {
  CITY_HALF,
  CITY_TIERS,
  CITY_SUMMIT_Y,
  FOUNDATION_COURSE,
  FOUNDATION_GEMS,
  GATES,
  GATE_CLEAR_HALF,
  PLINTH_HALF,
  RIVER,
  SIDE_COMPASS,
  cityTierBottoms,
  foundationCourseSpans,
  type Side,
} from './cityModel';
import { NJ_SCALE } from './rimModel';
import { levitesBandRect, priestsBandRect, type ZoneRect } from './campusModel';
import { assemblyVolumes, hostClusterVolumes } from './populationModel';
import { riverReaches } from './RiverOfLife';
import { LONG_CUBIT_M, TEMPLE_SITE, cu } from './templeModel';
import { treeOfLifeStations } from './treeOfLifeModel';

export type PickShape =
  | { kind: 'aabb'; min: [number, number, number]; max: [number, number, number] }
  | { kind: 'sphere'; c: [number, number, number]; r: number }
  | { kind: 'cyl'; x: number; z: number; y0: number; y1: number; r: number };

export type EntityPickVolume = {
  /** canonical entity slug — must exist in /data/entities/<slug>.json */
  slug: string;
  /** in-world eyebrow label, e.g. "Zebulun Gate · S" */
  label: string;
  /** higher wins when entry distances are within the tie window */
  priority: number;
  shape: PickShape;
};

export type EntityPick = { slug: string; label: string; t: number };

/** ties within this many world metres resolve by priority — sized for
 *  volumes sharing an entry face (gate opening inside the wall slab), NOT
 *  for merely-nearby volumes, which resolve by plain nearest-t */
const TIE_WINDOW = 25;
/** terrain-occlusion march step (world m) */
const OCCLUDE_STEP = 25;

/**
 * Build the pick volumes in WORLD space. `plazaTopY` is the city group's
 * world Y (local y=0); `groundAt` is the BASE terrain height (heightAtCpu —
 * not the composed river/campus probe, which would self-occlude the river).
 */
export function buildEntityPicks(
  plazaTopY: number,
  groundAt: (x: number, z: number) => number,
): EntityPickVolume[] {
  const S = NJ_SCALE;
  const wy = (ly: number): number => plazaTopY + ly * S;
  const vols: EntityPickVolume[] = [];
  const tier0h = CITY_TIERS[0].h;
  const bottoms = cityTierBottoms();

  const sideBox = (
    side: Side,
    along0: number,
    along1: number,
    radial0: number,
    radial1: number,
    ly0: number,
    ly1: number,
  ): PickShape => {
    // "along" runs x on north/south walls, z on east/west; "radial" is the
    // signed wall-line coordinate on the other axis
    const min: [number, number, number] = [0, wy(ly0), 0];
    const max: [number, number, number] = [0, wy(ly1), 0];
    if (side === 'north' || side === 'south') {
      min[0] = along0 * S;
      max[0] = along1 * S;
      const z = side === 'north' ? -CITY_HALF : CITY_HALF;
      min[2] = (z + radial0) * S;
      max[2] = (z + radial1) * S;
    } else {
      min[2] = along0 * S;
      max[2] = along1 * S;
      const x = side === 'east' ? CITY_HALF : -CITY_HALF;
      min[0] = (x + radial0) * S;
      max[0] = (x + radial1) * S;
    }
    return { kind: 'aabb', min, max };
  };

  // Twelve gates (Rev 21:21; Ezek 48:30-34 order) — tribe + compass labels.
  for (const g of GATES) {
    vols.push({
      slug: 'gates-of-pearl',
      label: `${g.tribe} Gate · ${SIDE_COMPASS[g.side]}`,
      priority: 3,
      shape: sideBox(g.side, g.offset - GATE_CLEAR_HALF, g.offset + GATE_CLEAR_HALF, -4, 4, 0, tier0h),
    });
  }

  // Twelve jewelled foundation bands (Rev 21:19-20, ESV order) girdling the
  // wall base at its OUTER face — through foundationCourseSpans(), the SAME
  // gate-notched table the geometry and collision consume, so a click down
  // a gate approach reaches the gate, not a phantom gem band.
  const sides: Side[] = ['north', 'east', 'south', 'west'];
  for (let si = 0; si < sides.length; si++) {
    const side = sides[si];
    const out0 = side === 'north' || side === 'west' ? -(FOUNDATION_COURSE.thick + 2) : -1;
    const out1 = side === 'north' || side === 'west' ? 1 : FOUNDATION_COURSE.thick + 2;
    for (const span of foundationCourseSpans()) {
      vols.push({
        slug: 'twelve-jeweled-foundations',
        label: `Foundation · ${FOUNDATION_GEMS[si * 3 + span.band].name}`,
        priority: 3,
        shape: sideBox(
          side,
          span.u0,
          span.u1,
          out0,
          out1,
          -FOUNDATION_COURSE.sink - 0.5,
          FOUNDATION_COURSE.h + 0.5,
        ),
      });
    }
  }

  // Summit glory (Rev 4:2-3; 21:23) — the conflated aniconic throne/glory
  // picks as the throne entity. The sphere used to be centred 10 local above
  // the crown because the rainbow ring hung there; with the ring gone
  // (2026-07-25) nothing renders above the crown, so it sits ON the crown
  // instead — the emissive crown is what carries the glory now. A pick
  // volume must never float in empty sky: clicking air and getting a card is
  // the same shared-table desync the campus discipline forbids. It keeps the
  // higher priority so it wins over the sea-of-glass band beneath it.
  vols.push({
    slug: 'throne-of-god',
    label: 'Summit · Throne and Glory',
    priority: 4,
    shape: { kind: 'sphere', c: [0, wy(CITY_SUMMIT_Y + 2), 0], r: 12 * S },
  });

  // Sea of glass across the crown top (Rev 4:6).
  const crownHalf = CITY_TIERS[CITY_TIERS.length - 1].half;
  vols.push({
    slug: 'sea-of-glass',
    label: 'Crown · Sea of Glass',
    priority: 3,
    shape: {
      kind: 'cyl',
      x: 0,
      z: 0,
      y0: wy(CITY_SUMMIT_Y - 0.5),
      y1: wy(CITY_SUMMIT_Y + 1.5),
      r: (crownHalf - 0.5) * S,
    },
  });

  // River of life — every authored reach from the shared table (Rev 22:1).
  for (const r of riverReaches()) {
    vols.push({
      slug: 'river-of-the-water-of-life',
      label: 'River of the Water of Life',
      priority: 2,
      shape: {
        kind: 'aabb',
        min: [(-RIVER.width / 2 - 0.3) * S, wy(r.y - 1.5), r.z0 * S],
        max: [(RIVER.width / 2 + 0.3) * S, wy(r.y + 0.5), r.z1 * S],
      },
    });
  }

  // Trees of life flanking the approach reach (Rev 22:2) — nominal stations;
  // the builder jitters ±6/±8 m and crowns are wide, so r=25 covers them.
  for (const st of treeOfLifeStations()) {
    const g = groundAt(st.x, st.z);
    vols.push({
      slug: 'tree-of-life',
      label: 'Tree of Life',
      priority: 2,
      shape: { kind: 'cyl', x: st.x, z: st.z, y0: g - 2, y1: g + 60, r: 25 },
    });
  }

  // The great multitude (Rev 7:9) — one covering cylinder per worship
  // assembly on the plaza ring and terrace pavements (populationModel's own
  // spread-derived volumes; the figures inside are the rendered content).
  // Priority 2: beats the street slab underfoot, yields to a gate in a tie.
  for (const a of assemblyVolumes()) {
    vols.push({
      slug: 'great-multitude',
      label: 'Great Multitude',
      priority: 2,
      shape: {
        kind: 'cyl',
        x: a.x * S,
        z: a.z * S,
        y0: wy(a.floor - 0.05),
        y1: wy(a.floor + 0.15),
        r: a.r * S,
      },
    });
  }

  // The angelic hosts (Rev 5:11) — one cylinder per host cluster ringing the
  // summit. Clusters are stationed OFF the cardinal meridians
  // (populationModel invariant) so a glory-bound ray down an approach axis
  // never enters a host volume; ties near the summit resolve to the throne
  // (priority 4 > 2).
  for (const h of hostClusterVolumes()) {
    vols.push({
      slug: 'myriads-of-angels',
      label: 'Angelic Hosts · Around the Throne',
      priority: 2,
      shape: {
        kind: 'cyl',
        x: h.x * S,
        z: h.z * S,
        y0: wy(h.y0),
        y1: wy(h.y1),
        r: h.r * S,
      },
    });
  }

  // Jasper wall ring (Rev 21:18) — four side slabs.
  for (const side of ['north', 'east', 'south', 'west'] as const) {
    vols.push({
      slug: 'jasper-wall-and-gold-city',
      label: `Jasper Wall · ${SIDE_COMPASS[side]}`,
      priority: 1,
      shape: sideBox(side, -CITY_HALF, CITY_HALF, -4, 4, 0, tier0h),
    });
  }

  // Street of gold — the plaza pavement inside the wall (Rev 21:21b).
  vols.push({
    slug: 'street-of-gold',
    label: 'Street of Gold',
    priority: 1,
    shape: {
      kind: 'aabb',
      min: [-CITY_HALF * S, wy(-0.8), -CITY_HALF * S],
      max: [CITY_HALF * S, wy(0.4), CITY_HALF * S],
    },
  });

  // Terraced city mass — plinth + upper tiers (Rev 21:2, 16, 18).
  vols.push({
    slug: 'new-jerusalem',
    label: 'New Jerusalem',
    priority: 0,
    shape: {
      kind: 'aabb',
      min: [-PLINTH_HALF * S, wy(0), -PLINTH_HALF * S],
      max: [PLINTH_HALF * S, wy(tier0h), PLINTH_HALF * S],
    },
  });
  for (let i = 1; i < CITY_TIERS.length; i++) {
    const half = CITY_TIERS[i].half + 1;
    vols.push({
      slug: 'new-jerusalem',
      label: 'New Jerusalem',
      priority: 0,
      shape: {
        kind: 'aabb',
        min: [-half * S, wy(bottoms[i]), -half * S],
        max: [half * S, wy(bottoms[i] + CITY_TIERS[i].h), half * S],
      },
    });
  }

  // Ezekiel's temple compound — ONE zone-level volume at the measured 500
  // cubits per side (ezt-precinct-side, ADR 0017/0018); contents stay
  // uncited per RENDERING-DECISIONS #7.
  const precinctHalf = (cu('ezt-precinct-side') * LONG_CUBIT_M) / 2;
  const tg = groundAt(TEMPLE_SITE.x, TEMPLE_SITE.z);
  vols.push({
    slug: 'sanctuary-in-the-midst',
    label: 'Temple Compound · Ezekiel 40-42',
    priority: 1,
    shape: {
      kind: 'aabb',
      min: [TEMPLE_SITE.x - precinctHalf, tg - 2, TEMPLE_SITE.z - precinctHalf],
      max: [TEMPLE_SITE.x + precinctHalf, tg + 35, TEMPLE_SITE.z + precinctHalf],
    },
  });

  // The dwelling campus — Track A zone entities (Ezek 45:4-5; 48:10-14),
  // volumes from the SAME campusModel tables Dwellings.ts builds from.
  // The priests' band is two strips flanking the cleared meridian lane so a
  // ray down the city -> temple axis reaches the temple, not a campus face;
  // vertical spans sample the base terrain across each rect (the Levites'
  // band lies beyond the heightAtCpu mirror, whose edge-clamped samples the
  // generous span absorbs).
  const zoneBox = (rect: ZoneRect, up: number, down: number): PickShape => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const x of [rect.x0, (rect.x0 + rect.x1) / 2, rect.x1]) {
      for (const z of [rect.z0, (rect.z0 + rect.z1) / 2, rect.z1]) {
        const g = groundAt(x, z);
        lo = Math.min(lo, g);
        hi = Math.max(hi, g);
      }
    }
    return {
      kind: 'aabb',
      min: [rect.x0, lo - down, rect.z0],
      max: [rect.x1, hi + up, rect.z1],
    };
  };
  for (const side of ['west', 'east'] as const) {
    vols.push({
      slug: 'priests-portion',
      label: 'Dwelling Campus · Priests’ Portion',
      priority: 1,
      shape: zoneBox(priestsBandRect(side), 25, 2),
    });
  }
  vols.push({
    slug: 'levites-portion',
    label: 'Dwelling Campus · Levites’ Portion',
    priority: 1,
    shape: zoneBox(levitesBandRect(), 40, 60),
  });

  return vols;
}

function rayAabb(
  o: [number, number, number],
  d: [number, number, number],
  min: [number, number, number],
  max: [number, number, number],
): number | null {
  let t0 = 0;
  let t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
      continue;
    }
    const inv = 1 / d[i];
    let a = (min[i] - o[i]) * inv;
    let b = (max[i] - o[i]) * inv;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return t0;
}

function raySphere(
  o: [number, number, number],
  d: [number, number, number],
  c: [number, number, number],
  r: number,
): number | null {
  const ox = o[0] - c[0];
  const oy = o[1] - c[1];
  const oz = o[2] - c[2];
  const b = ox * d[0] + oy * d[1] + oz * d[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  if (cc <= 0) return 0; // inside
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}

function rayCyl(
  o: [number, number, number],
  d: [number, number, number],
  s: { x: number; z: number; y0: number; y1: number; r: number },
): number | null {
  // vertical-axis cylinder: quadratic in xz, then clamp y span (incl. caps)
  const ox = o[0] - s.x;
  const oz = o[2] - s.z;
  const a = d[0] * d[0] + d[2] * d[2];
  const insideXZ = ox * ox + oz * oz <= s.r * s.r;
  let tSide: number | null = null;
  if (a > 1e-9) {
    const b = ox * d[0] + oz * d[2];
    const cc = ox * ox + oz * oz - s.r * s.r;
    const disc = b * b - a * cc;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a;
      const tt = cc <= 0 ? 0 : t;
      if (tt >= 0) {
        const y = o[1] + d[1] * tt;
        if (y >= s.y0 && y <= s.y1) tSide = tt;
      }
    }
  }
  // caps
  let tCap: number | null = null;
  if (Math.abs(d[1]) > 1e-9) {
    for (const capY of [s.y0, s.y1]) {
      const t = (capY - o[1]) / d[1];
      if (t < 0) continue;
      const x = o[0] + d[0] * t;
      const z = o[2] + d[2] * t;
      if ((x - s.x) * (x - s.x) + (z - s.z) * (z - s.z) <= s.r * s.r) {
        tCap = tCap === null ? t : Math.min(tCap, t);
      }
    }
  }
  if (insideXZ && o[1] >= s.y0 && o[1] <= s.y1) return 0;
  if (tSide === null) return tCap;
  if (tCap === null) return tSide;
  return Math.min(tSide, tCap);
}

function rayShape(
  o: [number, number, number],
  d: [number, number, number],
  shape: PickShape,
): number | null {
  if (shape.kind === 'aabb') return rayAabb(o, d, shape.min, shape.max);
  if (shape.kind === 'sphere') return raySphere(o, d, shape.c, shape.r);
  return rayCyl(o, d, shape);
}

function distanceToShape(p: [number, number, number], shape: PickShape): number {
  if (shape.kind === 'aabb') {
    const dx = Math.max(shape.min[0] - p[0], 0, p[0] - shape.max[0]);
    const dy = Math.max(shape.min[1] - p[1], 0, p[1] - shape.max[1]);
    const dz = Math.max(shape.min[2] - p[2], 0, p[2] - shape.max[2]);
    return Math.hypot(dx, dy, dz);
  }
  if (shape.kind === 'sphere') {
    return Math.max(
      0,
      Math.hypot(p[0] - shape.c[0], p[1] - shape.c[1], p[2] - shape.c[2]) - shape.r,
    );
  }
  const dr = Math.max(0, Math.hypot(p[0] - shape.x, p[2] - shape.z) - shape.r);
  const dy = Math.max(shape.y0 - p[1], 0, p[1] - shape.y1);
  return Math.hypot(dr, dy);
}

/** distances within this resolve by priority (co-located volumes: a gate
 *  corridor inside the street slab, a tree over the bank) */
const NEAR_TIE_M = 5;

/**
 * The most specific entity near a world position — proximity flavor of the
 * pick (the walk-mode auto-card). Smallest distance wins; ties within
 * NEAR_TIE_M resolve by priority. Null beyond `maxDist`.
 */
export function nearestEntityAt(
  p: [number, number, number],
  volumes: EntityPickVolume[],
  maxDist = 25,
): EntityPick | null {
  let best: { vol: EntityPickVolume; d: number } | null = null;
  for (const vol of volumes) {
    const d = distanceToShape(p, vol.shape);
    if (d > maxDist) continue;
    if (
      best === null ||
      d < best.d - NEAR_TIE_M ||
      (Math.abs(d - best.d) <= NEAR_TIE_M && vol.priority > best.vol.priority)
    ) {
      best = { vol, d };
    }
  }
  return best ? { slug: best.vol.slug, label: best.vol.label, t: best.d } : null;
}

/**
 * Resolve a world-space ray to the picked entity. Nearest entry distance
 * wins; nested/adjacent volumes within TIE_WINDOW resolve by priority.
 * `terrainAt` (base heightfield) occludes picks behind terrain.
 */
export function pickEntityAt(
  origin: [number, number, number],
  dir: [number, number, number],
  volumes: EntityPickVolume[],
  terrainAt?: (x: number, z: number) => number,
  maxDist = 30000,
): EntityPick | null {
  let best: { vol: EntityPickVolume; t: number } | null = null;
  const hits: { vol: EntityPickVolume; t: number }[] = [];
  for (const vol of volumes) {
    const t = rayShape(origin, dir, vol.shape);
    if (t !== null && t <= maxDist) hits.push({ vol, t });
  }
  if (hits.length === 0) return null;
  hits.sort((h1, h2) => h1.t - h2.t);
  best = hits[0];
  for (const h of hits) {
    if (h.t - hits[0].t > TIE_WINDOW) break;
    if (h.vol.priority > best.vol.priority) best = h;
  }
  if (terrainAt) {
    // march the base terrain; stop short of the hit so a volume standing ON
    // the ground (river surface, tree base) is not occluded by its own bank
    for (let s = OCCLUDE_STEP; s < best.t - 10; s += OCCLUDE_STEP) {
      const x = origin[0] + dir[0] * s;
      const y = origin[1] + dir[1] * s;
      const z = origin[2] + dir[2] * s;
      if (y < terrainAt(x, z) - 1.5) return null;
    }
  }
  return { slug: best.vol.slug, label: best.vol.label, t: best.t };
}
