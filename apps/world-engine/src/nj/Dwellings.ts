/**
 * The dwelling campus of the holy district — Ezek 45:4-5; 48:10-14 — built in
 * WORLD SPACE at ordinary human scale (USER-REFS directive #6; CITY-QUALITY-BAR
 * delta #6), replacing the ×20-frame placeholder megabox grid.
 *
 * Grounding posture (RENDERING-DECISIONS entry #8): Scripture grounds the
 * ZONE — a portion of the holy district is "a place for their houses" for the
 * ministering Zadokite priests (Ezek 45:4; 48:10-11), with the Levites' equal
 * portion alongside (Ezek 45:5; 48:13-14) and the sanctuary in the priests'
 * midst (Ezek 48:10). Every dimension, count, and form below (block sizes,
 * house plans, hedges, wells, roofs, palettes) is interpretive art direction
 * from the approved reference set (gemini-render-1 garden-court blocks;
 * USER-REFS #3 hedgerows / #6 villages), NOT a textual claim — same posture
 * as the temple's fortress dressing (entry #7 point 4). House counts are a
 * legibility stand-in, not a census (entry #3 precedent).
 *
 * Two bands, two regimes:
 *  - PRIESTS' (Zadok) band: a continuous garden-court block grid flanking the
 *    temple, entirely inside the heightfield CPU mirror (|z| <= 6144) so every
 *    house snaps exactly to the rendered ground (`hf.heightAtCpu`). Full kit:
 *    row-house perimeter rings with stepped rooflines, recessed doors and
 *    warm windows, gate gaps with posts, court wells. The temple close and an
 *    east processional way are cleared by construction; a meridian lane on
 *    x = 0 carries the city -> temple axis through the band.
 *  - LEVITES' band: beyond the detailed ring (z < -6144) the ONLY rendered
 *    ground is the analytic far shell, drawn 2.5 m below `macroTerrain(...,
 *    'far')` on a coarse ring mesh (TerrainTiles). Blocks there stand on
 *    stone PODIUM slabs whose skirts absorb that approximation (the temple-
 *    plinth idiom), with simplified massing (no window/door kit) and a
 *    sand-heavy palette. Podium sites come from a one-shot GPU evaluation of
 *    the same far macro the shell renders (HeightSynthesis idiom) — never
 *    from `heightAtCpu`, which clamps at the mirror edge.
 *
 * Static-content contract: plain InstancedMesh kit parts (CityMassing idiom),
 * chunked into column groups so bounding spheres stay local and the main +
 * CSM cascade passes can cull; window glow stays under the base-tier bloom
 * contract (luminance < 1.5). Deterministic by integer hash — no Math.random.
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import type { Renderer } from 'three/webgpu';
import { IrradianceNode, MeshStandardNodeMaterial } from 'three/webgpu';
import { Fn, If, Return, float, instanceIndex, instancedArray, normalWorld, positionWorld, vec2, vec3 } from 'three/tsl';

import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NV3 } from '../gpu/TSLTypes';
import { macroTerrain } from '../world/MacroMap';
import type { Heightfield } from '../world/Heightfield';
import { WORLD_HALF } from '../world/WorldConst';
import { PLATEAU_Y } from './rimModel';
import { TEMPLE_SITE } from './templeModel';

// ---------------------------------------------------------------------------
// Layout constants (interpretive art direction — RENDERING-DECISIONS #8)
// ---------------------------------------------------------------------------

/** priests' band block grid: 108 m garden-court blocks on a 150 m pitch */
const BLOCK = 108;
const PITCH = 150;
/** meridian lane on x = 0 (city -> temple axis): col centers at ±(PITCH/2 + k·PITCH) */
const COLS_PER_SIDE = 40; // 80 cols, outermost block edge at ±5979
const NEAR_ROWS = [-5075, -5225, -5375, -5525, -5675, -5825, -5975] as const;
/** temple close: blocks whose rect intersects the plinth + this margin are cleared */
const TEMPLE_MARGIN = 40;
/** east processional: cleared cells east of the temple gate on the gate-axis rows */
const PROCESSIONAL_X1 = 1030;
const PROCESSIONAL_ZHALF = 160; // clears the two rows straddling z = -5600

/** Levites' band: podium blocks beyond the detailed ring */
const FAR_BLOCK = 190;
const FAR_PITCH = 300;
const FAR_COLS_PER_SIDE = 20; // 40 cols, outermost edge ±5945
const FAR_ROW0 = -6450; // 300 m meadow break past the tile/shell seam at -6144
const FAR_ROWS = 13; // to -10050 (podium edge -10145)
/** far shell renders macroTerrain('far') minus this sink (TerrainTiles farH) */
const FAR_SHELL_SINK = 2.5;

/** far-macro sample grid over the Levites' band (GPU eval + CPU bilinear) */
const FARGRID_X0 = -6150;
const FARGRID_X1 = 6150;
const FARGRID_Z0 = -10400;
const FARGRID_Z1 = -6100;
const FARGRID_RX = 512;
const FARGRID_RZ = 192;

// ---------------------------------------------------------------------------
// Deterministic hash (facetedBandGeometry idiom — no Math.random)
// ---------------------------------------------------------------------------

function rng(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function cellSeed(band: number, i: number, j: number): number {
  return ((band * 73856093) ^ (i * 19349663) ^ (j * 83492791)) >>> 0;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

function patchGI(mat: MeshStandardNodeMaterial, gi: ProbeGI | null): void {
  if (!gi) return;
  const irr = gi.irradiance(
    positionWorld as unknown as NV3,
    normalWorld as unknown as NV3,
  );
  (mat as unknown as { setupLightMap: () => unknown }).setupLightMap = () =>
    new IrradianceNode(irr as unknown as ConstructorParameters<typeof IrradianceNode>[0]);
}

function lambert(gi: ProbeGI | null, r: number, g: number, b: number, rough: number): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.color = new Color(r, g, b);
  m.roughness = rough;
  m.metalness = 0;
  patchGI(m, gi);
  return m;
}

function windowGlow(k: number): MeshStandardNodeMaterial {
  // warm hearth-light through openings — base-tier bloom contract (< 1.5;
  // only the city crown + glory cross it). Same idiom as Temple.ts.
  const m = new MeshStandardNodeMaterial();
  m.color.setRGB(0.2, 0.14, 0.08);
  m.emissiveNode = vec3(1.0, 0.72, 0.42).mul(k) as unknown as typeof m.emissiveNode;
  return m;
}

// ---------------------------------------------------------------------------
// Unit kit geometries (scaled per instance via the matrix)
// ---------------------------------------------------------------------------

/** unit box, base at y = 0 */
function baseBox(): BoxGeometry {
  const g = new BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  return g;
}

/** unit gable-roof prism: 1×1 footprint, ridge along Z at y = 1, base y = 0 */
function gablePrism(): BufferGeometry {
  const hw = 0.5;
  const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
  const tris: Array<[number, number, number][]> = [
    // west slope
    [v(-hw, 0, -hw), v(-hw, 0, hw), v(0, 1, hw)],
    [v(-hw, 0, -hw), v(0, 1, hw), v(0, 1, -hw)],
    // east slope
    [v(hw, 0, hw), v(hw, 0, -hw), v(0, 1, -hw)],
    [v(hw, 0, hw), v(0, 1, -hw), v(0, 1, hw)],
    // gable ends
    [v(-hw, 0, hw), v(hw, 0, hw), v(0, 1, hw)],
    [v(hw, 0, -hw), v(-hw, 0, -hw), v(0, 1, -hw)],
  ];
  const pos = new Float32Array(tris.flat(2));
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Unit door/window frame: an OPEN border ring (head, sill, jambs), base at
 * y = 0, unit outer size, depth 1 along Z — the glow/door plate sits recessed
 * inside the opening so openings read as reveals, not decals (pillar A).
 */
function frameRing(): BufferGeometry {
  const t = 0.09; // bar thickness as a fraction of the unit outer size
  const parts: BoxGeometry[] = [];
  const bar = (w: number, h: number, x: number, y: number): void => {
    const b = new BoxGeometry(w, h, 1);
    b.translate(x, y + 0.5, 0); // base-anchored like the other kit parts
    parts.push(b);
  };
  bar(1, t, 0, 0.5 - t / 2); // head
  bar(1, t, 0, -0.5 + t / 2); // sill
  bar(t, 1 - 2 * t, -0.5 + t / 2, 0); // jambs
  bar(t, 1 - 2 * t, 0.5 - t / 2, 0);
  const pos: number[] = [];
  for (const p of parts) {
    const n = p.toNonIndexed();
    const a = n.getAttribute('position');
    for (let i = 0; i < a.count; i++) {
      pos.push(a.getX(i), a.getY(i), a.getZ(i));
    }
    p.dispose();
    n.dispose();
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  geo.computeVertexNormals();
  return geo;
}

/** unit hip-roof: 1×1 footprint, short ridge along Z at y = 1 */
function hipRoof(): BufferGeometry {
  const hw = 0.5;
  const r = 0.22; // half ridge length
  const v = (x: number, y: number, z: number): [number, number, number] => [x, y, z];
  const tris: Array<[number, number, number][]> = [
    // long slopes (trapezoids)
    [v(-hw, 0, -hw), v(-hw, 0, hw), v(0, 1, r)],
    [v(-hw, 0, -hw), v(0, 1, r), v(0, 1, -r)],
    [v(hw, 0, hw), v(hw, 0, -hw), v(0, 1, -r)],
    [v(hw, 0, hw), v(0, 1, -r), v(0, 1, r)],
    // hip ends (triangles)
    [v(-hw, 0, hw), v(hw, 0, hw), v(0, 1, r)],
    [v(hw, 0, -hw), v(-hw, 0, -hw), v(0, 1, -r)],
  ];
  const pos = new Float32Array(tris.flat(2));
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Far-macro ground sampler (GPU eval once, CPU bilinear after)
// ---------------------------------------------------------------------------

async function evalFarGrid(renderer: Renderer, hf: Heightfield): Promise<Float32Array> {
  const n = FARGRID_RX * FARGRID_RZ;
  const buf = instancedArray(n, 'float');
  const kernel = Fn(() => {
    const i = instanceIndex;
    If(i.greaterThanEqual(n), () => {
      Return();
    });
    const ix = i.mod(FARGRID_RX);
    const iz = i.div(FARGRID_RX);
    const wx = float(ix)
      .add(0.5)
      .div(FARGRID_RX)
      .mul(FARGRID_X1 - FARGRID_X0)
      .add(FARGRID_X0);
    const wz = float(iz)
      .add(0.5)
      .div(FARGRID_RZ)
      .mul(FARGRID_Z1 - FARGRID_Z0)
      .add(FARGRID_Z0);
    const m = macroTerrain(vec2(wx, wz), hf.mp, 'far');
    buf.element(i).assign(m.height);
  })().compute(n);
  kernel.setName('dwellingFarGround');
  await renderer.computeAsync(kernel);
  const ab = await renderer.getArrayBufferAsync(
    buf.value as Parameters<Renderer['getArrayBufferAsync']>[0],
  );
  return new Float32Array(ab);
}

/** bilinear far-macro height (world m) — valid inside the FARGRID rect */
function farGridAt(grid: Float32Array, x: number, z: number): number {
  const gx = Math.min(
    Math.max(((x - FARGRID_X0) / (FARGRID_X1 - FARGRID_X0)) * FARGRID_RX - 0.5, 0),
    FARGRID_RX - 1.001,
  );
  const gz = Math.min(
    Math.max(((z - FARGRID_Z0) / (FARGRID_Z1 - FARGRID_Z0)) * FARGRID_RZ - 0.5, 0),
    FARGRID_RZ - 1.001,
  );
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const fx = gx - x0;
  const fz = gz - z0;
  const at = (xx: number, zz: number): number =>
    grid[Math.min(zz, FARGRID_RZ - 1) * FARGRID_RX + Math.min(xx, FARGRID_RX - 1)] ?? PLATEAU_Y;
  const a = at(x0, z0) * (1 - fx) + at(x0 + 1, z0) * fx;
  const b = at(x0, z0 + 1) * (1 - fx) + at(x0 + 1, z0 + 1) * fx;
  return a * (1 - fz) + b * fz;
}

// ---------------------------------------------------------------------------
// Instance collection
// ---------------------------------------------------------------------------

interface Inst {
  x: number;
  y: number;
  z: number;
  yaw: number;
  sx: number;
  sy: number;
  sz: number;
}

class Pool {
  readonly items: Inst[] = [];
  add(x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number): void {
    this.items.push({ x, y, z, yaw, sx, sy, sz });
  }
}

function bake(
  geo: BufferGeometry,
  mat: MeshStandardNodeMaterial,
  pool: Pool,
  castShadow: boolean,
): InstancedMesh | null {
  if (pool.items.length === 0) return null;
  const mesh = new InstancedMesh(geo, mat, pool.items.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const Y = new Vector3(0, 1, 0);
  pool.items.forEach((it, idx) => {
    p.set(it.x, it.y, it.z);
    q.setFromAxisAngle(Y, it.yaw);
    s.set(it.sx, it.sy, it.sz);
    m.compose(p, q, s);
    mesh.setMatrixAt(idx, m);
  });
  mesh.computeBoundingSphere();
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

interface NearKit {
  body: Pool[]; // per wall pool
  gable: Pool[]; // per roof pool
  hip: Pool[];
  frame: Pool;
  glow: Pool;
  door: Pool;
  post: Pool;
  well: Pool;
}

/**
 * One garden-court block: four attached row-house runs between four corner
 * houses, enclosing a meadow court. Units vary in width/depth/height per
 * hash (stepped facades and rooflines — pillar C), doors + windows face the
 * court, street faces carry windows too. 1-2 gate gaps flanked by posts.
 */
function buildNearBlock(
  cx: number,
  cz: number,
  seed: number,
  ground: (x: number, z: number) => number,
  kit: NearKit,
): void {
  const rand = rng(seed);
  const half = BLOCK / 2;
  const CORNER = 9;
  const runSpan = BLOCK - 2 * CORNER; // 90 m of row-houses per side
  const gateSides = new Set<number>();
  // 1-2 gates; south side (toward the city/lane) always a candidate
  gateSides.add(rand() < 0.65 ? 2 : (rand() * 4) | 0);
  if (rand() < 0.45) gateSides.add((rand() * 4) | 0);

  // corner houses (square, hipped, slightly taller)
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      const px = cx + sx * (half - CORNER / 2);
      const pz = cz + sz * (half - CORNER / 2);
      const h = 4.6 + rand() * 1.6;
      const y = ground(px, pz) - 0.55;
      const pool = (rand() * kit.body.length) | 0;
      kit.body[pool]?.add(px, y, pz, 0, CORNER, h, CORNER);
      kit.hip[(rand() * kit.hip.length) | 0]?.add(px, y + h, pz, rand() < 0.5 ? 0 : Math.PI / 2, CORNER + 0.7, 2.1 + rand() * 0.6, CORNER + 0.7);
    }
  }

  // four row-house runs. side: 0 = north (-Z edge), 1 = east, 2 = south, 3 = west
  for (let side = 0; side < 4; side++) {
    const horizontal = side === 0 || side === 2;
    const edge = side === 0 ? -1 : side === 2 ? 1 : side === 1 ? 1 : -1;
    // gate gap position within the run (one unit wide)
    const hasGate = gateSides.has(side);
    const gateAt = -runSpan / 2 + runSpan * (0.35 + rand() * 0.3); // run-relative gate center
    const gateW = 4.2;
    let gateDone = !hasGate;
    // fill the run with units
    let u = -runSpan / 2;
    while (u < runSpan / 2 - 3) {
      const w = Math.min(5.5 + rand() * 4.0, runSpan / 2 - u);
      // gate: leave a gap in the run, posts just INSIDE its edges so they
      // stand clear of the flanking house faces by construction
      if (!gateDone && u + w > gateAt - gateW / 2) {
        const g0 = Math.max(u, gateAt - gateW / 2);
        const g1 = gateAt + gateW / 2;
        const wallOff = half - 4; // posts sit on the run line
        for (const gu of [g0 + 0.35, g1 - 0.35] as const) {
          const px = horizontal ? cx + gu : cx + edge * wallOff;
          const pz = horizontal ? cz + edge * wallOff : cz + gu;
          kit.post.add(px, ground(px, pz) - 0.3, pz, 0, 0.5, 2.7, 0.5);
        }
        u = g1 + 0.5;
        gateDone = true;
        continue;
      }
      const mid = u + w / 2;
      const depth = 7 + rand() * 2.5;
      const twoStory = rand() < 0.25;
      const h = twoStory ? 5.6 + rand() * 1.0 : 3.4 + rand() * 1.0;
      // house center: depth extends INWARD from the block edge
      const off = half - depth / 2;
      const px = horizontal ? cx + mid : cx + edge * off;
      const pz = horizontal ? cz + edge * off : cz + mid;
      const y = ground(px, pz) - 0.55;
      const bw = horizontal ? w : depth;
      const bd = horizontal ? depth : w;
      const pool = (rand() * kit.body.length) | 0;
      kit.body[pool]?.add(px, y, pz, 0, bw, h, bd);
      // roof: ridge along the run; occasional hip. compose() scales in
      // OBJECT space before the yaw, so pass object extents (x = across the
      // ridge = house depth, z = along the ridge = unit width) and let the
      // yaw orient them — passing world extents transposed every N/S roof
      const roofH = 1.7 + rand() * 0.9;
      const ry = y + h;
      const yawRoof = horizontal ? Math.PI / 2 : 0; // prism ridge is along Z
      if (rand() < 0.82) {
        kit.gable[(rand() * kit.gable.length) | 0]?.add(px, ry, pz, yawRoof, depth + 0.7, roofH, w + 0.7);
      } else {
        kit.hip[(rand() * kit.hip.length) | 0]?.add(px, ry, pz, yawRoof, depth + 0.7, roofH, w + 0.7);
      }
      // court-facing face: door + windows; street face: windows
      const courtDir = -edge; // court is inward
      const faceOff = depth / 2;
      const doorW = 1.15;
      const doorH = 2.25;
      const dx = horizontal ? px + (rand() - 0.5) * (w * 0.4) : px + courtDir * (faceOff + 0.02);
      const dz = horizontal ? pz + courtDir * (faceOff + 0.02) : pz + (rand() - 0.5) * (w * 0.4);
      const dyaw = horizontal ? 0 : Math.PI / 2;
      // open ring frame proud of the wall; timber leaf recessed inside it
      kit.frame.add(dx, y + 0, dz, dyaw, doorW + 0.3, doorH + 0.15, 0.16);
      kit.door.add(dx, y + 0, dz, dyaw, doorW + 0.15, doorH - 0.15, 0.06);
      const winRows = twoStory ? [1.75, h - 1.5] : [1.75];
      for (const wy of winRows) {
        for (const s of [-1, 1] as const) {
          const wu = mid + s * w * 0.27;
          if (Math.abs(wu - (horizontal ? dx - cx : dz - cz)) < 1.2 && wy < 3) continue; // don't overlap the door
          for (const dir of [courtDir, -courtDir]) {
            if (dir === -courtDir && rand() < 0.35) continue; // street faces a bit sparser
            const wx = horizontal ? cx + wu : px + dir * (faceOff + 0.02);
            const wz = horizontal ? pz + dir * (faceOff + 0.02) : cz + wu;
            // open ring frame proud of the wall; warm pane recessed inside it
            kit.frame.add(wx, y + wy - 0.72, wz, dyaw, 1.28, 1.46, 0.14);
            kit.glow.add(wx, y + wy - 0.68, wz, dyaw, 1.08, 1.3, 0.05);
          }
        }
      }
      u += w + (rand() < 0.12 ? 2.2 : 0); // occasional 2 m garden slot in the run
    }
  }

  // court well (stone ring), most blocks
  if (rand() < 0.6) {
    const wx = cx + (rand() - 0.5) * 14;
    const wz = cz + (rand() - 0.5) * 14;
    kit.well.add(wx, ground(wx, wz) - 0.25, wz, 0, 1, 1, 1);
  }
}

interface FarKit {
  podium: Pool;
  body: Pool[];
  gable: Pool[];
  hedge: Pool;
}

/**
 * One Levites'-band block: a RING of stone footing slabs under the house
 * runs (seated through the far shell's approximation — the temple-plinth
 * idiom), enclosing a court of real shell meadow. Slab tops are flat, so
 * houses need no per-unit ground sampling out here; the court and the
 * lanes stay green.
 */
function buildFarBlock(cx: number, cz: number, seed: number, grid: Float32Array, kit: FarKit): void {
  const rand = rng(seed);
  const half = FAR_BLOCK / 2;
  const SLAB = 24; // ring band width under the runs
  // per-side slab: seat the top just proud of the HIGHEST sampled shell
  // point, skirt through the lowest (chord error absorbed by the footing)
  for (let side = 0; side < 4; side++) {
    const horizontal = side === 0 || side === 2;
    const edge = side === 0 ? -1 : side === 2 ? 1 : side === 1 ? 1 : -1;
    const off = half - SLAB / 2;
    const px = horizontal ? cx : cx + edge * off;
    const pz = horizontal ? cz + edge * off : cz;
    // mitered ring: N/S slabs run the full width, E/W slabs fit between
    const len = horizontal ? FAR_BLOCK : FAR_BLOCK - 2 * SLAB;
    // The rendered shell is PIECEWISE-LINEAR over ~290-460 m ring chords, so
    // its surface at the slab can ride above the local analytic value by
    // whatever the bridged chord endpoints reach. Those endpoints are ring
    // vertices within ~half a chord (<= ~240 m), so the analytic MAX over a
    // +-240 m neighborhood upper-bounds the rendered surface — seat the top
    // just proud of THAT, and skirt through the local minimum.
    let hi = -1e9;
    let lo = 1e9;
    for (let sx = -240; sx <= 240; sx += 80) {
      for (let sz = -240; sz <= 240; sz += 80) {
        const g = farGridAt(grid, px + sx, pz + sz) - FAR_SHELL_SINK;
        hi = Math.max(hi, g);
      }
    }
    for (const t of [-0.5, 0, 0.5] as const) {
      for (const n of [-0.5, 0.5] as const) {
        const sx = horizontal ? px + t * len : px + n * SLAB;
        const sz = horizontal ? pz + n * SLAB : pz + t * len;
        lo = Math.min(lo, farGridAt(grid, sx, sz) - FAR_SHELL_SINK);
      }
    }
    const top = hi + 0.5;
    const depth = top - lo + 6;
    const sw = horizontal ? len : SLAB;
    const sd = horizontal ? SLAB : len;
    kit.podium.add(px, top - depth, pz, 0, sw, depth, sd);

    // hedge on the slab's court lip
    const hedgeOff = off - SLAB / 2 + 1.2;
    const hx = horizontal ? cx : cx + edge * hedgeOff;
    const hz = horizontal ? cz + edge * hedgeOff : cz;
    kit.hedge.add(hx, top, hz, horizontal ? 0 : Math.PI / 2, len - 4, 2.2 + rand() * 0.5, 1.1);

    // simplified house run on the slab: gables only, sand-heavy palette
    const n = 5 + ((rand() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) * (len / n) - len / 2 + (rand() - 0.5) * 3;
      const w = 8 + rand() * 5;
      const d = 8 + rand() * 3;
      const h = 4.0 + rand() * 2.4;
      const px2 = horizontal ? cx + u : px + (rand() - 0.5) * 4;
      const pz2 = horizontal ? pz + (rand() - 0.5) * 4 : cz + u;
      const bw = horizontal ? w : d;
      const bd = horizontal ? d : w;
      const pool = (rand() * kit.body.length) | 0;
      kit.body[pool]?.add(px2, top, pz2, 0, bw, h, bd);
      kit.gable[(rand() * kit.gable.length) | 0]?.add(
        px2,
        top + h,
        pz2,
        horizontal ? Math.PI / 2 : 0,
        bw + 0.6,
        1.7 + rand() * 0.9,
        bd + 0.6,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Campus assembly
// ---------------------------------------------------------------------------

export interface DwellingsDeps {
  hf: Heightfield | null;
  gi: ProbeGI | null;
  renderer: Renderer;
}

export interface DwellingsResult {
  group: Group;
  /**
   * Rendered-ground estimate for the Levites' band (far-shell surface,
   * = farMacro('far') - 2.5). Null outside the band — callers fall back to
   * the terrain groundProbe. Used to keep walk/fly grounding sane beyond
   * the heightfield mirror, where `heightAtCpu` clamps.
   */
  farGroundAt: (x: number, z: number) => number | null;
}

/** Temple plinth footprint (world m) — from templeModel/Temple.ts plinth pad. */
function templeClearRect(): { x0: number; x1: number; z0: number; z1: number } {
  // precinct half 131.25 + plinth margin 4, + the entry-#8 clear margin
  const half = 135.25 + TEMPLE_MARGIN;
  return {
    x0: TEMPLE_SITE.x - half,
    x1: TEMPLE_SITE.x + half,
    z0: TEMPLE_SITE.z - half,
    z1: TEMPLE_SITE.z + half,
  };
}

export async function buildDwellings(deps: DwellingsDeps): Promise<DwellingsResult> {
  const { hf, gi, renderer } = deps;
  const group = new Group();
  group.name = 'dwelling-campus';

  const grid = hf ? await evalFarGrid(renderer, hf) : new Float32Array(FARGRID_RX * FARGRID_RZ).fill(PLATEAU_Y);
  const ground = (x: number, z: number): number => (hf ? hf.heightAtCpu(x, z) : PLATEAU_Y);

  // shared kit geometries + material pools
  const bodyGeo = baseBox();
  const gableGeo = gablePrism();
  const hipGeo = hipRoof();
  const plateGeo = baseBox();
  const frameGeo = frameRing();
  const postGeo = baseBox();
  const hedgeGeo = baseBox();
  const podiumGeo = baseBox();
  const wellGeo = new CylinderGeometry(1.1, 1.25, 1.0, 10, 1, true);
  wellGeo.translate(0, 0.5, 0);

  const wallMats = [
    lambert(gi, 0.56, 0.5, 0.4, 0.85), // limewash
    lambert(gi, 0.44, 0.28, 0.18, 0.85), // warm sandstone (temple family)
    lambert(gi, 0.63, 0.59, 0.51, 0.82), // pale whitewash
  ];
  const roofMats = [
    lambert(gi, 0.335, 0.16, 0.1, 0.72), // fired clay
    lambert(gi, 0.29, 0.175, 0.125, 0.74), // weathered clay
  ];
  const trimMat = lambert(gi, 0.62, 0.52, 0.42, 0.7);
  const timberMat = lambert(gi, 0.15, 0.095, 0.06, 0.8);
  const stoneMat = lambert(gi, 0.3, 0.235, 0.175, 0.9);
  const hedgeMat = lambert(gi, 0.09, 0.145, 0.065, 0.95);
  const glowMat = windowGlow(1.05);

  const clear = templeClearRect();
  const intersects = (
    bx0: number,
    bx1: number,
    bz0: number,
    bz1: number,
    r: { x0: number; x1: number; z0: number; z1: number },
  ): boolean => bx1 > r.x0 && bx0 < r.x1 && bz1 > r.z0 && bz0 < r.z1;
  const processional = {
    x0: clear.x1,
    x1: PROCESSIONAL_X1,
    z0: TEMPLE_SITE.z - PROCESSIONAL_ZHALF,
    z1: TEMPLE_SITE.z + PROCESSIONAL_ZHALF,
  };

  // ---- priests' (Zadok) band: chunked column groups for cullable spheres ----
  const CHUNK_COLS = 10; // 8 chunks across the 80 columns
  const colCenters: number[] = [];
  for (let k = 0; k < COLS_PER_SIDE; k++) {
    colCenters.push(PITCH / 2 + k * PITCH);
    colCenters.push(-(PITCH / 2 + k * PITCH));
  }
  colCenters.sort((a, b) => a - b);

  let nearBlocks = 0;
  let nearHouses = 0;
  for (let c0 = 0; c0 < colCenters.length; c0 += CHUNK_COLS) {
    const kit: NearKit = {
      body: wallMats.map(() => new Pool()),
      gable: roofMats.map(() => new Pool()),
      hip: roofMats.map(() => new Pool()),
      frame: new Pool(),
      glow: new Pool(),
      door: new Pool(),
      post: new Pool(),
      well: new Pool(),
    };
    for (let ci = c0; ci < Math.min(c0 + CHUNK_COLS, colCenters.length); ci++) {
      const cx = colCenters[ci] ?? 0;
      for (let j = 0; j < NEAR_ROWS.length; j++) {
        const cz = NEAR_ROWS[j] ?? 0;
        const b = BLOCK / 2;
        if (intersects(cx - b, cx + b, cz - b, cz + b, clear)) continue;
        if (intersects(cx - b, cx + b, cz - b, cz + b, processional)) continue;
        const before = kit.body.reduce((s, p) => s + p.items.length, 0);
        buildNearBlock(cx, cz, cellSeed(1, ci, j), ground, kit);
        nearHouses += kit.body.reduce((s, p) => s + p.items.length, 0) - before;
        nearBlocks++;
      }
    }
    const chunk = new Group();
    chunk.name = `priests-band-${c0 / CHUNK_COLS}`;
    kit.body.forEach((p, i) => {
      const m = bake(bodyGeo, wallMats[i] ?? trimMat, p, true);
      if (m) chunk.add(m);
    });
    kit.gable.forEach((p, i) => {
      const m = bake(gableGeo, roofMats[i] ?? trimMat, p, true);
      if (m) chunk.add(m);
    });
    kit.hip.forEach((p, i) => {
      const m = bake(hipGeo, roofMats[i] ?? trimMat, p, true);
      if (m) chunk.add(m);
    });
    const frames = bake(frameGeo, trimMat, kit.frame, false);
    if (frames) chunk.add(frames);
    const glows = bake(plateGeo, glowMat, kit.glow, false);
    if (glows) chunk.add(glows);
    const doors = bake(plateGeo, timberMat, kit.door, false);
    if (doors) chunk.add(doors);
    const posts = bake(postGeo, stoneMat, kit.post, false);
    if (posts) chunk.add(posts);
    const wells = bake(wellGeo, stoneMat, kit.well, false);
    if (wells) chunk.add(wells);
    group.add(chunk);
  }

  // ---- Levites' band: podium blocks on the far shell ----
  const FAR_CHUNK_COLS = 10; // 4 chunks across 40 columns
  const farCols: number[] = [];
  for (let k = 0; k < FAR_COLS_PER_SIDE; k++) {
    farCols.push(FAR_PITCH / 2 + k * FAR_PITCH);
    farCols.push(-(FAR_PITCH / 2 + k * FAR_PITCH));
  }
  farCols.sort((a, b) => a - b);

  let farBlocks = 0;
  for (let c0 = 0; c0 < farCols.length; c0 += FAR_CHUNK_COLS) {
    const kit: FarKit = {
      podium: new Pool(),
      body: [wallMats[1] ?? trimMat, wallMats[0] ?? trimMat].map(() => new Pool()),
      gable: [new Pool()],
      hedge: new Pool(),
    };
    for (let ci = c0; ci < Math.min(c0 + FAR_CHUNK_COLS, farCols.length); ci++) {
      const cx = farCols[ci] ?? 0;
      for (let j = 0; j < FAR_ROWS; j++) {
        const cz = FAR_ROW0 - j * FAR_PITCH;
        // organic thinning northward (the band tapers toward the rim)
        if (rng(cellSeed(2, ci, j))() < 0.06 + j * 0.012) continue;
        buildFarBlock(cx, cz, cellSeed(3, ci, j), grid, kit);
        farBlocks++;
      }
    }
    const chunk = new Group();
    chunk.name = `levites-band-${c0 / FAR_CHUNK_COLS}`;
    const pod = bake(podiumGeo, stoneMat, kit.podium, false);
    if (pod) chunk.add(pod);
    // sand-heavy palette differentiates the band at range
    const bodyA = bake(bodyGeo, wallMats[1] ?? trimMat, kit.body[0] ?? new Pool(), false);
    if (bodyA) chunk.add(bodyA);
    const bodyB = bake(bodyGeo, wallMats[0] ?? trimMat, kit.body[1] ?? new Pool(), false);
    if (bodyB) chunk.add(bodyB);
    const roofs = bake(gableGeo, roofMats[0] ?? trimMat, kit.gable[0] ?? new Pool(), false);
    if (roofs) chunk.add(roofs);
    const hedges = bake(hedgeGeo, hedgeMat, kit.hedge, false);
    if (hedges) chunk.add(hedges);
    group.add(chunk);
  }

  // eslint-disable-next-line no-console
  console.info(
    `[dwellings] priests ${nearBlocks} blocks / ${nearHouses} houses; levites ${farBlocks} podium blocks`,
  );

  const farGroundAt = (x: number, z: number): number | null => {
    // active only BEYOND the tile edge — the CDLOD tiles render baked ground
    // (the base probe's own source) all the way to |z| = WORLD_HALF; the
    // shell surface this sampler mirrors only takes over past it
    if (x < FARGRID_X0 || x > FARGRID_X1 || z < FARGRID_Z0 || z > -(WORLD_HALF + 2)) {
      return null;
    }
    return farGridAt(grid, x, z) - FAR_SHELL_SINK;
  };

  return { group, farGroundAt };
}
