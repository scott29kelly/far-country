/**
 * The river of the water of life (Rev 22:1-2) — "bright as crystal, flowing
 * from the throne of God and of the Lamb through the middle of the street of the
 * city," with "the tree of life" on either side, bearing twelve kinds of fruit,
 * its leaves "for the healing of the nations."
 *
 * Rendered as Willis reads it (RENDERING-DECISIONS #1): a single river issuing
 * from the summit throne and CASCADING the terraces down to the gates, then
 * running out across the plain as the "water at the approach" (Willis build
 * directive #2) that leads the eye up to the city. It pours from just below the
 * glory-light at the summit — aniconic (ADR 0010): from the throne's light, not
 * from any depicted figure.
 *
 * Built in city-local coords (origin = city centre, plaza at y=0, +Z south) and
 * added to the Holy Allotment group, so it scales and lifts with the city. The
 * tier geometry here MUST track CityMassing's tiers (half-widths and heights).
 */

import { BoxGeometry, Color, Group, Mesh, SphereGeometry } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { CITY_TIERS, RIVER } from './cityModel';

// Shared massing table (cityModel.CITY_TIERS) — the old hand-kept mirror of
// CityMassing's tiers is gone; both now read the same source of truth.
const TIERS = CITY_TIERS;

const LEAF = new Color(0x3f8f3a);

/** A tree of life: trunk + layered canopy + a few glowing fruit. */
function makeTreeOfLife(
  trunkMat: MeshStandardNodeMaterial,
  leafMat: MeshStandardNodeMaterial,
  fruitMat: MeshStandardNodeMaterial,
  seed: number,
): Group {
  const t = new Group();
  const th = 3.0 + (seed % 3) * 0.4; // trunk height (local; ~60-80 m at city scale)
  const trunk = new Mesh(new BoxGeometry(0.6, th, 0.6), trunkMat);
  trunk.position.y = th / 2;
  trunk.castShadow = true;
  t.add(trunk);
  // canopy: two offset spheres for a fuller, less geometric crown
  const r = 1.8 + (seed % 2) * 0.3;
  const c1 = new Mesh(new SphereGeometry(r, 16, 12), leafMat);
  c1.position.y = th + r * 0.6;
  c1.castShadow = true;
  t.add(c1);
  const c2 = new Mesh(new SphereGeometry(r * 0.7, 14, 10), leafMat);
  c2.position.set(r * 0.4, th + r * 0.2, r * 0.2);
  t.add(c2);
  // twelve kinds of fruit (Rev 22:2) — a scatter of warm glowing points
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + seed;
    const fr = new Mesh(new SphereGeometry(0.18, 8, 6), fruitMat);
    fr.position.set(
      Math.cos(a) * r * 0.8,
      th + r * 0.6 + Math.sin(a * 1.7) * r * 0.4,
      Math.sin(a) * r * 0.8,
    );
    t.add(fr);
  }
  return t;
}

export function buildRiverOfLife(): Group {
  const g = new Group();
  g.name = 'river-of-life';

  // Crystal water (Rev 22:1 "bright as crystal"): pale blue-white, faintly
  // self-luminous so it reads as living light against the warm gold city, kept
  // under the 1.5 bloom threshold so it glows without blooming flat.
  const water = new MeshStandardNodeMaterial();
  water.color.setHex(0xbfeaff);
  water.emissive.setHex(0xaae0ff);
  water.emissiveIntensity = 0.65;
  water.metalness = 0.1;
  water.roughness = 0.12;

  // cumulative tier bottoms/tops
  const yBot: number[] = [];
  let acc = 0;
  for (const t of TIERS) {
    yBot.push(acc);
    acc += t.h;
  }
  const yTop = yBot.map((b, i) => b + TIERS[i].h);
  const summitY = acc; // 156, crown top — the glory sits just above

  // Constant river width from the shared model (RIVER.width = 5 → ~100 m at
  // citywide scale): a crystal THREAD cascading the mountain, not a sheet.
  // The old `half * 0.4` scaled with the tier — at the base tier that was an
  // 800 m-wide wall of water that filled the whole spawn view (found live,
  // 2026-07-01 terrain-integration pass).
  const chanW = (_half: number): number => RIVER.width;
  const fallProud = 2.2; // sit in front of the piers (which reach ~half+1.5)
  const poolProud = 0.7;

  // Source basin on the crown top, directly under the glory ("from the throne").
  const crown = TIERS[TIERS.length - 1];
  const src = new Mesh(
    new BoxGeometry(chanW(crown.half), 1.0, crown.half * 1.4),
    water,
  );
  src.position.set(0, summitY + 0.5, crown.half * 0.2);
  g.add(src);

  // Falls down each tier face + pools on each set-back ledge, top → base.
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i];
    const w = chanW(t.half);
    // vertical fall on this tier's south (+Z) face
    const fall = new Mesh(new BoxGeometry(w, t.h + 1.0, 1.2), water);
    fall.position.set(0, (yBot[i] + yTop[i]) / 2, t.half + fallProud);
    g.add(fall);
    // pool on the ledge at this tier's top (between this face and the next one
    // up); skip the crown, whose top carries the source basin instead
    if (i < TIERS.length - 1) {
      const inner = TIERS[i + 1].half;
      const z0 = inner + 1;
      const z1 = t.half - 1;
      const pool = new Mesh(new BoxGeometry(w, 1.0, Math.max(2, z1 - z0)), water);
      pool.position.set(0, yTop[i] + poolProud, (z0 + z1) / 2);
      g.add(pool);
    }
  }

  // Channel across the plaza and out onto the plain toward the approach — the
  // "water at the approach" leading the eye up to the city.
  const base = TIERS[0];
  const chEnd = 185; // ~plateau south edge (ALLOT_Z_SOUTH = 180)
  const chStart = base.half - 2;
  const channel = new Mesh(
    new BoxGeometry(chanW(base.half), 0.8, chEnd - chStart),
    water,
  );
  channel.position.set(0, 0.4, (chStart + chEnd) / 2);
  g.add(channel);

  // Trees of life on either side of the river (Rev 22:2).
  const trunkMat = new MeshStandardNodeMaterial();
  trunkMat.color.setHex(0x5a4326);
  trunkMat.roughness = 0.9;
  const leafMat = new MeshStandardNodeMaterial();
  leafMat.color.copy(LEAF);
  leafMat.emissive.copy(LEAF);
  leafMat.emissiveIntensity = 0.12; // leaves "for the healing of the nations"
  leafMat.roughness = 0.85;
  const fruitMat = new MeshStandardNodeMaterial();
  fruitMat.color.setHex(0xffcf6b);
  fruitMat.emissive.setHex(0xffcf6b);
  fruitMat.emissiveIntensity = 1.0;
  fruitMat.roughness = 0.5;

  const bankX = chanW(base.half) / 2 + 9;
  const nTrees = 6;
  for (let k = 0; k < nTrees; k++) {
    const z = chStart + 12 + ((chEnd - chStart - 18) * k) / (nTrees - 1);
    for (const sx of [-1, 1]) {
      const tree = makeTreeOfLife(trunkMat, leafMat, fruitMat, k * 2 + (sx > 0 ? 1 : 0));
      tree.position.set(sx * bankX, 0, z);
      g.add(tree);
    }
  }

  return g;
}
