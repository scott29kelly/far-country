/**
 * Waterfalls off the plateau rim (ADR 0016 / USER-REFS directive #2 — "the
 * plateau EDGE is stratified cliff with waterfalls pouring off the rim").
 *
 * The hydrology field cannot express these BY CONSTRUCTION (its cliff-cut
 * kernel deletes wet cells above a 0.35 gradient, and rdGate dries steep
 * reaches), so the falls are AUTHORED crystal ribbons placed where the
 * plateau's real drainage meets the rim: a CPU scan of the post-generate
 * height/water mirrors finds wet cells in a band just inside the lip,
 * clusters them along the rim, and drops a fall sheet + plunge pool at each
 * site. Sites are seed-dependent (hydrology is emergent) and computed per
 * boot — never baked. Only the south rim + SE/SW corner arcs lie inside the
 * detailed domain (ADR 0016), which is also the only rim the spawn/approach
 * compositions ever frame; if a seed drains nothing to the rim, a small set
 * of anchor sites near the approach basin's spill side keeps the reference
 * composition (authored-not-emergent, same posture as the city river).
 *
 * Geometry lives in WORLD space (engine.scene), like the trees of life.
 */

import { CircleGeometry, Group, Mesh, PlaneGeometry, Vector2 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Atmosphere } from '../sky/Atmosphere';
import type { Heightfield } from '../world/Heightfield';
import { WORLD_SIZE } from '../world/WorldConst';
import { crystalFallMaterialWorld, crystalSurfaceMaterial } from './CrystalWater';
import { RIM_CLIFF, rimOutwardNormal, rimSdf } from './rimModel';

export interface FallSite {
  /** lip position (world m, on the unwobbled SDF zero) */
  x: number;
  z: number;
  /** terrain height just inside the shoulder (ribbon top) */
  topY: number;
  /** terrain height at the wall foot (ribbon bottom / pool) */
  footY: number;
  /** outward (downhill) unit normal */
  nx: number;
  nz: number;
  /** wet score used for ranking (m of water depth summed in the cluster) */
  score: number;
}

const MAX_SITES = 4;
const CLUSTER_M = 260; // along-rim dedup lattice
/** stay inside the detailed domain (WORLD_HALF = 6144 in the NJ scene) */
const SCAN_MARGIN = 6100;

/**
 * Scan a band just INSIDE the lip for wet cells (the waterY cliff-cut has
 * already dried everything on the slope itself) and cluster them into at
 * most MAX_SITES fall sites, ranked by wet depth.
 */
export function findRimFallSites(hf: Heightfield): FallSite[] {
  if (!hf.cpuWaterY || !hf.cpuHeights) return [];
  const simRes = hf.simRes;
  const clusters = new Map<string, { x: number; z: number; score: number }>();

  for (let zi = 0; zi < simRes; zi++) {
    const z = ((zi + 0.5) / simRes - 0.5) * WORLD_SIZE;
    if (Math.abs(z) > SCAN_MARGIN) continue;
    for (let xi = 0; xi < simRes; xi++) {
      const x = ((xi + 0.5) / simRes - 0.5) * WORLD_SIZE;
      if (Math.abs(x) > SCAN_MARGIN) continue;
      const d = rimSdf(x, z);
      if (d < -400 || d > -60) continue; // band just inside the lip
      const depth = hf.waterYAtCpu(x, z) - hf.heightAtCpu(x, z);
      if (depth < 0.1) continue;
      // cluster on an along-rim lattice keyed by the lip-projected position
      const [nx, nz] = rimOutwardNormal(x, z);
      const lx = x - nx * d; // project to the SDF zero (d is negative inside)
      const lz = z - nz * d;
      const key = `${Math.round(lx / CLUSTER_M)}:${Math.round(lz / CLUSTER_M)}`;
      const c = clusters.get(key);
      if (c) {
        c.score += depth;
      } else {
        clusters.set(key, { x: lx, z: lz, score: depth });
      }
    }
  }

  const ranked = [...clusters.values()].sort((a, b) => b.score - a.score).slice(0, MAX_SITES);
  return ranked.map((c) => siteAt(hf, c.x, c.z, c.score));
}

/** Resolve a lip position into a full site (heights from the real terrain). */
function siteAt(hf: Heightfield, x: number, z: number, score: number): FallSite {
  const [nx, nz] = rimOutwardNormal(x, z);
  // the GPU lip meanders ±70 m around the analytic SDF zero — sample the
  // real heightfield inside the shoulder and beyond the wall foot
  const topY = hf.heightAtCpu(x - nx * (RIM_CLIFF.lip + 50), z - nz * (RIM_CLIFF.lip + 50));
  const footX = clampDomain(x + nx * (RIM_CLIFF.face + 90));
  const footZ = clampDomain(z + nz * (RIM_CLIFF.face + 90));
  const footY = hf.heightAtCpu(footX, footZ);
  return { x, z, topY, footY, nx, nz, score };
}

function clampDomain(v: number): number {
  return Math.max(-SCAN_MARGIN, Math.min(SCAN_MARGIN, v));
}

/**
 * Anchor sites near the approach basin's spill side (south rim, east of the
 * meridian) — used only when the seed's drainage never reaches the rim, so
 * the reference composition (falls on the south face) survives any seed.
 */
export function anchorFallSites(hf: Heightfield): FallSite[] {
  const sites: FallSite[] = [];
  for (const x of [900, 1700]) {
    // find the lip z along this x (rimSdf root, south side)
    let z = 3800;
    while (rimSdf(x, z) < 0 && z < SCAN_MARGIN) z += 12;
    if (z >= SCAN_MARGIN) continue;
    sites.push(siteAt(hf, x, z, 0));
  }
  return sites;
}

/** Build the fall ribbons + plunge pools for the given sites (world space). */
export function buildRimFalls(
  sites: FallSite[],
  hf: Heightfield,
  atm: Atmosphere,
  gi: ProbeGI | null,
): Group {
  const g = new Group();
  g.name = 'rim-falls';

  for (const s of sites) {
    const w = 44;
    const yaw = Math.atan2(s.nx, s.nz); // +Z-facing plane → face outward

    // LEAN the sheet along the benched face (round-2 fix): the face STEPS
    // outward 170 m over its 260 m drop (RIM_CLIFF), so the old vertical
    // plane at mid-face (0.45·face out) had its whole lower half buried
    // inside the lower benches — every ribbon visibly ended at the first
    // bench and never reached its plunge pool. Run the sheet straight from
    // just outside the lip crest (6 m proud) down to the pool's wall-side
    // edge (pool centre is face+60 out, R 26 → edge at face+34, +4 m of
    // overlap into the water so the impact band sits ON the pool). The
    // leaned sheet hugs the stepped rock the whole way — a sliding cascade,
    // which is also what a benched face produces in the references.
    const runM = RIM_CLIFF.face + 38 - 6; // lip crest → pool edge, m
    const riseM = Math.max(30, s.topY + 6 - (s.footY + 0.2));
    const h = Math.hypot(riseM, runM); // sheet length along the lean
    const tilt = Math.atan2(runM, riseM); // from vertical, toward the wall

    const fall = new Mesh(
      new PlaneGeometry(w, h),
      crystalFallMaterialWorld(hf, atm, w, h, new Vector2(s.nx, s.nz)),
    );
    fall.geometry.translate(0, h / 2, 0); // origin at the ribbon bottom
    const fx = s.x + s.nx * (RIM_CLIFF.face + 38);
    const fz = s.z + s.nz * (RIM_CLIFF.face + 38);
    fall.position.set(fx, s.footY + 0.2, fz);
    // YXZ euler: yaw faces the sheet outward, then the X tilt leans it in
    // the sheet's OWN frame (XYZ would tilt about the world X axis and
    // skew every non-south site)
    fall.rotation.set(-tilt, yaw, 0, 'YXZ');
    g.add(fall);

    // plunge pool at the foot: crystal surface over a dark rock bed
    const poolR = 26;
    const px = s.x + s.nx * (RIM_CLIFF.face + 60);
    const pz = s.z + s.nz * (RIM_CLIFF.face + 60);
    const poolGeo = new CircleGeometry(poolR, 28);
    poolGeo.rotateX(-Math.PI / 2);
    // churn concentrated on the wall side, where the ribbon lands: the
    // plunge-pools reference reads as STILL water with a churned inlet —
    // the old uniform foam 0.55 speckled the whole pool. Impact centre
    // sits 0.65·R in from the pool centre toward the wall (the ribbon
    // plane stands at mid-face, wall side of the pool); r 18 m lets the
    // outer rim settle to crystal.
    const pool = new Mesh(
      poolGeo,
      crystalSurfaceMaterial(hf, atm, gi, {
        flow: new Vector2(s.nx, s.nz).multiplyScalar(1.1),
        foam: 0.55,
        impact: { x: px - s.nx * (poolR * 0.65), z: pz - s.nz * (poolR * 0.65), r: 18 },
      }),
    );
    pool.position.set(px, s.footY + 0.55, pz);
    g.add(pool);

    const bedGeo = new CircleGeometry(poolR + 3, 28);
    bedGeo.rotateX(-Math.PI / 2);
    const bedMat = new MeshStandardNodeMaterial();
    bedMat.color.setHex(0x4a4238); // wet plunge-basin rock
    bedMat.roughness = 0.9;
    bedMat.metalness = 0;
    const bed = new Mesh(bedGeo, bedMat);
    bed.position.set(px, s.footY - 1.9, pz);
    bed.receiveShadow = true;
    g.add(bed);
  }

  return g;
}
