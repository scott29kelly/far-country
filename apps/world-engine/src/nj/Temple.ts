/**
 * Ezekiel's temple — the measured compound of Ezek 40-42 + the 43:13-17
 * altar, built in WORLD SPACE at literal scale (1 long cubit = 0.525 m,
 * ADR 0018) from the cited measurement dataset (ADR 0017): every dimension
 * below traces to `EZT[...]` (templeMeasurements.gen.ts) or to an
 * interpretive constant in `templeModel.INTERP` recorded in
 * RENDERING-DECISIONS entry #7.
 *
 * Identity (USER-REFS directive #5, CITY-QUALITY-BAR delta #8): a fortified
 * warm-sandstone compound, architecturally alien to the gold-glass city —
 * one-reed perimeter wall with three tower-gatehouses (east, north, south;
 * none on the west, Ezek 40; 42:15-20), the outer court raised the seven
 * steps its gates are climbed by (Ezek 40:22, 26), the inner court a further
 * eight behind the three inner gates (Ezek 40:31, 34, 37) — both flights
 * rendered and walkable — the house on its six-cubit platform (Ezek 41:8), the eleven-cubit
 * altar with eastward steps (Ezek 43:13-17), the western building, and the
 * two priests' chamber blocks (Ezek 42:1-14). Crenellations and corner
 * towers are art direction; window glow renders Ezek 40:16's windows within
 * the base-tier bloom contract (< 1.5 luminance).
 *
 * Court dressing (the CITY-QUALITY-BAR walking-range pass, temple half): the
 * outer court carries Ezekiel's own LOWER PAVEMENT — a pavement "all around
 * the court" whose breadth answers the gates' length (Ezek 40:17-18) —
 * rendered as a pale border frame on the court slab, with the THIRTY
 * chambers the same verse counts standing on it, flanking the three gates
 * (count cited, dimensions in INTERP). Every big horizontal (plinth, court,
 * terrace, house platform) takes a world-space slab-joint paving material
 * (the city terraces' pavingDetail idiom at 1:1 scale), and the terrace lip
 * and altar take kerb/apron border courses — border-and-field, not a bare
 * slab at eye level.
 *
 * The survey's own east-west arithmetic closes at 500 cubits (gate 50 +
 * court 100 + gate 50 + inner court 100 + house 100 + yard/building 100 —
 * Ezek 40:15, 19, 47; 41:13; 42:16-20) and this build inherits it exactly.
 *
 * Layout frame: compound centered at TEMPLE_SITE, +X = east (the temple
 * faces east, Ezek 43:1-4), -Z = north. Everything rests on a stone plinth
 * seated on the rolling meadow (terrain untouched).
 */

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Vector3,
} from 'three';
import { IrradianceNode, MeshStandardNodeMaterial } from 'three/webgpu';
import {
  cameraPosition,
  float,
  floor as tslFloor,
  fract,
  max as tslMax,
  mix,
  normalWorld,
  positionWorld,
  smoothstep,
  vec3,
} from 'three/tsl';

import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NF, NV3 } from '../gpu/TSLTypes';
import type { Heightfield } from '../world/Heightfield';
import { PLATEAU_Y } from './rimModel';
import { INTERP, LONG_CUBIT_M, TEMPLE_SITE, count, meters } from './templeModel';

const SAND = new Color(0.4, 0.225, 0.14); // warm red sandstone (USER-REFS #5)
const SAND_DARK = new Color(0.32, 0.165, 0.1);
const TRIM = new Color(0.68, 0.56, 0.44); // pale course banding

function patchGI(mat: MeshStandardNodeMaterial, gi: ProbeGI | null): void {
  if (!gi) return;
  const irr = gi.irradiance(
    positionWorld as unknown as NV3,
    normalWorld as unknown as NV3,
  );
  (mat as unknown as { setupLightMap: () => unknown }).setupLightMap = () =>
    new IrradianceNode(irr as unknown as ConstructorParameters<typeof IrradianceNode>[0]);
}

function stoneMaterial(gi: ProbeGI | null, color: Color, rough = 0.85): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.color.copy(color);
  m.roughness = rough;
  m.metalness = 0;
  patchGI(m, gi);
  return m;
}

/**
 * Slab-joint articulation for the compound's pavements — the city terraces'
 * pavingDetail idiom (CityMassing.ts) at the temple's 1:1 world scale. A
 * floor is looked ALONG, so its near read comes from centimetre joints and
 * per-slab tone, not modeled relief (Pillar A's 0.3 m reveal clause is
 * written for walls you look ACROSS). World-space, so the grid stays put
 * under a walking camera; masked to up-facing surfaces so terrace risers and
 * slab edges stay clean stone; faded with distance before the fixed-width
 * grid can alias into TRAA shimmer.
 */
function pavingDetail(m: MeshStandardNodeMaterial, base: Color, pitch: number): void {
  const p = positionWorld.xz.div(pitch);
  const g = fract(p) as unknown as { x: NF; y: NF };
  const dx = g.x.sub(0.5).abs() as unknown as NF;
  const dz = g.y.sub(0.5).abs() as unknown as NF;
  // 0 across a slab face, 1 in the joint
  const joint = smoothstep(0.465, 0.5, tslMax(dx, dz) as unknown as NF) as unknown as NF;
  // per-slab tone: a cheap hash of the slab's integer cell
  const cell = tslFloor(p) as unknown as { x: NF; y: NF };
  const h = fract(
    cell.x
      .mul(0.1031)
      .add(cell.y.mul(0.1741))
      .add(cell.x.mul(cell.y).mul(0.0973))
      .sin()
      .mul(43758.5453),
  ) as unknown as NF;
  const tone = h.mul(0.12).add(0.94) as unknown as NF;
  const near = positionWorld.distance(cameraPosition) as unknown as NF;
  const fade = smoothstep(170, 55, near) as unknown as NF;
  const up = smoothstep(0.55, 0.8, normalWorld.y as unknown as NF) as unknown as NF;
  const k = fade.mul(up) as unknown as NF;
  const j = joint.mul(k) as unknown as NF;
  m.colorNode = vec3(base.r, base.g, base.b)
    .mul(mix(float(1.0), tone, k) as unknown as NF)
    .mul(mix(float(1.0), float(0.68), j) as unknown as NF) as unknown as NV3;
}

function glowMaterial(k: number): MeshStandardNodeMaterial {
  // warm interior light through openings/windows (Ezek 40:16; the glory
  // fills the house, Ezek 43:4-5). Base-tier bloom contract: luminance
  // stays under 1.5 (only the city crown + glory cross it).
  const m = new MeshStandardNodeMaterial();
  m.color.setRGB(0.2, 0.14, 0.08);
  m.emissiveNode = vec3(1.0, 0.72, 0.42).mul(k) as unknown as typeof m.emissiveNode;
  m.side = DoubleSide;
  return m;
}

function box(
  g: Group,
  mat: MeshStandardNodeMaterial,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}

/** World-space axis-aligned massing volume (walk collision + floors). */
export interface TempleAabb {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/** Record a world AABB from the same w/h/d/centre the geometry call uses. */
function recordSolid(
  out: TempleAabb[],
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): void {
  out.push({
    x0: x - w / 2,
    x1: x + w / 2,
    y0: y - h / 2,
    y1: y + h / 2,
    z0: z - d / 2,
    z1: z + d / 2,
  });
}

/**
 * `box` + its collision volume in one call — the ONLY way a mass enters both
 * the scene and the collider set, so the two cannot desync. Filigree keeps
 * calling plain `box` (see the module doc's what-collides policy).
 */
function solidBox(
  g: Group,
  out: TempleAabb[],
  mat: MeshStandardNodeMaterial,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): Mesh {
  recordSolid(out, w, h, d, x, y, z);
  return box(g, mat, w, h, d, x, y, z);
}

/** A tower-gatehouse with an arched, glowing portal through its long axis. */
function gatehouse(
  g: Group,
  out: TempleAabb[],
  sand: MeshStandardNodeMaterial,
  trim: MeshStandardNodeMaterial,
  glow: MeshStandardNodeMaterial,
  cx: number,
  baseY: number,
  cz: number,
  yaw: number,
  depth: number,
  width: number,
  openW: number,
  h: number,
): void {
  const gh = new Group();
  gh.position.set(cx, baseY, cz);
  gh.rotation.y = yaw;
  // local frame: portal runs along +X (depth), width along Z
  const jambW = (width - openW) / 2;
  const openH = h * 0.62;
  // yaw is only ever 0 (east gate) or PI/2 (north/south) — a quarter turn
  // swaps the local X/Z extents, so the world AABB stays exact rather than
  // conservative. Local (lx, lz) maps to world (lz, -lx) at PI/2.
  const turned = Math.abs(Math.sin(yaw)) > 0.5;
  const worldSolid = (lw: number, lh: number, ld: number, lz: number, ly: number): void => {
    const w = turned ? ld : lw;
    const d = turned ? lw : ld;
    const x = turned ? cx + lz : cx;
    const z = turned ? cz : cz + lz;
    recordSolid(out, w, lh, d, x, baseY + ly, z);
  };
  for (const s of [-1, 1] as const) {
    const jamb = new Mesh(new BoxGeometry(depth, h, jambW), sand);
    jamb.position.set(0, h / 2, s * (openW / 2 + jambW / 2));
    jamb.castShadow = true;
    jamb.receiveShadow = true;
    gh.add(jamb);
    worldSolid(depth, h, jambW, s * (openW / 2 + jambW / 2), h / 2);
  }
  const lintel = new Mesh(new BoxGeometry(depth, h - openH, openW), sand);
  lintel.position.set(0, openH + (h - openH) / 2, 0);
  lintel.castShadow = true;
  gh.add(lintel);
  // the lintel spans the portal ABOVE the opening — recorded so a flier
  // cannot pass through the masonry over a walker's head
  worldSolid(depth, h - openH, openW, 0, openH + (h - openH) / 2);
  // arch heads + glow planes at both mouths
  for (const e of [-1, 1] as const) {
    const arch = new Mesh(new CircleGeometry(openW / 2, 16, 0, Math.PI), trim);
    arch.position.set(e * (depth / 2 + 0.05), openH, 0);
    arch.rotation.y = e > 0 ? Math.PI / 2 : -Math.PI / 2;
    gh.add(arch);
    const light = new Mesh(new BoxGeometry(0.15, openH * 0.92, openW * 0.86), glow);
    light.position.set(e * (depth / 2 - 1.2), openH * 0.46, 0);
    gh.add(light);
  }
  // cornice + parapet
  const cor = new Mesh(new BoxGeometry(depth + 0.8, 0.5, width + 0.8), trim);
  cor.position.set(0, h + 0.25, 0);
  cor.castShadow = true;
  gh.add(cor);
  // flank dressing — the 26 m side faces are the tallest planes a walker
  // stands beside, and they were single unbroken boxes (Pillar A). String
  // courses at the lintel line and below the cornice, corner pilaster
  // strips, and a row of narrow glowing slits: Ezek 40:16's windows are IN
  // the gates ("windows all around inside"), so the slits are the cited
  // window row, the courses/pilasters the same art-direction class as the
  // merlons. All filigree (proud < 0.1 m — no solids).
  for (const s of [-1, 1] as const) {
    const fz = s * (width / 2 + 0.045);
    for (const cy of [openH, h - 0.7] as const) {
      const sc = new Mesh(new BoxGeometry(depth - 0.3, 0.28, 0.09), trim);
      sc.position.set(0, cy, fz);
      sc.castShadow = true;
      gh.add(sc);
    }
    for (const e of [-1, 1] as const) {
      const pil = new Mesh(new BoxGeometry(0.5, h * 0.97, 0.1), sand);
      pil.position.set(e * (depth / 2 - 0.55), (h * 0.97) / 2, fz);
      pil.castShadow = true;
      gh.add(pil);
    }
    for (let i = 0; i < 4; i++) {
      const wx = -depth / 2 + 5 + (i * (depth - 10)) / 3;
      const slit = new Mesh(new BoxGeometry(0.5, 1.7, 0.08), glow);
      slit.position.set(wx, h * 0.6, fz);
      gh.add(slit);
    }
  }
  g.add(gh);
}

export interface TempleDeps {
  hf: Heightfield | null;
  gi: ProbeGI | null;
}

export interface TempleResult {
  group: Group;
  /**
   * Every massing volume in world space, recorded by the geometry calls
   * themselves — the collider set IS the geometry. Consumed by
   * templeCollide.ts for lateral collision and walk floors.
   */
  solids: TempleAabb[];
}

/** Build the compound (world space; add `group` directly to the scene). */
export function buildTemple(deps: TempleDeps): TempleResult {
  const { hf, gi } = deps;
  const g = new Group();
  g.name = 'ezekiel-temple';
  const solids: TempleAabb[] = [];

  const c = { x: TEMPLE_SITE.x, z: TEMPLE_SITE.z };
  const half = meters('ezt-precinct-side') / 2; // 500 cu (Ezek 42:16-20, ESV)
  const wallT = meters('ezt-outer-wall-thickness'); // 1 reed (Ezek 40:5)
  const wallH = meters('ezt-outer-wall-height'); // 1 reed (Ezek 40:5)
  const gateL = meters('ezt-gate-length'); // 50 cu (Ezek 40:15)
  const gateW = meters('ezt-gate-breadth'); // 25 cu (Ezek 40:13)
  const gateOpen = meters('ezt-gate-opening-width'); // 10 cu (Ezek 40:11)
  const innerSide = meters('ezt-inner-court-side'); // 100 cu (Ezek 40:47)
  const houseL = meters('ezt-house-length'); // 100 cu (Ezek 41:13)
  // house envelope breadth: nave 20 + 2x(wall 6 + side chamber 4 + outer
  // wall 5) = 50 cu (Ezek 41:2, 5, 9)
  const houseW =
    meters('ezt-nave-breadth') +
    2 *
      (meters('ezt-house-wall-thickness') +
        meters('ezt-side-chamber-breadth') +
        meters('ezt-side-chamber-outer-wall'));
  const platformH = meters('ezt-house-platform-height'); // 6 cu (Ezek 41:8)

  // ground: seat the plinth on the rolling meadow (terrain untouched)
  const sample = (dx: number, dz: number): number =>
    hf ? hf.heightAtCpu(c.x + dx, c.z + dz) : PLATEAU_Y;
  let gMax = -1e9;
  for (const [dx, dz] of [
    [0, 0],
    [half, half],
    [-half, half],
    [half, -half],
    [-half, -half],
  ] as const) {
    gMax = Math.max(gMax, sample(dx, dz));
  }
  const plinthTop = gMax + 0.8;

  const sand = stoneMaterial(gi, SAND);
  const sandDark = stoneMaterial(gi, SAND_DARK, 0.9);
  const trim = stoneMaterial(gi, TRIM, 0.7);
  const glow = glowMaterial(1.25);
  const glowSoft = glowMaterial(0.85);
  // pavement materials: the field is coursed sandstone on a three-cubit slab
  // grid; the pale border (Ezek 40:17-18's lower pavement, the altar apron,
  // the thresholds) courses tighter, so border and field read as different
  // work even where the tones sit close
  const pavedField = stoneMaterial(gi, SAND);
  pavingDetail(pavedField, SAND, 3 * LONG_CUBIT_M);
  const PALE = new Color().copy(TRIM).lerp(SAND, 0.25);
  const pavedPale = stoneMaterial(gi, PALE, 0.8);
  pavingDetail(pavedPale, PALE, 2 * LONG_CUBIT_M);
  const pavedPlinth = stoneMaterial(gi, SAND_DARK, 0.9);
  pavingDetail(pavedPlinth, SAND_DARK, 3 * LONG_CUBIT_M);

  // ---------------------------------------------------------------- plinth
  const plinthPad = half + INTERP.plinthMargin;
  solidBox(g, solids, pavedPlinth, plinthPad * 2, 7, plinthPad * 2, c.x, plinthTop - 3.5, c.z);

  // ------------------------------------------------- perimeter wall + towers
  // three gate gaps (east, north, south — no west gate, Ezek 42:15-20's
  // circuit lists gates only where chapters 40 describes them)
  const y0 = plinthTop;
  const wallSeg = (w: number, d: number, x: number, z: number): void => {
    solidBox(g, solids, sand, w, wallH, d, c.x + x, y0 + wallH / 2, c.z + z);
  };
  const sideRun = half - gateW / 2; // wall length each side of a gate gap
  // east wall (gap at z=0): two segments running north-south
  wallSeg(wallT, sideRun, half - wallT / 2, -(gateW / 2 + sideRun / 2));
  wallSeg(wallT, sideRun, half - wallT / 2, gateW / 2 + sideRun / 2);
  // west wall: solid
  wallSeg(wallT, half * 2, -(half - wallT / 2), 0);
  // north wall (gap at x=0)
  wallSeg(sideRun, wallT, -(gateW / 2 + sideRun / 2), -(half - wallT / 2));
  wallSeg(sideRun, wallT, gateW / 2 + sideRun / 2, -(half - wallT / 2));
  // south wall (gap at x=0)
  wallSeg(sideRun, wallT, -(gateW / 2 + sideRun / 2), half - wallT / 2);
  wallSeg(sideRun, wallT, gateW / 2 + sideRun / 2, half - wallT / 2);
  // corner towers (art direction — USER-REFS #5)
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      solidBox(
        g,
        solids,
        sand,
        INTERP.towerSide,
        INTERP.towerH,
        INTERP.towerSide,
        c.x + sx * (half - INTERP.towerSide / 2),
        y0 + INTERP.towerH / 2,
        c.z + sz * (half - INTERP.towerSide / 2),
      );
      box(
        g,
        trim,
        INTERP.towerSide + 0.7,
        0.45,
        INTERP.towerSide + 0.7,
        c.x + sx * (half - INTERP.towerSide / 2),
        y0 + INTERP.towerH + 0.22,
        c.z + sz * (half - INTERP.towerSide / 2),
      );
    }
  }

  // --------------------------------------------------------- raised outer court
  // The outer gates are climbed by seven steps (Ezek 40:22, 26 — 40:6 climbs
  // the east one), so the whole outer court stands that flight above the
  // plinth. One pavement slab spans the walled interior, inset to the walls'
  // inner faces (the wall boxes own the exterior planes — no coplanar
  // fighting); a threshold strip through each gate gap carries the portal
  // floor across the wall-thickness band to meet the flight outside.
  const outerRise = count('ezt-outer-gate-steps') * INTERP.stepRise;
  const innerRise = count('ezt-inner-gate-steps') * INTERP.stepRise;
  const courtTop = y0 + outerRise;
  const slabHalf = half - wallT;
  solidBox(g, solids, pavedField, slabHalf * 2, outerRise, slabHalf * 2, c.x, y0 + outerRise / 2, c.z);
  solidBox(g, solids, pavedPale, wallT, outerRise, gateW, c.x + half - wallT / 2, y0 + outerRise / 2, c.z);
  solidBox(g, solids, pavedPale, gateW, outerRise, wallT, c.x, y0 + outerRise / 2, c.z - (half - wallT / 2));
  solidBox(g, solids, pavedPale, gateW, outerRise, wallT, c.x, y0 + outerRise / 2, c.z + (half - wallT / 2));

  // ------------------------------------------------------- the lower pavement
  // Ezek 40:17-18: "a pavement, all around the court ... the pavement ran
  // along the side of the gates, corresponding to the length of the gates.
  // This was the lower pavement." Rendered as a pale border frame lying on
  // the court slab, its breadth the gates' 50 cubits — border-and-field, the
  // same profile logic as the city's pavementCourses. The 5 cm lip is render
  // articulation far under STEP_OVER; recorded, so feet stand ON the
  // pavement rather than 5 cm inside it. (The frame's west run is largely
  // hidden beneath the inner terrace — kept, because the verse says all
  // around, and its two corner reaches show.)
  const paveB = meters('ezt-gate-length');
  const lip = 0.05;
  const bandY = courtTop + lip / 2;
  solidBox(g, solids, pavedPale, paveB, lip, slabHalf * 2, c.x + slabHalf - paveB / 2, bandY, c.z);
  solidBox(g, solids, pavedPale, paveB, lip, slabHalf * 2, c.x - slabHalf + paveB / 2, bandY, c.z);
  solidBox(g, solids, pavedPale, slabHalf * 2 - 2 * paveB, lip, paveB, c.x, bandY, c.z - slabHalf + paveB / 2);
  solidBox(g, solids, pavedPale, slabHalf * 2 - 2 * paveB, lip, paveB, c.x, bandY, c.z + slabHalf - paveB / 2);

  // --------------------------------------------------------- outer gatehouses
  // 50 x 25 cu tower-gatehouses projecting inward from the wall line
  // (Ezek 40:6-16, 20-27), standing at court level — their seven-step
  // flights descend outside the wall face (built below with the inner ones)
  gatehouse(g, solids, sand, trim, glow, c.x + half - gateL / 2, courtTop, c.z, 0, gateL, gateW, gateOpen, INTERP.gatehouseH);
  gatehouse(g, solids, sand, trim, glow, c.x, courtTop, c.z - (half - gateL / 2), Math.PI / 2, gateL, gateW, gateOpen, INTERP.gatehouseH);
  gatehouse(g, solids, sand, trim, glow, c.x, courtTop, c.z + (half - gateL / 2), Math.PI / 2, gateL, gateW, gateOpen, INTERP.gatehouseH);

  // ------------------------------------------------------------ inner terrace
  // the inner court stands the inner gates' eight-step flight above the
  // outer court (Ezek 40:31, 34, 37); its west edge stops at the west
  // wall's inner face (the wall owns the exterior plane)
  const terrX0 = -half + wallT; // west wall inner face
  const terrX1 = innerSide; // inner-gate outer face (x = +52.5)
  const terrW = terrX1 - terrX0;
  const terrD = innerSide * 2 + 16; // spans inner court + both inner N/S gates
  solidBox(
    g,
    solids,
    pavedField,
    terrW,
    innerRise,
    terrD,
    c.x + (terrX0 + terrX1) / 2,
    courtTop + innerRise / 2,
    c.z,
  );
  const terrTop = courtTop + innerRise;

  // --------------------------------------------------------- inner gatehouses
  gatehouse(g, solids, sand, trim, glow, c.x + innerSide - gateL / 2, terrTop, c.z, 0, gateL, gateW, gateOpen, INTERP.gatehouseH);
  gatehouse(g, solids, sand, trim, glow, c.x, terrTop, c.z - (innerSide - gateL / 2), Math.PI / 2, gateL, gateW, gateOpen, INTERP.gatehouseH);
  gatehouse(g, solids, sand, trim, glow, c.x, terrTop, c.z + (innerSide - gateL / 2), Math.PI / 2, gateL, gateW, gateOpen, INTERP.gatehouseH);

  // ------------------------------------------------------------------- altar
  // Ezek 43:13-17: base + two ledges + hearth (11 cu of rise), hearth 12 cu
  // square on a 14 cu ledge with a one-cubit surround; four horns; steps east
  const hearthSide = meters('ezt-altar-hearth-side');
  const ledgeSide = meters('ezt-altar-ledge-side');
  const baseSide = ledgeSide + 2 * meters('ezt-altar-surround-base');
  const hBase = meters('ezt-altar-base-height');
  const hLower = meters('ezt-altar-lower-ledge-rise');
  const hUpper = meters('ezt-altar-upper-ledge-rise');
  const hHearth = meters('ezt-altar-hearth-height');
  let ay = terrTop;
  solidBox(g, solids, sandDark, baseSide, hBase, baseSide, c.x, ay + hBase / 2, c.z);
  ay += hBase;
  solidBox(g, solids, sand, ledgeSide, hLower, ledgeSide, c.x, ay + hLower / 2, c.z);
  ay += hLower;
  solidBox(g, solids, sand, ledgeSide - 1.05, hUpper, ledgeSide - 1.05, c.x, ay + hUpper / 2, c.z);
  ay += hUpper;
  solidBox(g, solids, sandDark, hearthSide, hHearth, hearthSide, c.x, ay + hHearth / 2, c.z);
  ay += hHearth;
  // four horns (count grounded, Ezek 43:15; horn size interpretive)
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      box(
        g,
        sandDark,
        0.6,
        0.7,
        0.6,
        c.x + sx * (hearthSide / 2 - 0.4),
        ay + 0.35,
        c.z + sz * (hearthSide / 2 - 0.4),
      );
    }
  }
  // altar steps face east (Ezek 43:17)
  for (let i = 0; i < 6; i++) {
    const w = 1.1;
    solidBox(
      g,
      solids,
      sand,
      w,
      (hBase + hLower + hUpper) * (1 - i / 6),
      3.2,
      c.x + baseSide / 2 + w / 2 + i * w,
      terrTop + ((hBase + hLower + hUpper) * (1 - i / 6)) / 2,
      c.z,
    );
  }
  // a pale paving apron squares the altar off from the terrace field
  // (border-and-field: the terrace's most important station gets its
  // boundary stated; breadth is art direction)
  solidBox(g, solids, pavedPale, baseSide + 5, 0.04, baseSide + 5, c.x, terrTop + 0.02, c.z);

  // ---------------------------------------------------------- house platform
  // the house band occupies x -26.25..-78.75 (100 cu, Ezek 41:13); its
  // six-cubit platform (Ezek 41:8) is climbed by ten steps on the east
  // (Ezek 40:49)
  const px1 = -innerSide / 2; // -26.25
  const px0 = px1 - houseL; // -78.75
  const padW = houseL + 6;
  const padD = houseW + 2 * meters('ezt-free-space-breadth') + 6;
  solidBox(g, solids, pavedField, padW, platformH, padD, c.x + (px0 + px1) / 2, terrTop + platformH / 2, c.z);
  const padTop = terrTop + platformH;
  const houseSteps = count('ezt-house-steps');
  for (let i = 0; i < houseSteps; i++) {
    const rise = (platformH * (houseSteps - i)) / houseSteps;
    solidBox(
      g,
      solids,
      sand,
      1.0,
      rise,
      meters('ezt-house-gate-breadth') + 2,
      c.x + px1 + 3 + i * 1.0,
      terrTop + rise / 2,
      c.z,
    );
  }

  // ------------------------------------------------------------------- house
  // side-chamber shoulder: full 50-cu envelope, three stories (Ezek 41:5-9)
  const shoulderH = count('ezt-side-chamber-stories') * INTERP.storyH;
  solidBox(g, solids, sand, houseL, shoulderH, houseW, c.x + (px0 + px1) / 2, padTop + shoulderH / 2, c.z);
  // sanctuary core: nave + walls (20 + 6 + 6 = 32 cu wide), rising to the
  // interpretive ~30-cubit wall height (RENDERING-DECISIONS #7)
  const coreW = meters('ezt-nave-breadth') + 2 * meters('ezt-house-wall-thickness');
  solidBox(g, solids, sand, houseL, INTERP.houseWallH, coreW, c.x + (px0 + px1) / 2, padTop + INTERP.houseWallH / 2, c.z);
  // pale course bands (trim) on the core
  for (const bandY of [0.35, 0.7] as const) {
    box(
      g,
      trim,
      houseL + 0.5,
      0.4,
      coreW + 0.5,
      c.x + (px0 + px1) / 2,
      padTop + INTERP.houseWallH * bandY,
      c.z,
    );
  }
  // vestibule portal (east face): jambs five cubits, gate fourteen wide
  // (Ezek 40:48), glowing recess; two pillars beside the jambs (Ezek 40:49)
  const portalW = meters('ezt-house-gate-breadth');
  const portalH = INTERP.houseWallH * 0.55;
  const portal = new Mesh(new BoxGeometry(0.3, portalH, portalW), glowSoft);
  portal.position.set(c.x + px1 + 0.2, padTop + portalH / 2, c.z);
  g.add(portal);
  const archHead = new Mesh(new CircleGeometry(portalW / 2, 18, 0, Math.PI), trim);
  archHead.position.set(c.x + px1 + 0.4, padTop + portalH, c.z);
  archHead.rotation.y = Math.PI / 2;
  g.add(archHead);
  for (const s of [-1, 1] as const) {
    const pillar = new Mesh(new CylinderGeometry(0.65, 0.75, 8.5, 12), trim);
    pillar.position.set(c.x + px1 + 1.6, padTop + 4.25, c.z + s * (portalW / 2 + 1.6));
    pillar.castShadow = true;
    g.add(pillar);
  }

  // --------------------------------------------------------- western building
  // 90 long x 70 broad, five-cubit walls (Ezek 41:12), filling the yard band
  const wbL = meters('ezt-west-building-length');
  const wbW = meters('ezt-west-building-breadth');
  const wbH = 2 * INTERP.storyH + 2;
  solidBox(g, solids, sand, wbL, wbH, wbW, c.x + px0 - 2 - wbL / 2, terrTop + wbH / 2, c.z);

  // ------------------------------------------------- priests' chamber blocks
  // 100 x 50 cu, three stories, north and south of the yard strip
  // (Ezek 42:1-14; the south block per the ESV's Septuagint reading, 42:10)
  const cbL = meters('ezt-priest-chambers-length');
  const cbW = meters('ezt-priest-chambers-breadth');
  const cbH = count('ezt-priest-chambers-stories') * INTERP.storyH;
  const cbZ = houseW / 2 + meters('ezt-chambers-gap') + cbW / 2;
  for (const s of [-1, 1] as const) {
    solidBox(g, solids, sand, cbL, cbH, cbW, c.x + (px0 + px1) / 2, terrTop + cbH / 2, c.z + s * cbZ);
    box(
      g,
      trim,
      cbL + 0.5,
      0.35,
      cbW + 0.5,
      c.x + (px0 + px1) / 2,
      terrTop + cbH + 0.17,
      c.z + s * cbZ,
    );
  }

  // ------------------------------------------------------- windows (instanced)
  // narrow lattice windows all around (Ezek 40:16; 41:16, simplified) —
  // warm slits on the sanctuary core, chamber blocks and gatehouses
  const winGeo = new BoxGeometry(0.18, 2.2, 0.55);
  const winMat = glowMaterial(1.1);
  const winSites: Array<[number, number, number, number]> = []; // x,y,z,yaw
  const coreY = padTop + INTERP.houseWallH * 0.62;
  for (let i = 0; i < 10; i++) {
    const wx = c.x + px0 + 6 + i * ((houseL - 12) / 9);
    winSites.push([wx, coreY, c.z - coreW / 2 - 0.05, Math.PI / 2]);
    winSites.push([wx, coreY, c.z + coreW / 2 + 0.05, Math.PI / 2]);
  }
  for (const s of [-1, 1] as const) {
    for (let i = 0; i < 12; i++) {
      const wx = c.x + (px0 + px1) / 2 - cbL / 2 + 4 + i * ((cbL - 8) / 11);
      winSites.push([wx, terrTop + cbH * 0.55, c.z + s * (cbZ + cbW / 2 + 0.05), Math.PI / 2]);
    }
  }
  const wins = new InstancedMesh(winGeo, winMat, winSites.length);
  const mtx = new Matrix4();
  winSites.forEach(([x, y, z, yaw], i) => {
    mtx.makeRotationY(yaw);
    mtx.setPosition(new Vector3(x, y, z));
    wins.setMatrixAt(i, mtx);
  });
  wins.instanceMatrix.needsUpdate = true;
  g.add(wins);

  // -------------------------------------------------- crenellations (instanced)
  // art direction (USER-REFS #5): merlons along the perimeter wall, skipping
  // the gate gaps and tower footprints
  const merGeo = new BoxGeometry(1.2, INTERP.merlonH, wallT * 0.6);
  const merSites: Array<[number, number, number, number]> = [];
  const step = 2.2;
  const towerClear = INTERP.towerSide + 1;
  for (let d = -half + towerClear; d <= half - towerClear; d += step) {
    if (Math.abs(d) > gateW / 2 + 1) {
      merSites.push([c.x + half - wallT / 2, y0 + wallH + INTERP.merlonH / 2, c.z + d, Math.PI / 2]); // east
      merSites.push([c.x + d, y0 + wallH + INTERP.merlonH / 2, c.z - (half - wallT / 2), 0]); // north
      merSites.push([c.x + d, y0 + wallH + INTERP.merlonH / 2, c.z + (half - wallT / 2), 0]); // south
    }
    merSites.push([c.x - (half - wallT / 2), y0 + wallH + INTERP.merlonH / 2, c.z + d, Math.PI / 2]); // west (solid)
  }
  const mers = new InstancedMesh(merGeo, stoneMaterial(gi, SAND_DARK, 0.9), merSites.length);
  merSites.forEach(([x, y, z, yaw], i) => {
    mtx.makeRotationY(yaw);
    mtx.setPosition(new Vector3(x, y, z));
    mers.setMatrixAt(i, mtx);
  });
  mers.instanceMatrix.needsUpdate = true;
  mers.castShadow = true;
  g.add(mers);

  // ------------------------------------------------- counted stair flights
  // The ascent the survey counts, rendered and walkable: seven steps at the
  // three outer gates (Ezek 40:22, 26), eight at the three inner (Ezek
  // 40:31, 34, 37). Each flight is a stack of full-height treads (the
  // house-steps idiom, portal-opening wide) flanked by parapet cheeks whose
  // caps rake down the flight in two falls; a pale nosing band sits proud of
  // every tread edge. Risers/treads are INTERP.stepRise/stepGoing
  // (RENDERING-DECISIONS #7). Treads and cheeks are massing — each records
  // its solid from the same numbers its instance matrix uses, so the
  // collider set stays the geometry; caps and nosings are filigree. Four
  // instanced draws total: every piece is an axis-aligned box, so scale +
  // translation is the whole matrix.
  const going = INTERP.stepGoing;
  const treadM: Matrix4[] = [];
  const cheekM: Matrix4[] = [];
  const capM: Matrix4[] = [];
  const noseM: Matrix4[] = [];
  const put = (
    list: Matrix4[],
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ): void => {
    mtx.makeScale(w, h, d);
    mtx.setPosition(x, y, z);
    list.push(mtx.clone());
  };
  const solidPut = (
    list: Matrix4[],
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
  ): void => {
    recordSolid(solids, w, h, d, x, y, z);
    put(list, w, h, d, x, y, z);
  };
  // origin (ox, oz) is where the flight meets its upper floor; treads descend
  // outward along the unit axis (dx, dz), the top tread flush with that floor
  const flight = (
    ox: number,
    oz: number,
    dx: number,
    dz: number,
    baseY: number,
    steps: number,
  ): void => {
    const run = steps * going;
    for (let k = steps; k >= 1; k--) {
      const rise = k * INTERP.stepRise;
      const dc = (steps - k + 0.5) * going;
      solidPut(
        treadM,
        dx !== 0 ? going : gateOpen,
        rise,
        dx !== 0 ? gateOpen : going,
        ox + dx * dc,
        baseY + rise / 2,
        oz + dz * dc,
      );
      const edge = (steps - k + 1) * going; // this tread's outer face
      put(
        noseM,
        dx !== 0 ? 0.1 : gateOpen - 0.16,
        0.06,
        dx !== 0 ? gateOpen - 0.16 : 0.1,
        ox + dx * (edge - 0.03),
        baseY + rise - 0.025,
        oz + dz * (edge - 0.03),
      );
    }
    const across = gateOpen / 2 + INTERP.stairCheekT / 2;
    const topY = baseY + steps * INTERP.stepRise;
    const segs: Array<[number, number, number]> = [
      // [start, length, cap height]: the upper fall hugs the landing, the
      // lower steps down the rake and runs a stub past the bottom tread
      [0, run / 2, topY + INTERP.stairParapetH],
      [run / 2, run / 2 + 0.35, baseY + (topY - baseY) / 2 + INTERP.stairParapetH],
    ];
    for (const s of [-1, 1] as const) {
      for (const [d0, len, top] of segs) {
        const dc = d0 + len / 2;
        const cx2 = ox + dx * dc + (dx !== 0 ? 0 : s * across);
        const cz2 = oz + dz * dc + (dx !== 0 ? s * across : 0);
        const w = dx !== 0 ? len : INTERP.stairCheekT;
        const d = dx !== 0 ? INTERP.stairCheekT : len;
        solidPut(cheekM, w, top - baseY, d, cx2, (baseY + top) / 2, cz2);
        put(capM, w + 0.12, 0.12, d + 0.12, cx2, top + 0.06, cz2);
      }
    }
  };
  const outerSteps = count('ezt-outer-gate-steps');
  const innerSteps = count('ezt-inner-gate-steps');
  flight(c.x + half, c.z, 1, 0, y0, outerSteps);
  flight(c.x, c.z - half, 0, -1, y0, outerSteps);
  flight(c.x, c.z + half, 0, 1, y0, outerSteps);
  flight(c.x + innerSide, c.z, 1, 0, courtTop, innerSteps);
  flight(c.x, c.z - terrD / 2, 0, -1, courtTop, innerSteps);
  flight(c.x, c.z + terrD / 2, 0, 1, courtTop, innerSteps);

  // --------------------------------------------- court chambers (Ezek 40:17)
  // "and thirty chambers faced the pavement" — the COUNT is cited (clear
  // tier, ezt-outer-court-chambers); their placement flanks the three gates
  // along the lower pavement (Ezek 40:18 runs the pavement alongside the
  // gates), their dimensions are interpretive (INTERP.courtChamber*,
  // RENDERING-DECISIONS #7). Six flank runs (two per gated side); bodies are
  // massing (solidPut), the warm door panes and trim caps are filigree.
  const chamberM: Matrix4[] = [];
  const doorM: Matrix4[] = [];
  {
    const totalCh = count('ezt-outer-court-chambers');
    const perFlank = Math.floor(totalCh / 6);
    let extras = totalCh - perFlank * 6;
    const chW = INTERP.courtChamberFront;
    const chD = INTERP.courtChamberDepth;
    const chH = INTERP.courtChamberHeight;
    const a0 = gateW / 2 + 2.5; // clear of the projecting gatehouse
    const a1 = half - INTERP.towerSide - 2; // clear of the corner tower
    const backOff = slabHalf - 0.2 - chD / 2; // backs near the wall inner face
    // side normals: east +x, north -z, south +z (no chambers on the solid
    // west wall — the pavement Ezekiel walks runs by the gates)
    for (const [ux, uz] of [
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      for (const s of [-1, 1] as const) {
        const n = perFlank + (extras > 0 ? (extras--, 1) : 0);
        for (let i = 0; i < n; i++) {
          const a = s * (a0 + ((i + 0.5) * (a1 - a0)) / n);
          const x = c.x + ux * backOff + (ux !== 0 ? 0 : a);
          const z = c.z + uz * backOff + (uz !== 0 ? 0 : a);
          const w = ux !== 0 ? chD : chW;
          const d = ux !== 0 ? chW : chD;
          solidPut(chamberM, w, chH, d, x, courtTop + lip + chH / 2, z);
          put(
            doorM,
            ux !== 0 ? 0.08 : 1.15,
            2.0,
            ux !== 0 ? 1.15 : 0.08,
            x - ux * (chD / 2 + 0.04),
            courtTop + lip + 1.0,
            z - uz * (chD / 2 + 0.04),
          );
          put(capM, w + 0.35, 0.14, d + 0.35, x, courtTop + lip + chH + 0.07, z);
        }
      }
    }
  }

  // ------------------------------------------------------- terrace lip kerb
  // a raised trim course stating the inner terrace's edge (border-and-field
  // on the terrace, matching the pavement frame below), broken at the three
  // inner flights — filigree, the stair-cap class
  {
    const kerbT = 0.24;
    const kerbH = 0.16;
    const gap = gateOpen / 2 + INTERP.stairCheekT + 0.6; // clear of a flight
    const ky = terrTop + kerbH / 2;
    const eX = c.x + terrX1 - kerbT / 2;
    for (const s of [-1, 1] as const) {
      // east edge, two runs flanking the east flight
      const len = terrD / 2 - gap;
      put(capM, kerbT, kerbH, len, eX, ky, c.z + s * (gap + len / 2));
      // north/south edges, two runs each flanking their flights
      const zE = c.z + s * (terrD / 2 - kerbT / 2);
      const wLen = -gap - (terrX0 + 0.3); // west run: terrX0 .. -gap
      put(capM, wLen, kerbH, kerbT, c.x + terrX0 + 0.3 + wLen / 2, ky, zE);
      const eLen = terrX1 - 0.3 - gap; // east run: gap .. terrX1
      put(capM, eLen, kerbH, kerbT, c.x + gap + eLen / 2, ky, zE);
    }
  }

  const inst = (mats: Matrix4[], m: MeshStandardNodeMaterial, shadow: boolean): void => {
    const im = new InstancedMesh(new BoxGeometry(1, 1, 1), m, mats.length);
    mats.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = shadow;
    im.receiveShadow = true;
    g.add(im);
  };
  inst(treadM, sand, true);
  inst(cheekM, sandDark, true);
  inst(capM, trim, true);
  inst(noseM, trim, false);
  inst(chamberM, sand, true);
  inst(doorM, glowSoft, false);

  return { group: g, solids };
}
