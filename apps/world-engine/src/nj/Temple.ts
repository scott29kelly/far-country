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
 * none on the west, Ezek 40; 42:15-20), raised inner court with three inner
 * gates, the house on its six-cubit platform (Ezek 41:8), the eleven-cubit
 * altar with eastward steps (Ezek 43:13-17), the western building, and the
 * two priests' chamber blocks (Ezek 42:1-14). Crenellations and corner
 * towers are art direction; window glow renders Ezek 40:16's windows within
 * the base-tier bloom contract (< 1.5 luminance).
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
import { normalWorld, positionWorld, vec3 } from 'three/tsl';

import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NV3 } from '../gpu/TSLTypes';
import type { Heightfield } from '../world/Heightfield';
import { PLATEAU_Y } from './rimModel';
import { INTERP, TEMPLE_SITE, count, meters } from './templeModel';

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

  // ---------------------------------------------------------------- plinth
  const plinthPad = half + INTERP.plinthMargin;
  solidBox(g, solids, sandDark, plinthPad * 2, 7, plinthPad * 2, c.x, plinthTop - 3.5, c.z);

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

  // --------------------------------------------------------- outer gatehouses
  // 50 x 25 cu tower-gatehouses projecting inward from the wall line
  // (Ezek 40:6-16, 20-27); approached by seven steps (Ezek 40:22, 26)
  const outerRise = count('ezt-outer-gate-steps') * INTERP.stepRise;
  gatehouse(g, solids, sand, trim, glow, c.x + half - gateL / 2, y0, c.z, 0, gateL, gateW, gateOpen, INTERP.gatehouseH);
  gatehouse(g, solids, sand, trim, glow, c.x, y0, c.z - (half - gateL / 2), Math.PI / 2, gateL, gateW, gateOpen, INTERP.gatehouseH);
  gatehouse(g, solids, sand, trim, glow, c.x, y0, c.z + (half - gateL / 2), Math.PI / 2, gateL, gateW, gateOpen, INTERP.gatehouseH);

  // ------------------------------------------------------------ inner terrace
  // the inner court stands a flight above the outer court: outer gates climb
  // seven steps, inner gates eight (Ezek 40:22, 31) — rendered as two
  // terraces with stepped flights at the gates
  const innerRise = count('ezt-inner-gate-steps') * INTERP.stepRise;
  const terrX0 = -half; // west wall
  const terrX1 = innerSide; // inner-gate outer face (x = +52.5)
  const terrW = terrX1 - terrX0;
  const terrD = innerSide * 2 + 16; // spans inner court + both inner N/S gates
  solidBox(
    g,
    solids,
    sand,
    terrW,
    outerRise + innerRise,
    terrD,
    c.x + (terrX0 + terrX1) / 2,
    y0 + (outerRise + innerRise) / 2,
    c.z,
  );
  const terrTop = y0 + outerRise + innerRise;

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

  // ---------------------------------------------------------- house platform
  // the house band occupies x -26.25..-78.75 (100 cu, Ezek 41:13); its
  // six-cubit platform (Ezek 41:8) is climbed by ten steps on the east
  // (Ezek 40:49)
  const px1 = -innerSide / 2; // -26.25
  const px0 = px1 - houseL; // -78.75
  const padW = houseL + 6;
  const padD = houseW + 2 * meters('ezt-free-space-breadth') + 6;
  solidBox(g, solids, sand, padW, platformH, padD, c.x + (px0 + px1) / 2, terrTop + platformH / 2, c.z);
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

  return { group: g, solids };
}
