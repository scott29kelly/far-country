/**
 * New Jerusalem massing — M3, the arched golden mountain-city (toward Willis).
 *
 * Built to read like Janet Willis's book-cover renderings: a street-of-gold
 * plinth, three grand terraces each faced with FOUR tall arched window-gates
 * (twelve per side), and a glowing crown under the open-air glory. Every arched
 * bay is a recessed luminous window framed by gold piers with an arched head,
 * so the city reads as detailed translucent gold "glowing from within its
 * arches" rather than smooth or striped blocks. Lower tiers are warm gold;
 * upper tiers grade toward pale crystal; the glow intensifies toward the throne.
 *
 * Abstract glory-light only at the summit (Rev 21:23; 22:5; ADR 0010 — no
 * figure). Materials are placeholder PBR approximations (no true gem
 * transmission yet). Still to come: jasper wall + twelve pearl gates as distinct
 * portals, the twelve jewelled foundation courses, the river-of-life cascade
 * with trees of life, and the vaulted interior.
 */

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  SphereGeometry,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';

const GOLD = new Color(0xd9a441);
const CRYSTAL = new Color(0xdfeaf0);

type Face = { axis: 'x' | 'z'; sign: 1 | -1 };
const FACES: Face[] = [
  { axis: 'z', sign: 1 },
  { axis: 'z', sign: -1 },
  { axis: 'x', sign: 1 },
  { axis: 'x', sign: -1 },
];

/** Position+orient an object built facing +Z onto a given tier face. */
function placeOnFace(obj: Mesh | Group, u: number, y: number, off: number, face: Face): void {
  if (face.axis === 'z') {
    obj.position.set(u, y, face.sign * off);
    obj.rotation.y = face.sign > 0 ? 0 : Math.PI;
  } else {
    obj.position.set(face.sign * off, y, u);
    obj.rotation.y = face.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
}

/** An arched window: a tall luminous panel with a semicircular head, facing +Z. */
export function makeArchWindow(width: number, height: number, m: MeshStandardNodeMaterial): Group {
  const g = new Group();
  const rect = new Mesh(new BoxGeometry(width, height, 0.6), m);
  rect.position.y = height / 2;
  g.add(rect);
  const arch = new Mesh(new CircleGeometry(width / 2, 18, 0, Math.PI), m);
  arch.position.set(0, height, 0.3);
  g.add(arch);
  return g;
}

type Tier = { half: number; h: number; arches: number };

export function buildCityMassing(): Group {
  const city = new Group();
  city.name = 'new-jerusalem';

  // Street-of-gold apron around the base.
  const apron = new MeshStandardNodeMaterial();
  apron.color.copy(GOLD);
  apron.metalness = 0.5;
  apron.roughness = 0.3;
  const plaza = new Mesh(new BoxGeometry(232, 5, 232), apron);
  plaza.position.y = -2.5;
  plaza.receiveShadow = true;
  plaza.castShadow = true;
  city.add(plaza);

  // Plinth + three grand terraces (12 arched gates per side) + glowing crown.
  const tiers: Tier[] = [
    { half: 100, h: 16, arches: 4 }, // street-of-gold plinth / gates
    { half: 82, h: 42, arches: 4 },
    { half: 60, h: 38, arches: 4 },
    { half: 40, h: 34, arches: 4 },
    { half: 22, h: 26, arches: 0 }, // crown (solid, glowing) under the glory
  ];

  let yBot = 0;
  const last = tiers.length - 1;
  for (let ti = 0; ti < tiers.length; ti++) {
    const t = tiers[ti];
    const f = ti / last; // 0 at base .. 1 at crown
    const tierColor = GOLD.clone().lerp(CRYSTAL, f);
    const H = t.h;
    const yc = yBot + H / 2;

    // Solid tier mass (the silhouette).
    const mass = new MeshStandardNodeMaterial();
    mass.color.copy(tierColor);
    mass.metalness = 0.55 * (1 - f);
    mass.roughness = 0.3 - 0.16 * f;
    mass.emissive.copy(tierColor);
    mass.emissiveIntensity = 0.05 + 0.6 * f * f;
    const box = new Mesh(new BoxGeometry(2 * t.half, H, 2 * t.half), mass);
    box.position.y = yc;
    box.castShadow = true;
    box.receiveShadow = true;
    city.add(box);

    // Gold cornice lip at the tier top.
    const trim = new MeshStandardNodeMaterial();
    trim.color.copy(GOLD.clone().lerp(CRYSTAL, f));
    trim.metalness = 0.7;
    trim.roughness = 0.22;
    const cornice = new Mesh(new BoxGeometry(2 * t.half + 6, 3, 2 * t.half + 6), trim);
    cornice.position.y = yBot + H - 1.5;
    cornice.castShadow = true;
    city.add(cornice);

    if (t.arches > 0) {
      const winMat = new MeshStandardNodeMaterial();
      winMat.color.copy(GOLD.clone().lerp(new Color(0xffffff), f));
      winMat.emissive.setHex(0xffe7a6);
      winMat.emissiveIntensity = 1.8 + 2.6 * f;
      winMat.roughness = 0.5;
      winMat.side = DoubleSide;

      const off = t.half + 0.2;
      const W = 2 * t.half;
      const bay = W / t.arches;
      const ow = bay * 0.58;
      const winH = H * 0.56;
      const winBot = yBot + H * 0.16;
      const pierW = bay * 0.34;

      for (const face of FACES) {
        // Arched windows.
        for (let i = 0; i < t.arches; i++) {
          const u = -W / 2 + bay * (i + 0.5);
          const win = makeArchWindow(ow, winH, winMat);
          placeOnFace(win, u, winBot, off, face);
          city.add(win);
        }
        // Gold piers between/around the bays.
        for (let i = 0; i <= t.arches; i++) {
          const u = -W / 2 + bay * i;
          const pier = new Mesh(new BoxGeometry(pierW, H, 2.6), trim);
          placeOnFace(pier, u, yc, off, face);
          pier.castShadow = true;
          pier.receiveShadow = true;
          city.add(pier);
        }
      }
    }

    yBot += H;
  }

  // Throne glory: a radiant, self-luminous source at the open-air summit, which
  // the engine's bloom turns into a beacon. Abstract light only (ADR 0010).
  const gloryMat = new MeshStandardNodeMaterial();
  gloryMat.color.setHex(0xfff4d6);
  gloryMat.emissive.setHex(0xfff1c8);
  gloryMat.emissiveIntensity = 6;
  gloryMat.roughness = 1;
  const glory = new Mesh(new SphereGeometry(11, 32, 24), gloryMat);
  glory.position.y = yBot + 10;
  city.add(glory);

  return city;
}
