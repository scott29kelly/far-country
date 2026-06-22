/**
 * The Holy Allotment — Ezekiel 45/48, placeholder scale.
 *
 * Composes the regional layout from Willis's video aerial: a flat green, lifted
 * plain (the "new earth" plateau, Zech 14:10) ringed by a perimeter wall, with
 * the New Jerusalem at the SOUTH-CENTRE, crop fields flanking it east and west,
 * and the priests' dwelling grid plus a standalone temple to the NORTH (the
 * temple sits OUTSIDE the city, Ezek 48:10).
 *
 * Convention (matches cityModel): +X east, -X west, +Z south, -Z north; the
 * plain's top surface and the city plaza share local y = 0. The scene lifts the
 * whole group above the procedural terrain so it reads as a plateau.
 *
 * Placeholder proportions only (ADR 0009 rule 6): the real allotment is ~57 mi
 * wide with an ~11 mi city; here the ratio is approximated, not the true scale.
 * Materials are flat PBR; crop/temple/dwelling detailing is illustrative fill.
 */

import { BoxGeometry, Color, DoubleSide, Group, Mesh } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';

import { buildCityMassing, makeArchWindow } from './CityMassing';
import { buildRiverOfLife } from './RiverOfLife';

export const ALLOT_X = 480; // E-W half-extent
export const ALLOT_Z_SOUTH = 180; // +Z edge (south, behind the spawn)
export const ALLOT_Z_NORTH = -880; // -Z edge (north) — extra room behind the temple
const ALLOT_CZ = (ALLOT_Z_SOUTH + ALLOT_Z_NORTH) / 2;
const ALLOT_DEPTH = ALLOT_Z_SOUTH - ALLOT_Z_NORTH;

const GRASS = new Color(0x4f7a3a);
const ROCK = new Color(0x9d8a6a); // tan escarpment rock
const FIELD = new Color(0x5f8a44);
const HEDGE = new Color(0x33572a);
const DWELL = new Color(0x6b6358); // darker stone so the grid reads from afar
const SANDSTONE = new Color(0xc8b98f); // warm perimeter wall
const TGOLD = new Color(0xd9a441); // temple gold (matches the city)
const TCRYS = new Color(0xe9dca0); // temple upper grade

function mat(
  color: Color,
  opts?: { metal?: number; rough?: number; emit?: number },
): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.color.copy(color);
  m.metalness = opts?.metal ?? 0;
  m.roughness = opts?.rough ?? 0.9;
  if (opts?.emit) {
    m.emissive.copy(color);
    m.emissiveIntensity = opts.emit;
  }
  return m;
}

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

export function buildHolyAllotment(): Group {
  const allot = new Group();
  allot.name = 'holy-allotment';

  // Lifted plain as a natural plateau: a grass-topped slab on rugged rock cliffs,
  // widening into a rock base step so it reads as land rising out of the terrain
  // rather than a cement box. Box material order is [+x,-x,+y,-y,+z,-z] — only
  // the top (+y) is grass; every side is rock.
  const grassMat = mat(GRASS, { rough: 1 });
  const rockMat = mat(ROCK, { rough: 1 });
  const topThick = 30;
  const platform = new Mesh(new BoxGeometry(2 * ALLOT_X, topThick, ALLOT_DEPTH), [
    rockMat,
    rockMat,
    grassMat,
    rockMat,
    rockMat,
    rockMat,
  ]);
  platform.position.set(0, -topThick / 2, ALLOT_CZ);
  platform.receiveShadow = true;
  platform.castShadow = true;
  allot.add(platform);

  // Wider rock base step beneath, for a natural escarpment foot.
  const skirt = new Mesh(
    new BoxGeometry(2 * ALLOT_X + 120, 50, ALLOT_DEPTH + 120),
    rockMat,
  );
  skirt.position.set(0, -topThick - 22, ALLOT_CZ);
  skirt.receiveShadow = true;
  skirt.castShadow = true;
  allot.add(skirt);

  // Low warm-sandstone perimeter wall on the grass edge (not a grey lip).
  const wallH = 6;
  const wallT = 3;
  const wallMat = mat(SANDSTONE, { rough: 0.7 });
  const addWall = (w: number, d: number, x: number, z: number): void => {
    const m = new Mesh(new BoxGeometry(w, wallH, d), wallMat);
    m.position.set(x, wallH / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    allot.add(m);
  };
  addWall(2 * ALLOT_X, wallT, 0, ALLOT_Z_NORTH);
  addWall(2 * ALLOT_X, wallT, 0, ALLOT_Z_SOUTH);
  addWall(wallT, ALLOT_DEPTH, -ALLOT_X, ALLOT_CZ);
  addWall(wallT, ALLOT_DEPTH, ALLOT_X, ALLOT_CZ);

  // Crop fields E/W of the city: hedgerow grid over a second green.
  const hedgeMat = mat(HEDGE, { rough: 1 });
  const fieldMat = mat(FIELD, { rough: 1 });
  const addFields = (x0: number, x1: number, z0: number, z1: number): void => {
    const base = new Mesh(new BoxGeometry(x1 - x0, 0.6, z1 - z0), fieldMat);
    base.position.set((x0 + x1) / 2, 0.3, (z0 + z1) / 2);
    base.receiveShadow = true;
    allot.add(base);
    const step = 70;
    for (let x = x0; x <= x1 + 0.1; x += step) {
      const h = new Mesh(new BoxGeometry(2, 2.4, z1 - z0), hedgeMat);
      h.position.set(x, 1.2, (z0 + z1) / 2);
      h.receiveShadow = true;
      allot.add(h);
    }
    for (let z = z0; z <= z1 + 0.1; z += step) {
      const h = new Mesh(new BoxGeometry(x1 - x0, 2.4, 2), hedgeMat);
      h.position.set((x0 + x1) / 2, 1.2, z);
      h.receiveShadow = true;
      allot.add(h);
    }
  };
  addFields(150, ALLOT_X - 20, -280, 160); // east of the city
  addFields(-(ALLOT_X - 20), -150, -280, 160); // west of the city

  // Priests' dwelling grid, north of the city (Zadok priests' portion) — a dense,
  // darker grid so it reads clearly across the plain.
  const dwellMat = mat(DWELL, { rough: 0.85 });
  const gx0 = -340;
  const gx1 = 340;
  const gz0 = -640;
  const gz1 = -180;
  const cols = 12;
  const rows = 7;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = gx0 + (gx1 - gx0) * ((i + 0.5) / cols);
      const z = gz0 + (gz1 - gz0) * ((j + 0.5) / rows);
      const d = new Mesh(new BoxGeometry(34, 12, 22), dwellMat);
      d.position.set(x, 6, z);
      d.castShadow = true;
      d.receiveShadow = true;
      allot.add(d);
    }
  }

  // Standalone temple (Ezek 48:10), outside the city, set well inside the north
  // edge so it is free-standing and walkable/enterable on all four sides.
  const temple = buildTemple();
  temple.position.set(0, 0, -710);
  allot.add(temple);

  // Rock chunks along the plateau edge, to break the flat cliff face.
  const chunkMat = mat(ROCK, { rough: 1 });
  const edgeZ = [ALLOT_Z_SOUTH, ALLOT_Z_NORTH];
  for (let k = 0; k < 22; k++) {
    const along = -ALLOT_X + 0.5 + (2 * ALLOT_X) * (k / 21);
    const s = 26 + ((k * 37) % 22);
    // north/south edges
    const z = edgeZ[k % 2] + (k % 2 === 0 ? 8 : -8);
    const c1 = new Mesh(new BoxGeometry(s, s * 0.7, s * 0.8), chunkMat);
    c1.position.set(along, -10 - (k % 3) * 6, z);
    c1.rotation.y = k * 0.7;
    c1.castShadow = true;
    c1.receiveShadow = true;
    allot.add(c1);
    // east/west edges
    const ex = (k % 2 === 0 ? ALLOT_X : -ALLOT_X) + (k % 2 === 0 ? -8 : 8);
    const c2 = new Mesh(new BoxGeometry(s * 0.8, s * 0.7, s), chunkMat);
    c2.position.set(ex, -10 - (k % 3) * 6, ALLOT_CZ + along * 0.9);
    c2.rotation.y = k * 0.5;
    c2.castShadow = true;
    c2.receiveShadow = true;
    allot.add(c2);
  }

  // The New Jerusalem at the south-centre, resting on the plain (plaza at y = 0).
  allot.add(buildCityMassing());

  // The river of life cascading the south terraces to the plain, trees of life
  // on its banks (Rev 22:1-2). Shares the city's local frame, so it scales/lifts
  // with everything.
  allot.add(buildRiverOfLife());

  return allot;
}
