/**
 * New Jerusalem massing — M3, the mountain-city silhouette.
 *
 * Builds the dominant form per Janet Willis's artwork and video walkthrough:
 * a rugged rock mountain pedestal that the city rises from, a street-of-gold
 * base plaza (Rev 21:21), a seven-tier crystal/gold step-pyramid (the great
 * high mountain carrying the city, Rev 21:10), and a self-luminous glory at the
 * open-air summit (Rev 21:23; 22:5 — the glory of God is the light, no sun or
 * moon). Lower terraces are warm translucent gold; upper terraces shift toward
 * pale crystal; the glow intensifies toward the throne.
 *
 * Materials are placeholder PBR approximations (no real gem transmission yet).
 * Still to come in later increments: jasper wall + twelve pearl gates (three
 * per side), the twelve jewelled foundation courses beneath the base, the river
 * of life cascading the terraces with trees of life (date palms) flanking it,
 * and the vaulted street-of-gold interior.
 *
 * Returns a Group in city-local coordinates (origin-centred, local y=0 at the
 * plaza top); the scene positions it on the new-earth terrain.
 */

import { BoxGeometry, Color, CylinderGeometry, Group, Mesh, SphereGeometry } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';

import { CITY_HALF, SUMMIT_Y, TERRACES } from './cityModel';

const GOLD = new Color(0xd9a441); // warm street-of-gold (lower terraces)
const CRYSTAL = new Color(0xcfe8f2); // pale crystalline (upper terraces)
const ROCK = new Color(0x6b5847); // rugged earthy brown mountain rock

export function buildCityMassing(): Group {
  const city = new Group();
  city.name = 'new-jerusalem';

  // Rugged rock mountain pedestal. A faceted frustum, wider than the city, whose
  // skirt embeds into the terrain and whose top face sits at the plaza (y = 0).
  // The earthy rock transitions up into the golden architecture above.
  const rockMat = new MeshStandardNodeMaterial();
  rockMat.color.copy(ROCK);
  rockMat.metalness = 0;
  rockMat.roughness = 0.95;
  const rock = new Mesh(new CylinderGeometry(160, 260, 90, 8, 1), rockMat);
  rock.position.y = -45; // height 90 → top face at local y = 0
  rock.castShadow = true;
  rock.receiveShadow = true;
  city.add(rock);

  // Base platform / street-of-gold plaza. Top face at local y = 0.
  const platformThickness = 8;
  const gold = new MeshStandardNodeMaterial();
  gold.color.copy(GOLD);
  gold.metalness = 0.5;
  gold.roughness = 0.3;
  const platform = new Mesh(
    new BoxGeometry(2 * CITY_HALF, platformThickness, 2 * CITY_HALF),
    gold,
  );
  platform.position.y = -platformThickness / 2;
  platform.castShadow = true;
  platform.receiveShadow = true;
  city.add(platform);

  // Seven-tier step-pyramid: nested boxes (tall + narrow at the centre, short +
  // wide at the rim) produce the terraced silhouette. Material grades from warm
  // gold at the base to pale crystal at the summit, with an emissive ramp so the
  // city reads as self-luminous toward the throne.
  const top = TERRACES.length;
  for (const t of TERRACES) {
    const f = (t.level - 1) / Math.max(1, top - 1); // 0 at base .. 1 near summit
    const mat = new MeshStandardNodeMaterial();
    mat.color.copy(GOLD).lerp(CRYSTAL, f);
    mat.metalness = 0.5 * (1 - f);
    mat.roughness = 0.3 - 0.18 * f;
    mat.emissive.copy(mat.color);
    mat.emissiveIntensity = 0.05 + 0.5 * f * f;
    const box = new Mesh(new BoxGeometry(2 * t.half, t.topY, 2 * t.half), mat);
    box.position.y = t.topY / 2;
    box.castShadow = true;
    box.receiveShadow = true;
    city.add(box);
  }

  // Throne glory: a radiant, self-luminous source at the open-air summit, which
  // the engine's bloom blooms into a beacon. Abstract light only — no figurative
  // depiction of God (ADR 0010).
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
