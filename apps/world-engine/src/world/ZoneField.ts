/**
 * ZoneField — authored land-use zones over a scene plateau: the managed
 * patchwork of the Holy Allotment (field plots, orchard rows, hedgerow-lined
 * lanes, mown park lawn), sanctioned by ADR 0015 decision 4 ("field plots,
 * hedgerows and orchard planting return properly with a follow-up allotment
 * zone-map milestone") and USER-REFS directive #3 ("the plain is ordered
 * patchwork right up to the built zones"). Ezek 48:18-19's open land around
 * the city grows "food for the workers of the city"; the specific plot
 * layout/species are illustrative context, not cited descriptors (same
 * posture as RENDERING-DECISIONS #5's landscape).
 *
 * The field is a pure analytic function of world position — an axis-aligned
 * plot grid classified per-plot by an integer hash, with belts choosing the
 * type mix. The SAME TSL graph is built by every consumer (scatter kernels,
 * grass ring kernels/material, terrain splat), so instances, blades and
 * ground tint agree by construction, exactly like macroTerrain's plateau.
 * Zones ride on `MacroParams.plateau.zones`; every consumer branches on its
 * presence in JS, so wild scenes compile bit-identical shaders (the
 * `if (mp.plateau)` law).
 *
 * Plots are classified by their CENTER — a plot is wholly in or out of a
 * belt, wholly one type. The patchwork is blocky by design; lanes and
 * hedgerows carry the transitions.
 */

import { float, smoothstep, vec2, vec3 } from 'three/tsl';
import { cellHash, cellHash2 } from '../gpu/passes/CellHash';
import type { NB, NF, NV2, NV3 } from '../gpu/TSLTypes';

export interface ZoneBelt {
  /** plot-grid-aligned rect [x0, x1, z0, z1] (world m) */
  rect: readonly [number, number, number, number];
  /** per-plot probability of orchard / crop (remainder = fallow meadow) */
  orchardP: number;
  cropP: number;
}

export interface AllotmentZoneParams {
  /** plot grid pitch (m), grid lines at integer multiples from world origin */
  pitch: readonly [number, number];
  /** half-width of the worn lane straddling every plot border (m) */
  laneHalf: number;
  /** hedgerow band width just inside the lane verge (m) */
  hedgeW: number;
  /** fraction of plot borders carrying a hedgerow (per-edge hash) */
  hedgeP: number;
  belts: readonly ZoneBelt[];
  /** mown-lawn rects [x0, x1, z0, z1] (approach corridor etc.) */
  parks: readonly (readonly [number, number, number, number])[];
  /** circular keep-clears — plots whose center falls inside revert to meadow */
  clears: readonly { c: readonly [number, number]; r: number }[];
  /** orchard lattice: along-row / between-row spacing + plot-border margin (m) */
  orchard: { dx: number; dz: number; margin: number };
  /** crop sward tints (linear albedo) — per-plot hash picks one */
  cropTints: readonly (readonly [number, number, number])[];
  /** crop row-striping pitch (m) */
  rowPitch: number;
  salt: number;
}

export interface ZoneNodes {
  /** 1 inside any managed plot (crop | orchard | fallow) */
  manage: NF;
  /** 1 in crop plots / orchard plots */
  crop: NF;
  orch: NF;
  /** 0..1 mown-lawn mask (feathered rects, independent of the grid) */
  park: NF;
  /** 0..1 worn lane along plot borders */
  lane: NF;
  /** 0..1 hedgerow band inside the lane verge (hashed border subset) */
  hedge: NF;
  /** per-plot randoms (type roll in x — consumers vary by y) */
  plotR: NV2;
  /** distance to the nearest plot border line (m) */
  borderD: NF;
}

/** Build the zone graph at world position p (xz, meters). */
export function zoneField(p: NV2, zp: AllotmentZoneParams): ZoneNodes {
  const px = p.x.div(zp.pitch[0]);
  const pz = p.y.div(zp.pitch[1]);
  const cellId = vec2(px.floor(), pz.floor());
  const pc = vec2(
    cellId.x.add(0.5).mul(zp.pitch[0]),
    cellId.y.add(0.5).mul(zp.pitch[1]),
  );

  let inBelt: NF = float(0);
  let orchP: NF = float(0);
  let cropP: NF = float(0);
  for (const b of zp.belts) {
    const r = b.rect;
    const inR = pc.x
      .greaterThan(r[0])
      .and(pc.x.lessThan(r[1]))
      .and(pc.y.greaterThan(r[2]))
      .and(pc.y.lessThan(r[3]));
    inBelt = inR.select(float(1), inBelt) as NF;
    orchP = inR.select(float(b.orchardP), orchP) as NF;
    cropP = inR.select(float(b.cropP), cropP) as NF;
  }
  for (const c of zp.clears) {
    inBelt = pc
      .sub(vec2(c.c[0], c.c[1]))
      .length()
      .greaterThan(c.r)
      .select(inBelt, float(0)) as NF;
  }

  const plotR = cellHash2(cellId, zp.salt);
  const orch = inBelt.mul(plotR.x.lessThan(orchP).select(float(1), float(0)));
  const crop = inBelt.mul(
    plotR.x
      .greaterThanEqual(orchP)
      .and(plotR.x.lessThan(orchP.add(cropP)))
      .select(float(1), float(0)),
  );

  // distance (m) to the nearest plot border line on each axis
  const fx = px.fract();
  const fz = pz.fract();
  const dx = fx.min(fx.oneMinus()).mul(zp.pitch[0]);
  const dz = fz.min(fz.oneMinus()).mul(zp.pitch[1]);
  const borderD = dx.min(dz);
  const lane = smoothstep(zp.laneHalf + 0.7, zp.laneHalf - 0.5, borderD).mul(
    inBelt,
  );

  // hedgerows on a hashed SUBSET of borders — hedging every edge reads as a
  // waffle iron and blows the understory budget. Edge id = the nearest
  // lattice line × the plot index along it (vertical/horizontal disambiguated
  // by an odd/even second coordinate).
  const vEdge = dx.lessThan(dz) as NB;
  const edgeId = vEdge.select(
    vec2(px.round(), cellId.y.mul(2)),
    vec2(cellId.x, pz.round().mul(2).add(1)),
  ) as unknown as NV2;
  const hedgeOn = cellHash(edgeId, zp.salt ^ 0x33aa)
    .lessThan(zp.hedgeP)
    .select(float(1), float(0));
  const hedge = hedgeOn
    .mul(smoothstep(zp.laneHalf - 0.3, zp.laneHalf + 0.6, borderD))
    .mul(smoothstep(zp.laneHalf + zp.hedgeW + 0.6, zp.laneHalf + zp.hedgeW - 0.3, borderD))
    .mul(inBelt);

  let park: NF = float(0);
  for (const r of zp.parks) {
    const f = 14; // lawn feathers into meadow, no crisp municipal edge
    park = park.max(
      smoothstep(r[0] - f, r[0] + f, p.x)
        .mul(smoothstep(r[1] + f, r[1] - f, p.x))
        .mul(smoothstep(r[2] - f, r[2] + f, p.y))
        .mul(smoothstep(r[3] + f, r[3] - f, p.y)),
    ) as NF;
  }

  return { manage: inBelt, crop, orch, park, lane, hedge, plotR, borderD };
}

/** Per-plot crop tint — select chain over the authored palette. */
export function cropTint(zp: AllotmentZoneParams, r: NF): NV3 {
  const ts = zp.cropTints;
  const last = ts[ts.length - 1] ?? [0.05, 0.11, 0.02];
  let e: NV3 = vec3(last[0], last[1], last[2]);
  for (let i = ts.length - 2; i >= 0; i--) {
    const t = ts[i] ?? last;
    e = r
      .lessThan((i + 1) / ts.length)
      .select(vec3(t[0], t[1], t[2]), e) as NV3;
  }
  return e;
}

/** Crop row striping, 0..1 (mean 0.5) along north–south — rows run east–west. */
export function cropRows(zp: AllotmentZoneParams, p: NV2): NF {
  return p.y
    .mul((Math.PI * 2) / Math.max(zp.rowPitch, 0.001))
    .sin()
    .mul(0.5)
    .add(0.5);
}
