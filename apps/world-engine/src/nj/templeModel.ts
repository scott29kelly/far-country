/**
 * Temple units/scale resolver (ADR 0018) — the ONE place text-native
 * measurements become meters. `EZT` (templeMeasurements.gen.ts, generated
 * from the canonical store) carries the cited values; `meters(id)` realizes
 * them at the literal long cubit. Interpretive constants — dimensions
 * Ezekiel does not give — live in `INTERP`, each one recorded in
 * RENDERING-DECISIONS entry #7 (they are render choices, not measurements).
 */

import { EZT } from './templeMeasurements.gen';

/** Ezekiel's long cubit, "a cubit and a handbreadth" (Ezek 40:5) — ADR 0018. */
export const LONG_CUBIT_M = 0.525;

/** Long-cubit realization of a measurement (throws on counts/unknown ids). */
export function cu(id: string): number {
  const m = EZT[id];
  if (!m || m.cu === null) {
    throw new Error(`templeModel: no length measurement '${id}'`);
  }
  return m.cu;
}

/** Meters at the literal scale (ADR 0018 decision 2). */
export function meters(id: string): number {
  return cu(id) * LONG_CUBIT_M;
}

/** Raw value for count records (steps, stories, items). */
export function count(id: string): number {
  const m = EZT[id];
  if (!m) throw new Error(`templeModel: no measurement '${id}'`);
  return m.value;
}

/**
 * Temple site (world m): south-centre of the priests' campus band, inside
 * the detailed terrain ring and the campus scatter exclusion. Placement is
 * compressed placeholder geography (ADR 0009 rule 6 / ADR 0015); only the
 * compound's DIMENSIONS are literal.
 */
export const TEMPLE_SITE = { x: 0, z: -5600 } as const;

/** Interpretive render constants — RENDERING-DECISIONS entry #7. */
export const INTERP = {
  /** house walls ~30 cubits — the 1 Kgs 6:2 Solomonic analogy */
  houseWallH: 30 * LONG_CUBIT_M,
  /** side-chamber shoulder: three stories (Ezek 41:6) at an assumed story height */
  storyH: 2.6,
  /** fortified gatehouse height (the 50x25 guardroom plans imply massing, not height) */
  gatehouseH: 9,
  /** step riser for the counted stair flights (7/8/10 steps) */
  stepRise: 0.22,
  /** tread depth for the counted flights — processional low-rise/deep-tread */
  stepGoing: 0.45,
  /** parapet cheek walls flanking each flight: thickness + height above the rake */
  stairCheekT: 0.55,
  stairParapetH: 0.95,
  /** corner towers + crenellations: art direction (USER-REFS #5), not text */
  towerSide: 8,
  towerH: 10.5,
  merlonH: 0.9,
  /** plinth seating the literal-scale compound on the rolling meadow */
  plinthMargin: 4,
} as const;
