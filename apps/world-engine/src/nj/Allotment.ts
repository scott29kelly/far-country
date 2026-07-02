/**
 * The Holy Allotment — Ezekiel 45/48, placeholder scale.
 *
 * Composes the regional layout from Willis's video aerial: the New Jerusalem
 * at the SOUTH-CENTRE of the district, with the priests' dwelling grid and a
 * standalone temple to the NORTH (the temple sits OUTSIDE the city,
 * Ezek 48:10).
 *
 * TERRAIN-INTEGRATED (ADR 0015): the plain itself is REAL TERRAIN — a broad,
 * gently-rolling plateau rise injected into the heightfield by
 * NewJerusalemScene's macroPatch. The old flat-box platform/skirt/rock-chunk
 * plateau, the box crop-field planes and hedges, and the 19-km perimeter
 * wall are GONE: grass, groves, debris and streams come from the engine's
 * own systems now. Field plots and hedgerows return properly with the
 * allotment ZONE-MAP milestone (managed planting), not as floating boxes.
 *
 * Convention (matches cityModel): +X east, -X west, +Z south, -Z north;
 * local y = 0 is the city plaza top. Outlying content (dwellings, temple)
 * snaps to the rolling ground via the `groundAt` sampler (local units).
 *
 * Placeholder proportions only (ADR 0009 rule 6): compressed from the
 * earlier layout so the whole district fits the far shell (the real
 * allotment is ~57 mi wide; the ratio is approximated, not the scale).
 */

import { BoxGeometry, Color, DoubleSide, Group, Mesh } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';

import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { buildCityMassing, makeArchWindow } from './CityMassing';
import { buildRiverOfLife } from './RiverOfLife';

export const ALLOT_X = 360; // E-W half-extent (local units; ×NJ_SCALE = world m)
export const ALLOT_Z_SOUTH = 200; // +Z edge (south, behind the spawn meadow)
export const ALLOT_Z_NORTH = -540; // -Z edge (north, beyond the temple)

const DWELL = new Color(0x6b6358); // darker stone so the grid reads from afar
const TGOLD = new Color(0xd9a441); // temple gold (matches the city)
const TCRYS = new Color(0xe9dca0); // temple upper grade

const TEMPLE_FACES: Array<{ axis: 'x' | 'z'; sign: 1 | -1 }> = [
  { axis: 'z', sign: 1 },
  { axis: 'z', sign: -1 },
  { axis: 'x', sign: 1 },
  { axis: 'x', sign: -1 },
];

/**
 * The standalone temple (Ezekiel 48:10) — a smaller gold arched structure in
 * the city's idiom: a tiered, arcaded gold building with glowing windows and a
 * golden cap, free-standing so it can be entered from any side. Distinct from
 * and outside the New Jerusalem (a literal future millennial temple per Willis;
 * its identification is her interpretation, not bare Scripture).
 */
function buildTemple(): Group {
  const g = new Group();
  g.name = 'temple';
  const tiers = [
    { half: 50, h: 12, arches: 5 },
    { half: 42, h: 24, arches: 4 },
    { half: 30, h: 18, arches: 3 },
    { half: 18, h: 14, arches: 0 },
  ];
  let yBot = 0;
  const last = tiers.length - 1;
  for (let ti = 0; ti < tiers.length; ti++) {
    const t = tiers[ti];
    const f = ti / last;
    const col = TGOLD.clone().lerp(TCRYS, f);
    const H = t.h;
    const yc = yBot + H / 2;

    const massM = new MeshStandardNodeMaterial();
    massM.color.copy(col);
    massM.metalness = 0.55 * (1 - f);
    massM.roughness = 0.3 - 0.14 * f;
    massM.emissive.copy(col);
    massM.emissiveIntensity = 0.05 + 0.3 * f;
    const box = new Mesh(new BoxGeometry(2 * t.half, H, 2 * t.half), massM);
    box.position.y = yc;
    box.castShadow = true;
    box.receiveShadow = true;
    g.add(box);

    const trimM = new MeshStandardNodeMaterial();
    trimM.color.copy(col);
    trimM.metalness = 0.7;
    trimM.roughness = 0.22;
    const cornice = new Mesh(new BoxGeometry(2 * t.half + 5, 3, 2 * t.half + 5), trimM);
    cornice.position.y = yBot + H - 1.5;
    cornice.castShadow = true;
    g.add(cornice);

    if (t.arches > 0) {
      const winM = new MeshStandardNodeMaterial();
      winM.color.copy(TGOLD.clone().lerp(new Color(0xffffff), f));
      winM.emissive.setHex(0xffe7a6);
      winM.emissiveIntensity = 1.8 + 1.8 * f;
      winM.roughness = 0.5;
      winM.side = DoubleSide;
      const off = t.half + 0.2;
      const W = 2 * t.half;
      const bay = W / t.arches;
      const ow = bay * 0.58;
      const winH = H * 0.56;
      const winBot = yBot + H * 0.16;
      const pierW = bay * 0.34;
      for (const face of TEMPLE_FACES) {
        for (let i = 0; i < t.arches; i++) {
          const u = -W / 2 + bay * (i + 0.5);
          const win = makeArchWindow(ow, winH, winM);
          if (face.axis === 'z') {
            win.position.set(u, winBot, face.sign * off);
            win.rotation.y = face.sign > 0 ? 0 : Math.PI;
          } else {
            win.position.set(face.sign * off, winBot, u);
            win.rotation.y = face.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
          }
          g.add(win);
        }
        for (let i = 0; i <= t.arches; i++) {
          const u = -W / 2 + bay * i;
          const pier = new Mesh(new BoxGeometry(pierW, H, 2.6), trimM);
          if (face.axis === 'z') {
            pier.position.set(u, yc, face.sign * off);
            pier.rotation.y = face.sign > 0 ? 0 : Math.PI;
          } else {
            pier.position.set(face.sign * off, yc, u);
            pier.rotation.y = face.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
          }
          pier.castShadow = true;
          g.add(pier);
        }
      }
    }
    yBot += H;
  }

  const capM = new MeshStandardNodeMaterial();
  capM.color.setHex(0xe8b23a);
  capM.metalness = 0.5;
  capM.roughness = 0.28;
  capM.emissive.setHex(0xe8b23a);
  capM.emissiveIntensity = 0.4;
  const cap = new Mesh(new BoxGeometry(24, 10, 24), capM);
  cap.position.y = yBot + 5;
  cap.castShadow = true;
  g.add(cap);

  return g;
}

/**
 * Built content of the Holy Allotment, resting on the terrain plateau.
 * `groundAt(lx, lz)` returns the LOCAL-frame ground height at a local (x, z)
 * (the scene wires it to the heightfield); outlying objects snap to it.
 */
export function buildHolyAllotment(
  groundAt?: (lx: number, lz: number) => number,
  gi: ProbeGI | null = null,
): Group {
  const allot = new Group();
  allot.name = 'holy-allotment';
  const ground = (lx: number, lz: number): number => groundAt?.(lx, lz) ?? 0;

  // Priests' dwelling grid, north of the city (Zadok priests' portion) — a
  // dense, darker grid so it reads clearly across the plain. Each dwelling
  // snaps to the rolling meadow it stands on.
  const dwellMat = new MeshStandardNodeMaterial();
  dwellMat.color.copy(DWELL);
  dwellMat.roughness = 0.85;
  const gx0 = -300;
  const gx1 = 300;
  const gz0 = -500;
  const gz1 = -260;
  const cols = 12;
  const rows = 7;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = gx0 + (gx1 - gx0) * ((i + 0.5) / cols);
      const z = gz0 + (gz1 - gz0) * ((j + 0.5) / rows);
      const d = new Mesh(new BoxGeometry(34, 12, 22), dwellMat);
      d.position.set(x, ground(x, z) + 6 - 1.5, z); // sunk 1.5 into the meadow
      d.castShadow = true;
      d.receiveShadow = true;
      allot.add(d);
    }
  }

  // Standalone temple (Ezek 48:10), outside the city on the north plain,
  // free-standing and enterable on all four sides. Its ~2 km-wide base sinks
  // slightly so the rolling ground never undercuts a corner.
  const temple = buildTemple();
  const templeZ = -480;
  temple.position.set(0, ground(0, templeZ) - 0.8, templeZ);
  allot.add(temple);

  // The New Jerusalem at the south-centre, on the flat core (plaza at y = 0).
  allot.add(buildCityMassing(gi));

  // The river of life cascading the south terraces to the plain, trees of life
  // on its banks (Rev 22:1-2). Shares the city's local frame.
  allot.add(buildRiverOfLife());

  return allot;
}
