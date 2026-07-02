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

import { BoxGeometry, Group, Mesh } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { CITY_TIERS, RIVER } from './cityModel';

// Shared massing table (cityModel.CITY_TIERS) — the old hand-kept mirror of
// CityMassing's tiers is gone; both now read the same source of truth.
const TIERS = CITY_TIERS;

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

  // Trees of life (Rev 22:2) are no longer built here: they are REAL trees
  // from the engine's tree pipeline now, placed in world space by
  // TreesOfLife.ts (this group is inside the ×20 allotment scale, which
  // would blow a buildTree tree up to 300-500 m).

  return g;
}
