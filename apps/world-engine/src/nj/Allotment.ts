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
const THICK = 60; // plateau thickness → cliff sides

const GREEN = new Color(0x4f7a3a);
const FIELD = new Color(0x5f8a44);
const HEDGE = new Color(0x33572a);
const STONE = new Color(0xcfc6b0);
const JASPER = new Color(0xb9c2c9);

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

  // Lifted green plain (flat mesa with cliff sides). Top face at local y = 0.
  const platform = new Mesh(
    new BoxGeometry(2 * ALLOT_X, THICK, ALLOT_DEPTH),
    mat(GREEN, { rough: 1 }),
  );
  platform.position.set(0, -THICK / 2, ALLOT_CZ);
  platform.receiveShadow = true;
  allot.add(platform);

  // Perimeter wall ringing the plain (pale jasper).
  const wallH = 10;
  const wallT = 4;
  const wallMat = mat(JASPER, { rough: 0.6, metal: 0.05 });
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
  addFields(150, ALLOT_X - 20, -260, 160); // east of the city
  addFields(-(ALLOT_X - 20), -150, -260, 160); // west of the city

  // Priests' dwelling grid, north of the city (Zadok priests' portion).
  const dwellMat = mat(STONE, { rough: 0.8 });
  const gx0 = -300;
  const gx1 = 300;
  const gz0 = -620;
  const gz1 = -200;
  const cols = 8;
  const rows = 6;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = gx0 + (gx1 - gx0) * ((i + 0.5) / cols);
      const z = gz0 + (gz1 - gz0) * ((j + 0.5) / rows);
      const d = new Mesh(new BoxGeometry(34, 10, 22), dwellMat);
      d.position.set(x, 5, z);
      d.castShadow = true;
      d.receiveShadow = true;
      allot.add(d);
    }
  }

  // Standalone temple, north of the priests — outside the city (Ezek 48:10).
  const templeMat = mat(STONE, { rough: 0.5, metal: 0.1, emit: 0.05 });
  const tBase = new Mesh(new BoxGeometry(80, 16, 80), templeMat);
  tBase.position.set(0, 8, -700);
  tBase.castShadow = true;
  tBase.receiveShadow = true;
  allot.add(tBase);
  const tInner = new Mesh(new BoxGeometry(46, 30, 46), templeMat);
  tInner.position.set(0, 31, -700);
  tInner.castShadow = true;
  allot.add(tInner);

  // The New Jerusalem at the south-centre, resting on the plain (plaza at y = 0).
  allot.add(buildCityMassing());

  return allot;
}
