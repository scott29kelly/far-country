/**
 * Allotment zone map — the authored land-use layout for the Holy Allotment's
 * plateau top (ADR 0015 decision 4's promised zone-map milestone; USER-REFS
 * directive #3 and the holy-allotment / holy-allotment-layout blueprints are
 * the approved art direction).
 *
 * Grounding: Ezek 48:15-19 places the city at the south-centre of the
 * district with open land whose "produce shall be food for the workers of
 * the city" — the crop belts flank the city exactly as the Ezek 45/48
 * schematic draws them ("Open Fields for Crops" either side of the city
 * strip). The band north of the city, toward the priests' dwelling campus,
 * reads as the Zadok portion (Ezek 48:10-11) — rendered orchard-heavy per
 * the reference aerial. Plot sizes, lane spacing, hedgerows and crop species
 * are illustrative context, not cited descriptors (RENDERING-DECISIONS #5
 * posture); the compressed proportions are placeholder per ADR 0009 rule 6.
 *
 * All numbers are WORLD METERS, grid-aligned to the plot pitch so belt edges
 * fall on lane lines. Derivations reference the scene's existing footprints:
 * city+forecourt scatter exclusion x ±2600 / z -2600..2380, approach
 * corridor ±450 (park runs wider, ±780), dwelling campus north of z -5000,
 * south rim lip z ≈ 4400 (fields stop 400 m short of the lip band; the
 * strip beyond stays wild greenbelt meadow, matching the aerials).
 */

import type { AllotmentZoneParams } from '../world/ZoneField';

export const ALLOT_ZONES: AllotmentZoneParams = {
  // 260 × 200 m plots: city-exclusion edges (±2600, -2600) and the approach
  // verge (±780) all sit on grid lines
  pitch: [260, 200],
  laneHalf: 3.2,
  hedgeW: 2.8,
  hedgeP: 0.38,
  belts: [
    // open fields for crops, west and east of the city (Ezek 48:18 flanks)
    { rect: [-6240, -2600, -2600, 4000], orchardP: 0.18, cropP: 0.6 },
    { rect: [2600, 6240, -2600, 4000], orchardP: 0.18, cropP: 0.6 },
    // south strips flanking the processional approach meadow
    { rect: [-2600, -780, 2400, 4000], orchardP: 0.15, cropP: 0.62 },
    { rect: [780, 2600, 2400, 4000], orchardP: 0.15, cropP: 0.62 },
    // Zadok band north toward the dwelling campus — orchard-heavy
    { rect: [-6240, 6240, -4800, -2600], orchardP: 0.52, cropP: 0.22 },
  ],
  // mown park lawn: the whole processional approach, spawn meadow included
  parks: [[-780, 780, 2380, 4350]],
  // approach basin pond (plateau patch basin c=[1150,3550] r=520) + banks
  clears: [{ c: [1150, 3550], r: 700 }],
  // orchard rows run east–west (visible as rows from the south approach);
  // margin keeps trees off the lanes and hedgerows
  orchard: { dx: 15, dz: 20, margin: 9 },
  cropTints: [
    [0.155, 0.125, 0.045], // ripening golden grain
    [0.055, 0.115, 0.024], // young green wheat
    [0.032, 0.085, 0.02], // leafy row crop
    [0.17, 0.15, 0.075], // pale mown hay
  ],
  rowPitch: 3.4,
  // fixed literal — managed planting is deliberate, not seed-jittered
  salt: 0x2f11d,
};
