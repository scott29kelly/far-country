/**
 * The river of the water of life (Rev 22:1-2) — "bright as crystal, flowing
 * from the throne of God and of the Lamb through the middle of the street of
 * the city."
 *
 * Rendered as Willis reads it (RENDERING-DECISIONS #1): a single river
 * issuing from the summit throne and CASCADING the terraces down to the
 * gates, then running out across the plain as the "water at the approach."
 * It pours from just below the glory-light at the summit — aniconic (ADR
 * 0010): from the throne's light, not from any depicted figure.
 *
 * M3 water pass (CITY-QUALITY-BAR #7): the old matte-emissive water BoxGeometry
 * slabs are gone. Every horizontal reach is a TOP-SURFACE plane in the
 * CrystalWater material (real refraction/reflection/fresnel/foam) over an
 * OPAQUE gold bed strip (screen-space thickness needs a bed; the bed also
 * carries the authored-depth caustic pass), with gold curbs where the channel
 * crosses the plaza and meadow. The tier falls are CrystalWater ribbon sheets.
 *
 * Built in city-local coords (origin = city centre, plaza at y=0, +Z south)
 * inside the ×20 allotment group. Tier geometry comes from the SHARED
 * cityModel.CITY_TIERS table. `riverSurfaceLocalY` exports the same reach
 * table analytically for the walk-guard (the hydrology underwater guard
 * cannot see this authored water).
 *
 * Trees of life (Rev 22:2) are real pipeline trees now — see TreesOfLife.ts.
 */

import { BoxGeometry, Group, Mesh, PlaneGeometry, Vector2 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { Atmosphere } from '../sky/Atmosphere';
import type { Heightfield } from '../world/Heightfield';
import { crystalFallMaterial, crystalSurfaceMaterial, riverBedMaterial } from './CrystalWater';
import { CITY_TIERS, RIVER, cityTierBottoms } from './cityModel';

export interface RiverDeps {
  hf?: Heightfield | null;
  atm?: Atmosphere | null;
  gi?: ProbeGI | null;
}

/** One horizontal water reach (city-local frame, along the +Z meridian). */
export type RiverReach = {
  y: number;
  z0: number;
  z1: number;
  /** authored downstream speed (world m/s) — pools churn slowly */
  flowZ: number;
  /** plunge/churn foam 0..1 */
  foam: number;
};

/** water depth over every bed, local units (×20 ⇒ 2.4 m world) */
const DEPTH_L = 0.12;
/** how far the fall sheets stand proud of each tier face (clears the cornice lip) */
const FALL_PROUD = 3.0;
/** end of the approach channel (~plateau flat core's south reach) */
const CHANNEL_END = 185;

let reachCache: RiverReach[] | null = null;

/** The full reach table, source basin → approach channel (single source of truth). */
export function riverReaches(): RiverReach[] {
  if (reachCache) return reachCache;
  const yBot = cityTierBottoms();
  const yTop = yBot.map((b, i) => b + CITY_TIERS[i].h);
  const last = CITY_TIERS.length - 1;
  const reaches: RiverReach[] = [];

  // source basin on the crown top, directly under the glory ("from the throne")
  const crown = CITY_TIERS[last];
  reaches.push({
    y: yTop[last] + 0.35,
    z0: -crown.half * 0.5,
    z1: crown.half - 0.6,
    flowZ: 0.4,
    foam: 0.12,
  });

  // ledge pools: on each tier top (= the ivory cornice pavement), from just
  // outside the arcade band ringing the next tier's base to the outer lip
  for (let i = last - 1; i >= 0; i--) {
    const inner = CITY_TIERS[i + 1].half;
    reaches.push({
      y: yTop[i] + 0.18,
      z0: inner + 3.2,
      z1: CITY_TIERS[i].half + 2.6,
      flowZ: 0.9,
      foam: 0.35,
    });
  }

  // plunge pool at the wall-fall's base — past the jewelled foundation
  // course (z ≈ 99.4..103.4; the wall cascade sheets down OVER the gems) —
  // then the approach channel out across the plaza and meadow ("water at
  // the approach", Willis)
  reaches.push({ y: 0.16, z0: CITY_TIERS[0].half + 4.0, z1: CITY_TIERS[0].half + 8.5, flowZ: 0.6, foam: 0.5 });
  reaches.push({ y: 0.1, z0: CITY_TIERS[0].half + 8.5, z1: CHANNEL_END, flowZ: 1.6, foam: 0 });

  reachCache = reaches;
  return reaches;
}

/**
 * Analytic water-surface height (LOCAL frame) for the walk/underwater guard —
 * −1e6 when (lx, lz) is not over the river. The scene wraps the terrain
 * groundProbe with this so the walker's eye can't cross the authored water.
 */
export function riverSurfaceLocalY(lx: number, lz: number): number {
  if (Math.abs(lx) > RIVER.width / 2 + 0.3) return -1e6;
  for (const r of riverReaches()) {
    if (lz >= r.z0 - 0.4 && lz <= r.z1 + 0.4) return r.y;
  }
  return -1e6;
}

/** legacy fallback water (debug boots without noise/atmosphere) */
function simpleWaterMaterial(): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.color.setHex(0xbfeaff);
  m.emissive.setHex(0xaae0ff);
  m.emissiveIntensity = 0.65;
  m.metalness = 0.1;
  m.roughness = 0.12;
  return m;
}

export function buildRiverOfLife(deps: RiverDeps = {}): Group {
  const g = new Group();
  g.name = 'river-of-life';

  const hf = deps.hf ?? null;
  const atm = deps.atm ?? null;
  const gi = deps.gi ?? null;
  const crystal = !!(hf && hf.noiseA && atm);

  const w = RIVER.width;
  const yBot = cityTierBottoms();

  // ---- horizontal reaches: crystal surface over a gold caustic bed ----------
  for (const r of riverReaches()) {
    const len = r.z1 - r.z0;
    const zc = (r.z0 + r.z1) / 2;
    const flow = new Vector2(0, r.flowZ);

    const surfGeo = new PlaneGeometry(w, len);
    surfGeo.rotateX(-Math.PI / 2);
    const surfMat = crystal
      ? crystalSurfaceMaterial(hf as Heightfield, atm as Atmosphere, gi, { flow, foam: r.foam })
      : simpleWaterMaterial();
    const surf = new Mesh(surfGeo, surfMat);
    surf.position.set(0, r.y, zc);
    g.add(surf);

    const bedGeo = new PlaneGeometry(w + 0.6, len);
    bedGeo.rotateX(-Math.PI / 2);
    const bed = new Mesh(bedGeo, riverBedMaterial(flow, DEPTH_L * 20));
    bed.position.set(0, r.y - DEPTH_L, zc);
    bed.receiveShadow = true;
    g.add(bed);
  }

  // ---- tier falls: crystal ribbon sheets down each south face ---------------
  for (let i = CITY_TIERS.length - 1; i >= 0; i--) {
    const t = CITY_TIERS[i];
    const h = t.h + 2.0; // overlaps the lip above and the pool below
    const fallMat = crystal
      ? crystalFallMaterial(hf as Heightfield, atm as Atmosphere, w, h)
      : simpleWaterMaterial();
    const fall = new Mesh(new PlaneGeometry(w, h), fallMat);
    fall.geometry.translate(0, h / 2, 0); // origin at the ribbon's bottom
    // the base-tier fall stands further proud so it sheets down OVER the
    // jewelled foundation course into the plunge pool beyond it
    const proud = i === 0 ? 4.6 : FALL_PROUD;
    fall.position.set(0, yBot[i] - 1.0, t.half + proud);
    g.add(fall);
  }

  // ---- gold curbs banking the plaza/meadow channel ---------------------------
  // human-scale kerb stones (×20 world ⇒ ~3 m wide, ~2.5 m tall), not walls
  const curbMat = new MeshStandardNodeMaterial();
  curbMat.color.setHex(0xd9a441);
  curbMat.metalness = 0.7;
  curbMat.roughness = 0.3;
  const chan = riverReaches()[riverReaches().length - 1];
  const curbLen = chan.z1 - chan.z0;
  for (const sx of [-1, 1]) {
    const curb = new Mesh(new BoxGeometry(0.16, 0.13, curbLen), curbMat);
    curb.position.set(sx * (w / 2 + 0.12), 0.1, (chan.z0 + chan.z1) / 2);
    curb.castShadow = true;
    curb.receiveShadow = true;
    g.add(curb);
  }
  // solid trough under the channel: the meadow drops ~2.8 m below the plaza
  // frame, so without this the bed plane floats over the grass
  const trough = new Mesh(new BoxGeometry(w + 0.7, 0.4, curbLen), curbMat);
  trough.position.set(0, chan.y - DEPTH_L - 0.2, (chan.z0 + chan.z1) / 2);
  trough.receiveShadow = true;
  g.add(trough);

  return g;
}
