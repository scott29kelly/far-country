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

/** One massing terrace row — LOCAL units (× NJ_SCALE = world m). */
export interface CityTierRow {
  half: number;
  h: number;
  arches: number;
}

/**
 * One material family's optics. Colour and the constants that govern how light
 * behaves on it live together because separating them is what produced the
 * problem this table fixes: five loose `Color` constants in `CityMassing.ts`
 * and a paragraph of prose in `CITY-QUALITY-BAR.md`, with every roughness and
 * transmission value inlined at its use site and tuned in isolation.
 *
 * Hoshi-no-Tani's one-palette lesson (docs/plans/procedural-asset-authoring.md
 * lever 3) is adapted rather than copied. Their table is lit/mid/shade/bounce
 * per family plus a shadow tint, because a cel-shaded renderer must AUTHOR its
 * shade colour. Ours must not: shade here comes from the irradiance probe
 * field and the hemisphere ambient, and hand-authoring it would fight the
 * light transport that Pillar B is built on. The transferable part is the
 * discipline — every colour in the city, named, in one place, addressable —
 * and for a physically-based stack the honest per-family record is albedo plus
 * the optical constants.
 */
export interface CityOptics {
  /**
   * sRGB hex base albedo. Absent for `gem`, whose twelve hues are cited data
   * (`cityModel.FOUNDATION_GEMS`, Rev 21:19-20) and are not art direction to
   * be tuned here.
   */
  albedo?: string;
  metalness: number;
  roughness: number;
  /** emissive intensity, with the family's own albedo as the emissive colour —
   *  keeps a shaded face legible without crossing `bloomThreshold` */
  selfLight: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  ior?: number;
  /** LOCAL units (x NJ_SCALE = world metres) */
  thickness?: number;
  attenuationColor?: string;
  attenuationDistance?: number;
  dispersion?: number;
  specularIntensity?: number;
  iridescence?: number;
  iridescenceIOR?: number;
  iridescenceThicknessRange?: [number, number];
  sheen?: number;
  sheenColor?: string;
}

/**
 * SCOPE, deliberately drawn: `families` holds the six material identities the
 * text itself names — gold, ivory course, jasper wall, pearl gate, gold-like-
 * clear-glass, and the twelve foundation stones. It does NOT absorb every
 * material in `CityMassing.ts`. The interior core, the gate inscriptions, the
 * plinth apron, the arcade glow, the crown and the sea of glass are per-element
 * VARIATIONS on those families (a brighter gold here, a rougher one there), and
 * pulling them in would turn a palette into a dump of every constant in the
 * file — which is the readability problem this table exists to solve, not a
 * second copy of it. A variation belongs at its use site, stated as a variation.
 */
export interface CityPalette {
  families: {
    /** opaque gold trim: piers, arch rings, frieze, inscriptions */
    gold: CityOptics;
    /** pale cornice and course bands alternating with the gold */
    ivory: CityOptics;
    /** the wall (Rev 21:18 "the wall was built of jasper") */
    jasper: CityOptics;
    /** the twelve gates (Rev 21:21 "each of the gates made of a single pearl") */
    pearl: CityOptics;
    /** the tier skin (Rev 21:18 "the city was pure gold, like clear glass") */
    goldGlass: CityOptics;
    /** the twelve foundation stones (Rev 21:19-20) */
    gem: CityOptics;
  };
  /**
   * CITY-QUALITY-BAR pillar E's colour script, as data rather than prose:
   * "warm gold at the base ascending to pale luminous crystal at the summit."
   * The tier skin and interior lerp from their family albedo toward `summit`
   * by normalised tier height.
   */
  ascent: {
    summit: string;
  };
  /**
   * The PostStack bloom threshold city emissives must stay under. Only the
   * crown crosses it (STATUS: worst population emissive luminance 1.31).
   * Recorded here because it is the constraint every `selfLight` above is
   * tuned against, and it was previously only a comment.
   */
  bloomThreshold: number;
}

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
  /**
   * The terraced massing rows (proportional art under the entry #2 documented
   * harmonization — the text gives the cube's outer measure, not terraces).
   * The BASE tier's half-width is NOT here: it derives from `rev-city-side`
   * through the city resolver (cityModel.CITY_HALF); only its height and
   * arch count are massing art.
   */
  cityTiers: {
    base: { h: number; arches: number };
    upper: CityTierRow[];
  };
  /** every colour and optical constant the city massing builds from */
  palette: CityPalette;
  /**
   * The NJ scene's tuned look — the values the ?edit=1 panel round-trips
   * ("copy config (JSON)" emits this shape; paste tuned values back here).
   * timeOfDay: afternoon sun rakes the south face the spawn looks at (a user
   * ?T= wins). aerialFogK/aerialClarity: moderate de-haze over the restored
   * landscape (ADR 0014/0015).
   */
  look: {
    timeOfDay: number;
    aerialFogK: number;
    aerialClarity: number;
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
  cityTiers: {
    base: { h: 16, arches: 4 }, // jasper wall ring + plinth + gates
    upper: [
      { half: 82, h: 42, arches: 5 },
      { half: 60, h: 38, arches: 4 },
      { half: 40, h: 34, arches: 3 },
      { half: 22, h: 26, arches: 0 }, // crown (solid, glowing)
    ],
  },
  // Every value below was LIFTED VERBATIM from its previous use site in
  // CityMassing.ts. This section is infrastructure, not art direction: it
  // changes where the numbers live, not what they are, so the sheet before and
  // after is pixel-identical. Retuning happens against this table afterwards,
  // where a change is one edit and its effect is one diff.
  palette: {
    families: {
      gold: { albedo: '#d9a441', metalness: 0.85, roughness: 0.3, selfLight: 0.18 },
      ivory: { albedo: '#f1e9d7', metalness: 0.05, roughness: 0.5, selfLight: 0.12 },
      jasper: {
        albedo: '#bfd6d2', // pale crystal-jasper (stylised, ADR 0009 rule 2)
        metalness: 0.05,
        // 0.18 with the 0.35 self-light washed the wall flat white
        roughness: 0.3,
        selfLight: 0.22,
        clearcoat: 1.0,
        clearcoatRoughness: 0.15,
      },
      pearl: {
        albedo: '#f3ecdf',
        metalness: 0,
        roughness: 0.32,
        selfLight: 0.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.12,
        iridescence: 1.0,
        iridescenceIOR: 1.8,
        iridescenceThicknessRange: [180, 480],
        sheen: 0.5,
        sheenColor: '#fff2e0',
      },
      goldGlass: {
        albedo: '#d9a441', // lerped toward `ascent.summit` by tier height
        metalness: 0,
        roughness: 0.07,
        selfLight: 0, // carried by the mullion emissive node, not a flat term
        // 0.85 muddied the panes to beige — keep more gold body
        transmission: 0.7,
        ior: 1.45,
        thickness: 0.9, // local units — x20 world scale => ~18 m of glass depth
        attenuationColor: '#d9a441',
        attenuationDistance: 1.4,
        specularIntensity: 1.0,
      },
      gem: {
        // no albedo: the twelve hues are cited data (FOUNDATION_GEMS)
        metalness: 0,
        roughness: 0.08,
        // 0.6: enough body that per-facet shading survives
        transmission: 0.6,
        ior: 2.0,
        thickness: 1.2,
        attenuationDistance: 0.9,
        dispersion: 0.25,
        specularIntensity: 1.0,
        // low enough that facet shading reads — 0.7 flattened the cut faces to
        // a uniform pastel strip
        selfLight: 0.4,
      },
    },
    ascent: {
      summit: '#dfeaf0',
    },
    bloomThreshold: 1.5,
  },
  look: {
    timeOfDay: 17.0,
    aerialFogK: 0.12,
    aerialClarity: 0.35,
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
