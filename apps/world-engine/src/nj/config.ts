/**
 * NewJerusalemConfig (plan §1 Phase B) — the typed source of truth through
 * which city-side geometry consumes cited measurement records via DECLARED
 * resolver modes (ADR 0017 decision 3; ADR 0018 decision 4), instead of
 * hand-typed dimension literals.
 *
 * Started 2026-07-22 with the DISTRICT resolver for the Ezek 45/48 holy
 * allotment (first consumer: the campusModel band split, RENDERING-DECISIONS
 * entry #11). Later Phase B passes migrate further sections here (tier
 * table, palette, glory/river curves) and add `rebuildNewJerusalem(config)`.
 *
 * Pure module: no three.js, no DOM — CPU-probe testable.
 */

import { EZA } from './allotmentMeasurements.gen';

/**
 * District-scale modes (ADR 0018 decision 4): how the Ezek 45/48 allotment's
 * long-cubit values realize as world meters. Alternative readings (e.g. a
 * literal-cubit district) are future modes — they change the resolver, never
 * the recorded numbers (ADR 0017 decision 2).
 */
export type DistrictScaleMode = 'compressed-district';

export interface NewJerusalemConfig {
  district: {
    mode: DistrictScaleMode;
    /** meters per long cubit at district scale */
    cubitM: number;
  };
}

/**
 * `compressed-district` derivation: the priests' portion is 10,000 cubits
 * broad (Ezek 45:3; 48:10) with the sanctuary in its midst (Ezek 48:10), and
 * its houses must ground on the detailed-terrain heightfield mirror
 * (|z| <= 6144, an engine fact — Dwellings.ts `heightAtCpu`). Centering the
 * band's breadth on TEMPLE_SITE.z = -5600 against that mirror edge gives
 * 2 x (6144 - 5600) ~ 1000 m for 10,000 cubits -> 0.1 m per long cubit
 * (a 5.25x compression of the literal 0.525 m cubit, ADR 0018 decision 1).
 * ONE factor for the whole district, so every rendered PROPORTION — equal
 * priests'/Levites' breadths, the shared 25,000-cubit length, adjacency —
 * is the text's own; only the absolute compression is interpretive
 * (placeholder geography, ADR 0009 rule 6; the ADR 0014 precedent).
 */
export const NJ_CONFIG: NewJerusalemConfig = {
  district: {
    mode: 'compressed-district',
    cubitM: 0.1,
  },
};

/** Long-cubit value of an allotment measurement (throws on counts/unknown). */
export function districtCu(id: string): number {
  const m = EZA[id];
  if (!m || m.cu === null) {
    throw new Error(`config: no length measurement '${id}'`);
  }
  return m.cu;
}

/** Meters at the declared district scale. */
export function districtMeters(id: string): number {
  return districtCu(id) * NJ_CONFIG.district.cubitM;
}
