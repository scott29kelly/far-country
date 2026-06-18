/**
 * New Jerusalem massing — M3, the luminous arcaded mountain-city.
 *
 * The dominant form per Janet Willis's artwork and video walkthrough: a rugged
 * rock mountain pedestal the city rises from, a street-of-gold base plaza
 * (Rev 21:21), and a seven-tier step-pyramid (Rev 21:10) whose every terrace is
 * faced with a repeating golden ARCADE — pilaster columns over emissive window
 * bands, capped by a cornice lip — so the city reads as detailed, translucent
 * gold "glowing from within its arches" rather than smooth blocks. A
 * self-luminous glory crowns the open-air summit (Rev 21:23; 22:5 — the glory
 * of God is the light, no sun or moon; abstract light only, ADR 0010).
 *
 * Lower terraces are warm gold; upper terraces grade toward pale crystal, and
 * the window glow intensifies toward the throne.
 *
 * Materials are placeholder PBR approximations (no true gem transmission yet).
 * Still to come: jasper wall + twelve pearl gates (three per side), the twelve
 * jewelled foundation courses, the river-of-life cascade with trees of life
 * (date palms), the vaulted interior, and the flat green Holy-Allotment platform
 * (crop fields, priests' dwellings, standalone temple) the city sits on.
 *
 * Returns a Group in city-local coordinates (origin-centred, local y=0 at the
 * plaza top); the scene positions it on the new-earth terrain.
 */

import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';

import { CITY_HALF, PYRAMID, SUMMIT_Y, TERRACES } from './cityModel';

const GOLD = new Color(0xd9a441); // warm street-of-gold (lower terraces)
const CRYSTAL = new Color(0xcfe8f2); // pale crystalline (upper terraces)
const ROCK = new Color(0x6b5847); // rugged earthy brown mountain rock

type Face = { axis: 'x' | 'z'; sign: 1 | -1 };
const FACES: Face[] = [
  { axis: 'z', sign: 1 },
  { axis: 'z', sign: -1 },
  { axis: 'x', sign: 1 },
  { axis: 'x', sign: -1 },
];

export function buildCityMassing(): Group {
  const city = new Group();
  city.name = 'new-jerusalem';

  // Rugged rock mountain pedestal: a faceted frustum whose skirt embeds into the
  // terrain and whose top face sits at the plaza (y = 0); rock rising into gold.
  const rockMat = new MeshStandardNodeMaterial();
  rockMat.color.copy(ROCK);
  rockMat.metalness = 0;
  rockMat.roughness = 0.95;
  const rock = new Mesh(new CylinderGeometry(160, 260, 90, 8, 1), rockMat);
  rock.position.y = -45;
  rock.castShadow = true;
  rock.receiveShadow = true;
  city.add(rock);

  // Base platform / street-of-gold plaza. Top face at local y = 0.
  const gold = new MeshStandardNodeMaterial();
  gold.color.copy(GOLD);
  gold.metalness = 0.5;
  gold.roughness = 0.3;
  const platform = new Mesh(new BoxGeometry(2 * CITY_HALF, 8, 2 * CITY_HALF), gold);
  platform.position.y = -4;
  platform.castShadow = true;
  platform.receiveShadow = true;
  city.add(platform);

  // Shared decoration geometry (columns are uniform; panels/cornices size per tier).
  const H = PYRAMID.stepHeight;
  const colGeo = new BoxGeometry(1.6, H, 2.2);
  const last = Math.max(1, TERRACES.length - 1);

  for (const t of TERRACES) {
    const f = (t.level - 1) / last; // 0 at base .. 1 near summit
    const tierColor = GOLD.clone().lerp(CRYSTAL, f);
    const yBot = (t.level - 1) * H;
    const yMid = yBot + H / 2;
    const half = t.half;

    // Solid tier mass (the silhouette).
    const wall = new MeshStandardNodeMaterial();
    wall.color.copy(tierColor);
    wall.metalness = 0.5 * (1 - f);
    wall.roughness = 0.3 - 0.18 * f;
    wall.emissive.copy(tierColor);
    wall.emissiveIntensity = 0.04 + 0.18 * f;
    const box = new Mesh(new BoxGeometry(2 * half, t.topY, 2 * half), wall);
    box.position.y = t.topY / 2;
    box.castShadow = true;
    box.receiveShadow = true;
    city.add(box);

    // Per-tier decoration materials.
    const colMat = new MeshStandardNodeMaterial();
    colMat.color.copy(tierColor);
    colMat.metalness = 0.7;
    colMat.roughness = 0.22;
    const winMat = new MeshStandardNodeMaterial();
    winMat.color.setHex(0xffe9a8);
    winMat.emissive.setHex(0xffdf8c);
    winMat.emissiveIntensity = 1.4 + 3.2 * f; // glow brighter toward the throne
    winMat.roughness = 0.5;

    // Geometry sized to this tier.
    const panelGeo = new BoxGeometry(2 * half * 0.86, H * 0.6, 0.8);
    const corniceGeo = new BoxGeometry(2 * half + 5, 2, 2 * half + 5);

    // Cornice lip at the top of the riser (overhangs the step edge → shadow line).
    const cornice = new Mesh(corniceGeo, colMat);
    cornice.position.y = t.topY - 1;
    cornice.castShadow = true;
    cornice.receiveShadow = true;
    city.add(cornice);

    const cols = Math.max(3, Math.round((2 * half) / 7));
    for (const face of FACES) {
      // Emissive window band, set just inside the colonnade.
      const panel = new Mesh(panelGeo, winMat);
      if (face.axis === 'z') {
        panel.position.set(0, yMid, face.sign * (half + 0.25));
      } else {
        panel.position.set(face.sign * (half + 0.25), yMid, 0);
        panel.rotation.y = Math.PI / 2;
      }
      city.add(panel);

      // Pilaster colonnade in front of the glow.
      for (let i = 0; i < cols; i++) {
        const u = -half + 2 * half * ((i + 0.5) / cols);
        const col = new Mesh(colGeo, colMat);
        if (face.axis === 'z') {
          col.position.set(u, yMid, face.sign * (half + 0.4));
        } else {
          col.position.set(face.sign * (half + 0.4), yMid, u);
          col.rotation.y = Math.PI / 2;
        }
        col.receiveShadow = true;
        city.add(col);
      }
    }
  }

  // Throne glory: a radiant, self-luminous source at the open-air summit, which
  // the engine's bloom turns into a beacon. Abstract light only (ADR 0010).
  const gloryMat = new MeshStandardNodeMaterial();
  gloryMat.color.setHex(0xfff4d6);
  gloryMat.emissive.setHex(0xfff1c8);
  gloryMat.emissiveIntensity = 6;
  gloryMat.roughness = 1;
  const glory = new Mesh(new SphereGeometry(10, 32, 24), gloryMat);
  glory.position.y = SUMMIT_Y + 8;
  city.add(glory);

  return city;
}
