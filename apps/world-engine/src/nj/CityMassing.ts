/**
 * New Jerusalem massing — M2, first increment.
 *
 * The dominant silhouette only: a gold base-platform plaza (street of gold,
 * Rev 21:21) and the crystal step-pyramid rising from it (the great high
 * mountain carrying the city, Rev 21:10). Materials are placeholder PBR; M3
 * swaps in crystal transmission, the gold street sheen, and gem/pearl detail.
 *
 * Still to come in later M2 increments: jasper wall, twelve pearl gates,
 * jewelled foundations, throne glory (abstract light, ADR 0010), river cascade,
 * trees of life, and the multitude (ADR 0011).
 *
 * Returns a Group in city-local coordinates (origin-centred, local y=0 at the
 * platform top); the scene positions it on the new-earth terrain.
 */

import { BoxGeometry, Group, Mesh } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';

import { CITY_HALF, TERRACES } from './cityModel';

export function buildCityMassing(): Group {
  const city = new Group();
  city.name = 'new-jerusalem';

  // Base platform / street-of-gold plaza. Top face at local y = 0.
  const platformThickness = 8;
  const gold = new MeshStandardNodeMaterial();
  gold.color.setHex(0xd9b24a);
  gold.metalness = 0.55;
  gold.roughness = 0.32;
  const platform = new Mesh(
    new BoxGeometry(2 * CITY_HALF, platformThickness, 2 * CITY_HALF),
    gold,
  );
  platform.position.y = -platformThickness / 2;
  platform.castShadow = true;
  platform.receiveShadow = true;
  city.add(platform);

  // Crystal step-pyramid: nested boxes (tall + narrow at the centre, short +
  // wide at the rim) produce the terraced silhouette. Each box rises from the
  // plaza (y = 0) to its terrace top.
  for (const t of TERRACES) {
    const crystal = new MeshStandardNodeMaterial();
    crystal.color.setHex(0xbfe3ef);
    crystal.metalness = 0.0;
    crystal.roughness = 0.18;
    const box = new Mesh(new BoxGeometry(2 * t.half, t.topY, 2 * t.half), crystal);
    box.position.y = t.topY / 2;
    box.castShadow = true;
    box.receiveShadow = true;
    city.add(box);
  }

  return city;
}
