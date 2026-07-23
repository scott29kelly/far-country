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
import { REV } from './cityMeasurements.gen';

/** Citywide scale (ADR 0014): local city units × NJ_SCALE = world metres.
 *  Lifted here from rimModel (which re-exports it) in the Phase B config
 *  consolidation; the value and semantics are ADR 0014's, unchanged. */
export const NJ_SCALE = 20;

/**
 * District-scale modes (ADR 0018 decision 4): how the Ezek 45/48 allotment's
 * long-cubit values realize as world meters. Alternative readings (e.g. a
 * literal-cubit district) are future modes — they change the resolver, never
 * the recorded numbers (ADR 0017 decision 2).
 */
export type DistrictScaleMode = 'compressed-district';

/**
 * City-scale modes: how Rev 21's stadia/cubit values realize as world meters.
 * `compressed-city` keeps ADR 0014's declared experiential footprint; a
 * future literal mode (the full 12,000-stadia city) changes the resolver,
 * never the records.
 */
export type CityScaleMode = 'compressed-city';

export interface NewJerusalemConfig {
  district: {
    mode: DistrictScaleMode;
    /** meters per long cubit at district scale */
    cubitM: number;
  };
  city: {
    mode: CityScaleMode;
    /** literal meters per stadion (ESV footnote, Rev 21:16: "about 607 feet") */
    stadionM: number;
    /** literal meters per cubit (ESV footnote, Rev 21:17: "about 18 inches" — the
     *  common cubit; Ezek 40:5's long cubit does not govern John's vision) */
    cubitM: number;
    /** literal meters -> world meters, one factor for the whole city */
    compression: number;
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
/**
 * `compressed-city` derivation: ADR 0014 declares the city's experiential
 * footprint — CITY_HALF(100 local) × NJ_SCALE(20) → a 4000 m side, walls at
 * ±2000 world. The cited side is 12,000 stadia (Rev 21:16); at the ESV's own
 * gloss (a stadion ~607 ft ~185 m) that is 2,220,000 literal meters, so
 * compression = 2,220,000 / 4000 = 555, exactly. ONE factor for the whole
 * city: the footprint the walker experiences consumes the cited record
 * through a declared mode, and only the compression is interpretive (the
 * ADR 0014 precedent; a literal 12,000-stadia mode stays a future resolver).
 * The wall's 144 cubits (rev-city-wall, tier fuzzy — height or thickness is
 * underdetermined) is deliberately NOT consumed by geometry; see
 * RENDERING-DECISIONS entry #12.
 */
export const NJ_CONFIG: NewJerusalemConfig = {
  district: {
    mode: 'compressed-district',
    cubitM: 0.1,
  },
  city: {
    mode: 'compressed-city',
    stadionM: 185,
    cubitM: 0.457,
    compression: 555,
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

/** Literal meters of a Rev 21 city measurement (ESV footnote glosses). */
export function cityLiteralMeters(id: string): number {
  const m = REV[id];
  if (!m) {
    throw new Error(`config: no city measurement '${id}'`);
  }
  const unitM: Record<string, number> = {
    stadia: NJ_CONFIG.city.stadionM,
    cubit: NJ_CONFIG.city.cubitM,
  };
  const factor = unitM[m.unit];
  if (factor === undefined) {
    throw new Error(`config: no unit gloss for '${m.unit}' (${id})`);
  }
  return m.value * factor;
}

/** World meters at the declared city scale. */
export function cityMeters(id: string): number {
  return cityLiteralMeters(id) / NJ_CONFIG.city.compression;
}
