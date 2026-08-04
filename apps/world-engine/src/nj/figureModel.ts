/**
 * Figure parameter model for the great multitude — the ADR 0019 rebuild
 * (photorealistic redeemed humans; this module is step 2 of the M3.6 attack
 * plan: ONE seeded parametric generator feeding every LOD tier).
 *
 * Policy block:
 *   - ADR 0019 rule 1-2: the redeemed render as realistic human beings —
 *     generic, never portraits; "from every nation, from all tribes and
 *     peoples and languages" (Rev 7:9) is rendered as VISIBLE diversity in
 *     ethnicity, age and build. This module owns that diversity as data:
 *     archetypes (age/build/pose) and per-figure seeded parameters (skin
 *     tone, hair, warmth, width) that the mesh builder and the crowd
 *     materials both consume.
 *   - ADR 0019 rule 3: white robes and palm branches stay the rendered dress.
 *   - ADR 0010: figures face the summit light (yaw comes from the placement,
 *     unchanged); nothing here depicts the divine.
 *   - Placements are NOT owned here — multitudePlacements() in
 *     populationModel.ts is unchanged, so every probe-tested floor/clearance
 *     invariant carries over verbatim.
 *
 * Pure module: no three.js, no DOM — CPU-probe testable. The palette ramps
 * are SHARED TABLES: the TSL materials and the impostor-capture bake both
 * interpolate these same stops (table shared, trivial lerp duplicated — the
 * DISP-table idiom).
 */

/** LOD ring plan + budgets (world metres / triangles) — the binding
 *  constraint of the rebuild (attack-plan step 1). The whole multitude must
 *  stay near ~2M on-screen triangles; tools/probe-crowd.ts asserts the
 *  analytic worst case against these numbers using the real placements. */
export const CROWD_LOD = {
  /** near ring (full generator mesh + ADR 0020 vendored head/hands) fades
   *  out past this. 35 → 30 with the vendored tier: the Anny head adds
   *  ~2.4k tris/figure, and the ring must shrink for the worst-case disc
   *  to stay under trisBudget (probe-crowd C1 recomputes it honestly). */
  r0Far: 30,
  band0: 6,
  /** mid ring (reduced mesh) fades out past this; impostors beyond */
  r1Far: 160,
  band1: 18,
  /** compact-region capacity per (variant, ring-0) group */
  capR0: 256,
  /** compact-region capacity per (variant, ring-1) group */
  capR1: 1024,
  /** impostor group capacity — must cover the whole multitude */
  capImp: 16384,
  /** on-screen triangle budget for the whole multitude (attack plan) */
  trisBudget: 2_200_000,
  /** per-figure triangle ceilings the generator must stay under */
  tris0Max: 6500,
  tris1Max: 900,
} as const;

/** geometry region ids carried in the 'aregion' vertex attribute.
 *  `eye` arrived with the ADR 0020 vendored heads (the Anny eye-front
 *  surfaces are a separate dark-material part). */
export const REGION = { robe: 0, skin: 1, hair: 2, frond: 3, eye: 4 } as const;

/** fixed eye albedo (LINEAR) — dark iris/sclera mass; at crowd range the
 *  eye reads as a value break, not an anatomy claim */
export const EYE_ALBEDO: readonly [number, number, number] = [0.05, 0.038, 0.03];

/** per-region emissive floors (Pillar B: distant figures never pepper
 *  black) — every one stays far under the 1.5 bloom threshold; the probe
 *  asserts worst-case luminance against the palette maxima. */
export const CROWD_EMISSIVE = {
  robe: 0.22,
  skin: 0.08,
  hair: 0.05,
  frond: 0.25,
  eye: 0.04,
} as const;

/**
 * Body archetype — the variant-level (geometry pool) axis of diversity.
 * Continuous per-figure parameters ride on top (skin/hair/warmth/width).
 * Pose: every figure holds a raised palm branch (Rev 7:9); `armLift` varies
 * how high, so assemblies read as many postures of the same worship.
 */
export interface FigureArchetype {
  name: string;
  /** total height, metres at instance scale 1 (top of head) */
  height: number;
  /** shoulder/torso width factor */
  buildW: number;
  /** forward spine curve 0..1 (elders) */
  stoop: number;
  /** raised-arm blend 0 (forward-mid) .. 1 (high overhead) */
  armLift: number;
  /** 0 short cap · 1 shoulder-length · 2 cropped */
  hairStyle: 0 | 1 | 2;
  /** pushes the hair ramp toward silver (age cast) */
  grayBias: number;
  /** robe fold-harmonic phase seed */
  foldSeed: number;
}

/**
 * Six archetypes spanning age and build: three adult builds, an elder, a
 * youth, a child. Heights are ordinary human statures (the text claims no
 * stature); the child/youth presence renders "peoples" as families, not a
 * parade formation.
 */
export const FIGURE_ARCHETYPES: readonly FigureArchetype[] = [
  { name: 'adult-tall', height: 1.82, buildW: 1.06, stoop: 0, armLift: 0.9, hairStyle: 0, grayBias: 0.06, foldSeed: 11 },
  { name: 'adult-broad', height: 1.74, buildW: 1.16, stoop: 0.05, armLift: 0.55, hairStyle: 0, grayBias: 0.1, foldSeed: 23 },
  { name: 'adult-slender', height: 1.68, buildW: 0.92, stoop: 0, armLift: 0.75, hairStyle: 1, grayBias: 0.05, foldSeed: 37 },
  { name: 'elder', height: 1.62, buildW: 1.0, stoop: 0.35, armLift: 0.4, hairStyle: 2, grayBias: 0.75, foldSeed: 41 },
  { name: 'youth', height: 1.5, buildW: 0.88, stoop: 0, armLift: 1.0, hairStyle: 1, grayBias: 0, foldSeed: 53 },
  { name: 'child', height: 1.22, buildW: 0.85, stoop: 0, armLift: 1.0, hairStyle: 0, grayBias: 0, foldSeed: 67 },
] as const;

/** archetype draw weights (probe-asserted to sum to 1): a crowd of mostly
 *  adults with real elder/youth/child presence */
export const ARCHETYPE_WEIGHTS = [0.18, 0.18, 0.24, 0.15, 0.14, 0.11] as const;

/**
 * Skin-tone ramp, LINEAR albedo, deep → pale — the continuous "every
 * nation" axis. Four stops, piecewise-linear; skin01 is drawn UNIFORM so no
 * tone is the "default" one.
 */
export const SKIN_RAMP: readonly (readonly [number, number, number])[] = [
  [0.052, 0.028, 0.016],
  [0.268, 0.106, 0.047],
  [0.579, 0.301, 0.173],
  [0.852, 0.595, 0.442],
] as const;

/** hair ramp, LINEAR albedo, black → brown → auburn → blond */
export const HAIR_RAMP: readonly (readonly [number, number, number])[] = [
  [0.02, 0.015, 0.012],
  [0.06, 0.035, 0.02],
  [0.15, 0.06, 0.03],
  [0.45, 0.32, 0.15],
] as const;

/** silver/white the grayBias pulls toward */
export const HAIR_GRAY: readonly [number, number, number] = [0.55, 0.55, 0.57];

/** robe albedo at warm01 extremes: white pulled toward warm ivory —
 *  the pre-ADR-0019 warm-tone variation, kept */
export function robeAlbedo(warm01: number): [number, number, number] {
  const w = warm01 * 0.4;
  return [1.0, 1.0 - 0.06 * w, 1.0 - 0.16 * w];
}

/** piecewise-linear ramp lookup (CPU mirror of the trivial shader lerp) */
function rampAt(
  ramp: readonly (readonly [number, number, number])[],
  t: number,
): [number, number, number] {
  const n = ramp.length - 1;
  const x = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(x), n - 1);
  const f = x - i;
  const a = ramp[i];
  const b = ramp[i + 1];
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

export function skinAt(skin01: number): [number, number, number] {
  return rampAt(SKIN_RAMP, skin01);
}

export function hairAt(hair01: number, gray: number): [number, number, number] {
  const base = rampAt(HAIR_RAMP, hair01);
  const g = Math.min(Math.max(gray, 0), 1);
  return [
    base[0] + (HAIR_GRAY[0] - base[0]) * g,
    base[1] + (HAIR_GRAY[1] - base[1]) * g,
    base[2] + (HAIR_GRAY[2] - base[2]) * g,
  ];
}

/** per-figure continuous parameters (variant picks the geometry pool) */
export interface FigureParams {
  /** index into FIGURE_ARCHETYPES */
  variant: number;
  /** skin-ramp position, uniform 0..1 */
  skin01: number;
  /** hair-ramp position, uniform 0..1 */
  hair01: number;
  /** robe warmth 0..1 */
  warm01: number;
  /** lateral (x/z) width jitter applied in the shader */
  widthJ: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic per-figure parameters, seeded by placement index — fixed
 * seed, independent of ?seed, exactly like multitudePlacements() itself, so
 * probes and stills are stable build to build.
 */
export function figureParams(index: number): FigureParams {
  const rng = mulberry32(0x0f19c0de ^ Math.imul(index + 1, 2654435761));
  const w = rng();
  let variant = 0;
  let acc = 0;
  for (let i = 0; i < ARCHETYPE_WEIGHTS.length; i++) {
    acc += ARCHETYPE_WEIGHTS[i];
    if (w < acc) {
      variant = i;
      break;
    }
  }
  return {
    variant,
    skin01: rng(),
    hair01: rng(),
    warm01: rng(),
    widthJ: 0.92 + rng() * 0.16,
  };
}

/**
 * Authored-invariant summary for the probe: weights sum to 1, ramps are
 * in-gamut, emissive worst case stays under the bloom threshold.
 */
export function figureModelInvariants(): { ok: boolean; detail: string } {
  const wsum = ARCHETYPE_WEIGHTS.reduce((a, b) => a + b, 0);
  if (Math.abs(wsum - 1) > 1e-6) {
    return { ok: false, detail: `archetype weights sum to ${wsum}` };
  }
  for (const ramp of [SKIN_RAMP, HAIR_RAMP]) {
    for (const stop of ramp) {
      if (stop.some((c) => c < 0 || c > 1)) {
        return { ok: false, detail: `palette stop out of gamut: ${stop.join(',')}` };
      }
    }
  }
  const lum = (c: readonly [number, number, number], k: number): number =>
    (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * k;
  const worst = Math.max(
    lum(robeAlbedo(0), CROWD_EMISSIVE.robe),
    lum(skinAt(1), CROWD_EMISSIVE.skin),
    lum(hairAt(1, 1), CROWD_EMISSIVE.hair),
    lum([0.31, 0.604, 0.235], CROWD_EMISSIVE.frond),
    lum(EYE_ALBEDO, CROWD_EMISSIVE.eye),
  );
  if (worst >= 1.5) {
    return { ok: false, detail: `emissive luminance ${worst.toFixed(3)} crosses bloom 1.5` };
  }
  return { ok: true, detail: `weights 1.0, palettes in gamut, worst emissive ${worst.toFixed(3)}` };
}
