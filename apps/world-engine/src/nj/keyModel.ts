/**
 * Reading-key marker model (roadmap M3.5) — one in-scene anchor per cited
 * entity slug, placed for legibility from the southern approach (the spawn /
 * hero composition looks north at the south face).
 *
 * Coverage contract (probe-asserted): the marker slug set EQUALS the pick
 * registry's slug set (entityPicks.ts) — the key annotates exactly what is
 * clickable, so a marker can never exist without a canonical cited entity
 * behind it (the no-invented-descriptors guarantee). Anchors derive from the
 * same shared owner tables the geometry, collision and picks consume —
 * never hand-mirrored constants.
 *
 * Pure module: no three.js, no DOM — CPU-probe testable
 * (tools/probe-visualkey.ts).
 */

import {
  CITY_HALF,
  CITY_TIERS,
  CITY_SUMMIT_Y,
  FOUNDATION_COURSE,
  GATES,
  cityTierBottoms,
} from './cityModel';
import { NJ_SCALE } from './rimModel';
import { levitesBandRect, priestsBandRect } from './campusModel';
import { assemblyVolumes, hostClusterVolumes } from './populationModel';
import { riverReaches } from './RiverOfLife';
import { TEMPLE_SITE } from './templeModel';
import { treeOfLifeStations } from './treeOfLifeModel';

export type KeyMarker = {
  /** canonical entity slug — must exist in /data/entities/<slug>.json */
  slug: string;
  /** fallback display name until the canonical export's name loads */
  label: string;
  /** world-space anchor the UI projects each frame */
  p: [number, number, number];
};

/**
 * Build the reading-key markers in WORLD space. `plazaTopY` is the city
 * group's world Y (local y=0); `groundAt` is the BASE terrain height
 * (heightAtCpu), same contract as buildEntityPicks.
 */
export function keyMarkers(
  plazaTopY: number,
  groundAt: (x: number, z: number) => number,
): KeyMarker[] {
  const S = NJ_SCALE;
  const wy = (ly: number): number => plazaTopY + ly * S;
  const tier0h = CITY_TIERS[0].h;
  const bottoms = cityTierBottoms();
  const out: KeyMarker[] = [];

  // Gates (Rev 21:21) — over the arch of the middle south gate (the one the
  // spawn approach walks toward; min |offset| on the south side).
  const southGate = [...GATES]
    .filter((g) => g.side === 'south')
    .sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset))[0];
  out.push({
    slug: 'gates-of-pearl',
    label: 'Gates of Pearl',
    p: [southGate.offset * S, wy(tier0h * 0.75), CITY_HALF * S],
  });

  // Wall (Rev 21:18) — just above the south parapet, west of the west gate
  // so it never stacks on the gate marker.
  out.push({
    slug: 'jasper-wall-and-gold-city',
    label: 'Jasper Wall',
    p: [-CITY_HALF * 0.72 * S, wy(tier0h + 3), CITY_HALF * S],
  });

  // Foundation course (Rev 21:19-20) — at band height on the south base,
  // east side (mirrors the wall marker across the gate axis).
  out.push({
    slug: 'twelve-jeweled-foundations',
    label: 'Jeweled Foundations',
    p: [
      CITY_HALF * 0.72 * S,
      wy(FOUNDATION_COURSE.h * 0.5),
      (CITY_HALF + FOUNDATION_COURSE.thick) * S,
    ],
  });

  // Street of gold (Rev 21:21b) — over the plaza just inside the south wall.
  out.push({
    slug: 'street-of-gold',
    label: 'Street of Gold',
    p: [CITY_HALF * 0.4 * S, wy(1.5), (CITY_HALF - 14) * S],
  });

  // River (Rev 22:1) — over the water at the middle of the southernmost
  // (approach) reach.
  const reach = riverReaches().reduce((a, r) => ((r.z0 + r.z1) / 2 > (a.z0 + a.z1) / 2 ? r : a));
  out.push({
    slug: 'river-of-the-water-of-life',
    label: 'River of Life',
    p: [0, wy(reach.y + 1.5), ((reach.z0 + reach.z1) / 2) * S],
  });

  // Trees of life (Rev 22:2) — crown height of the southernmost bank
  // station (stations are world-space, like the pick volumes).
  const st = treeOfLifeStations().reduce((a, s) => (s.z > a.z ? s : a));
  out.push({
    slug: 'tree-of-life',
    label: 'Tree of Life',
    p: [st.x, groundAt(st.x, st.z) + 34, st.z],
  });

  // Great multitude (Rev 7:9) — floating over the southernmost assembly.
  const asm = assemblyVolumes().reduce((a, v) => (v.z > a.z ? v : a));
  out.push({
    slug: 'great-multitude',
    label: 'Great Multitude',
    p: [asm.x * S, wy(asm.floor + 4), asm.z * S],
  });

  // Angelic hosts (Rev 5:11) — mid-height of the southernmost host cluster.
  const host = hostClusterVolumes().reduce((a, v) => (v.z > a.z ? v : a));
  out.push({
    slug: 'myriads-of-angels',
    label: 'Angelic Hosts',
    p: [host.x * S, wy((host.y0 + host.y1) / 2), host.z * S],
  });

  // Throne and glory (Rev 4:2-3; 21:23) — inside the upper glory volume,
  // well above the crown so it reads against the sky.
  out.push({
    slug: 'throne-of-god',
    label: 'Throne and Glory',
    p: [0, wy(CITY_SUMMIT_Y + 10) + 15 * S, 0],
  });

  // Sea of glass (Rev 4:6) — the crown's south rim, off the river meridian.
  const crownHalf = CITY_TIERS[CITY_TIERS.length - 1].half;
  out.push({
    slug: 'sea-of-glass',
    label: 'Sea of Glass',
    p: [-8 * S, wy(CITY_SUMMIT_Y + 1), (crownHalf - 3) * S],
  });

  // The city itself (Rev 21:2, 16) — mid-height on tier 2's south face.
  out.push({
    slug: 'new-jerusalem',
    label: 'The City',
    p: [
      -CITY_TIERS[2].half * 0.5 * S,
      wy(bottoms[2] + CITY_TIERS[2].h * 0.5),
      CITY_TIERS[2].half * S,
    ],
  });

  // Temple compound (Ezek 40-42) — over the measured precinct's centre.
  out.push({
    slug: 'sanctuary-in-the-midst',
    label: 'Temple Compound',
    p: [TEMPLE_SITE.x, groundAt(TEMPLE_SITE.x, TEMPLE_SITE.z) + 45, TEMPLE_SITE.z],
  });

  // Dwelling campus (Track A zones, Ezek 45:4-5; 48:10-14) — the priests'
  // marker floats over the east band's inner blocks by the processional,
  // the Levites' over the meridian at the far band's near rows; anchors
  // derive from the campusModel rects Dwellings.ts builds from.
  const priests = priestsBandRect('east');
  const px = priests.x0 + (priests.x1 - priests.x0) * 0.1;
  const pz = priests.z1 - 80;
  out.push({
    slug: 'priests-portion',
    label: 'Priests’ Portion',
    p: [px, groundAt(px, pz) + 30, pz],
  });

  const levites = levitesBandRect();
  const lz = levites.z1 - 150;
  out.push({
    slug: 'levites-portion',
    label: 'Levites’ Portion',
    p: [0, groundAt(0, lz) + 40, lz],
  });

  return out;
}
