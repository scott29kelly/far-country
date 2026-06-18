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

import { BoxGeometry, Color, Group, Mesh } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';

import { buildCityMassing } from './CityMassing';

export const ALLOT_X = 480; // E-W half-extent
export const ALLOT_Z_SOUTH = 180; // +Z edge (south, behind the spawn)
export const ALLOT_Z_NORTH = -780; // -Z edge (north)
const ALLOT_CZ = (ALLOT_Z_SOUTH + ALLOT_Z_NORTH) / 2;
const ALLOT_DEPTH = ALLOT_Z_SOUTH - ALLOT_Z_NORTH;

const GRASS = new Color(0x4f7a3a);
const ROCK = new Color(0x9d8a6a); // tan escarpment rock
const FIELD = new Color(0x5f8a44);
const HEDGE = new Color(0x33572a);
const DWELL = new Color(0x6b6358); // darker stone so the grid reads from afar
const SANDSTONE = new Color(0xc8b98f); // warm perimeter wall
const TEMPLE = new Color(0xe8e2d0); // bright temple stone

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

  // Standalone temple, north of the priests — outside the city (Ezek 48:10).
  // Bright and prominent, with a golden cap, so it anchors the far end.
  const templeMat = mat(TEMPLE, { rough: 0.5, metal: 0.05, emit: 0.08 });
  const tBase = new Mesh(new BoxGeometry(110, 18, 110), templeMat);
  tBase.position.set(0, 9, -715);
  tBase.castShadow = true;
  tBase.receiveShadow = true;
  allot.add(tBase);
  const tInner = new Mesh(new BoxGeometry(66, 40, 66), templeMat);
  tInner.position.set(0, 38, -715);
  tInner.castShadow = true;
  allot.add(tInner);
  const tCap = new Mesh(
    new BoxGeometry(34, 14, 34),
    mat(new Color(0xe8b23a), { metal: 0.4, rough: 0.3, emit: 0.3 }),
  );
  tCap.position.set(0, 65, -715);
  tCap.castShadow = true;
  allot.add(tCap);

  // The New Jerusalem at the south-centre, resting on the plain (plaza at y = 0).
  allot.add(buildCityMassing());

  return allot;
}
