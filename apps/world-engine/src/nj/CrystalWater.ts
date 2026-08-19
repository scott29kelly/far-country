/**
 * Crystal water for the authored river of life (Rev 22:1 — "bright as
 * crystal") — CITY-QUALITY-BAR delta #7 and the USER-REFS river directive.
 *
 * Purpose-built TSL materials that copy the PROVEN screen-space idioms of the
 * terrain's WaterMaterial (viewportSharedTexture refraction with the
 * viewportDepthTexture leak guard, Beer–Lambert absorption on screen-space
 * thickness, an 18-step SSR march with sky fallback, fresnel on a FLATTENED
 * normal, two-phase flowmap advection over the baked fbm gradients) while
 * replacing its two hydrology inputs — flow direction/speed and the
 * waterY-drop foam — with authored per-reach uniforms. The hydrology field
 * itself is untouched: it cannot express this river (the buildWaterY
 * cliff-cut kernel deletes vertical falls by construction, and the plaza
 * reach rides above the heightfield), and the engine has no waterfall
 * renderer at all, so the falls get their own small ribbon material.
 *
 * Crystal deltas from the alpine water: absorption ~0.15× (high transmission
 * — the gold bed must glow through), quartered turbidity, and a faint
 * emissive floor for the "living light" read, kept far under the 1.5 bloom
 * threshold.
 */

import { DoubleSide, Vector2, Vector3 } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Break,
  Fn,
  If,
  Loop,
  abs,
  cameraFar,
  cameraNear,
  cameraPosition,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  exp,
  float,
  fract,
  getScreenPosition,
  interleavedGradientNoise,
  mix,
  perspectiveDepthToViewZ,
  positionLocal,
  positionView,
  positionWorld,
  reflect,
  screenCoordinate,
  screenUV,
  smoothstep,
  texture,
  time,
  transformNormalToView,
  uniform,
  vec2,
  vec3,
  vec4,
  viewportDepthTexture,
  viewportSharedTexture,
} from 'three/tsl';
import { causticContext } from '../render/Caustics';
import { FLOW_CYC } from '../render/WaterMaterial';
import { PERIOD_FBM } from '../gpu/passes/NoiseBake';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NF, NI, NV2, NV3, NV4 } from '../gpu/TSLTypes';
import type { Atmosphere } from '../sky/Atmosphere';
import type { Heightfield } from '../world/Heightfield';

/** crystal water: ~0.15× the alpine SIGMA — "bright as crystal" transmission */
const SIGMA = { r: 0.063, g: 0.02, b: 0.014 };

export interface CrystalReachOpts {
  /** authored surface flow (world m/s) — the hydrology field is zero here */
  flow: Vector2;
  /** extra plunge/churn foam 0..1 (pools under the falls; 0 on calm reaches) */
  foam?: number;
  /**
   * concentrate the churn around a world-space impact point (a fall ribbon
   * striking the pool): full extra foam inside ~r/3, fading out by r. The
   * plunge-pools reference reads as STILL water with a churned inlet — a
   * uniform `foam` over the whole pool reads as noise, not as a plunge.
   */
  impact?: { x: number; z: number; r: number };
}

/**
 * Crystal surface material for a horizontal authored reach (channel, ledge
 * pool, source basin). The geometry must be a TOP-SURFACE plane with an
 * OPAQUE bed mesh below it — screen-space thickness needs a bed to hit.
 */
export function crystalSurfaceMaterial(
  hf: Heightfield,
  atm: Atmosphere,
  gi: ProbeGI | null,
  opts: CrystalReachOpts,
): MeshStandardNodeMaterial {
  const noiseA = hf.noiseA;
  if (!noiseA) throw new Error('crystalSurfaceMaterial needs baked noise');

  const mat = new MeshStandardNodeMaterial();
  mat.transparent = true;
  mat.depthWrite = true;
  mat.metalness = 0;

  // ---- authored flow (replaces the hydrology lookup) -------------------------
  const flowU = uniform(opts.flow.clone());
  const flowV = vec2(flowU as unknown as NV2);
  const spd = flowV.length() as unknown as NF;
  const fdir = flowV.div(spd.max(1e-4)) as unknown as NV2;

  // ---- ripple normal: two-phase flowmap over fbm gradients (verbatim idiom) --
  const ph1 = fract(time.mul(FLOW_CYC)) as unknown as NF;
  const ph2 = fract(time.mul(FLOW_CYC).add(0.5)) as unknown as NF;
  const w2 = abs(ph1.sub(0.5)).mul(2) as unknown as NF;
  const vel = fdir.mul(spd.mul(1.9)).add(vec2(0.045, 0.03)) as unknown as NV2;
  const gradAt = (s: number, off: NV2): NV2 =>
    (texture(noiseA, positionWorld.xz.sub(off).div(s * PERIOD_FBM)) as unknown as NV4).zw.div(
      s,
    ) as unknown as NV2;
  const offA = vel.mul(ph1.div(FLOW_CYC)) as unknown as NV2;
  const offB = vel.mul(ph2.div(FLOW_CYC)).add(vec2(3.71, 1.13)) as unknown as NV2;
  const layer = (off: NV2): NV2 =>
    gradAt(0.9, off).add(gradAt(3.4, off.mul(0.62) as unknown as NV2).mul(0.5)) as unknown as NV2;
  const grad = mix(layer(offA), layer(offB), w2) as unknown as NV2;
  const rippleAmp = float(0.007).add(spd.mul(0.028)) as unknown as NF;
  const slope = grad.mul(rippleAmp) as unknown as NV2;
  const n = vec3(slope.x.negate(), 1, slope.y.negate()).normalize() as unknown as NV3;
  mat.normalNode = transformNormalToView(n) as unknown as typeof mat.normalNode;

  // ---- view / depth (verbatim idiom) ------------------------------------------
  const toCam = cameraPosition.sub(positionWorld) as unknown as NV3;
  const dist = toCam.length() as unknown as NF;
  const viewDir = toCam.div(dist.max(1e-4)) as unknown as NV3;
  const fragZ = positionView.z as unknown as NF;

  const refrK = clamp(float(9).div(dist.max(1)), 0.04, 1).mul(0.055) as unknown as NF;
  const ruv = screenUV.add(n.xz.mul(refrK)) as unknown as NV2;
  const zR = perspectiveDepthToViewZOf(ruv);
  const leaked = zR.greaterThan(fragZ.add(0.02));
  const one = float(1);
  const zero = float(0);
  const uvF = mix(ruv, screenUV as unknown as NV2, leaked.select(one, zero)) as unknown as NV2;
  const zScene = mix(zR, perspectiveDepthToViewZOf(screenUV as unknown as NV2), leaked.select(one, zero)) as unknown as NF;
  const thick = fragZ.sub(zScene).max(0) as unknown as NF;
  const vDepth = thick.mul(viewDir.y.abs().max(0.06)) as unknown as NF;

  // ---- transmitted light: crystal absorption + faint turbidity ----------------
  const sceneCol = (viewportSharedTexture(uvF) as unknown as NV4).rgb as unknown as NV3;
  const absorb = thick.mul(1.25) as unknown as NF;
  const T = vec3(
    exp(absorb.mul(-SIGMA.r)),
    exp(absorb.mul(-SIGMA.g)),
    exp(absorb.mul(-SIGMA.b)),
  ) as unknown as NV3;
  const inscat = atm
    .skyColor(vec3(0, 1, 0) as unknown as NV3)
    .mul(vec3(0.004, 0.01, 0.009)) as unknown as NV3;
  const refr = sceneCol.mul(T).add(inscat.mul(vec3(1, 1, 1).sub(T))) as unknown as NV3;

  // ---- reflection: SSR march, simplified fallback (open plateau, no gorge) ----
  const rdir = reflect(
    viewDir.negate(),
    vec3(n.x.mul(0.55), n.y, n.z.mul(0.55)).normalize(),
  ) as unknown as NV3;
  const reflection = Fn((): NV3 => {
    const dirV = cameraViewMatrix.mul(vec4(rdir, 0)).xyz;
    const stepLen = clamp(dist.mul(0.09), 0.25, 28);
    const jitter = interleavedGradientNoise(screenCoordinate.xy);
    const hit = float(0).toVar();
    const hitUv = vec2(0, 0).toVar();
    Loop(18, ({ i }: { readonly i: NI }) => {
      const t = float(i).add(jitter).mul(stepLen);
      const pV = positionView.add(dirV.mul(t));
      const uvS = getScreenPosition(pV, cameraProjectionMatrix) as unknown as NV2;
      If(
        uvS.x.lessThan(0).or(uvS.x.greaterThan(1)).or(uvS.y.lessThan(0)).or(uvS.y.greaterThan(1)),
        () => {
          Break();
        },
      );
      const zS = perspectiveDepthToViewZOf(uvS);
      If(
        zS.greaterThan(pV.z.add(0.06)).and(zS.lessThan(pV.z.add(stepLen.mul(2.6).add(0.7)))),
        () => {
          hit.assign(1);
          hitUv.assign(uvS);
          Break();
        },
      );
    });
    const rdirUp = vec3(rdir.x, rdir.y.max(0.035), rdir.z).normalize() as unknown as NV3;
    const sky = atm.skyColor(rdirUp) as unknown as NV3;
    const amb = gi
      ? (gi.irradiance(positionWorld as unknown as NV3, rdir).mul(0.65) as unknown as NV3)
      : (sky.mul(0.25) as unknown as NV3);
    // misses looking DOWN the reflected ray (toward the city/banks) fall to
    // ambient; upward rays clear to sky — no gorge-wall horizon test needed
    const fallback = mix(amb, sky, smoothstep(-0.02, 0.22, rdir.y) as unknown as NF) as unknown as NV3;
    const e = hitUv.sub(0.5).abs().mul(2);
    const edgeFade = smoothstep(1.0, 0.82, e.x.max(e.y));
    const scene = (viewportSharedTexture(hitUv as unknown as NV2) as unknown as NV4).rgb;
    return mix(fallback, scene as unknown as NV3, hit.mul(edgeFade) as unknown as NF) as unknown as NV3;
  })();
  const skyRefl = reflection as unknown as NV3;
  const nFres = vec3(n.x.mul(0.3), n.y, n.z.mul(0.3)).normalize() as unknown as NV3;
  const cosT = clamp(viewDir.dot(nFres), 0.0, 1.0) as unknown as NF;
  const fres = float(0.02).add(float(0.98).mul(cosT.oneMinus().pow(5))) as unknown as NF;

  // ---- foam: shore feather + authored plunge churn (two-phase pattern) --------
  const foamUv = (off: NV2, s: number): NV2 =>
    positionWorld.xz.sub(off).div(s * PERIOD_FBM) as unknown as NV2;
  const fA = (texture(noiseA, foamUv(offA, 0.55)) as unknown as NV4).y as unknown as NF;
  const fB = (texture(noiseA, foamUv(offB.mul(1.13) as unknown as NV2, 0.55)) as unknown as NV4)
    .y as unknown as NF;
  const dA = (texture(noiseA, foamUv(offA.mul(0.6) as unknown as NV2, 0.21)) as unknown as NV4)
    .y as unknown as NF;
  const dB = (texture(noiseA, foamUv(offB.mul(0.71) as unknown as NV2, 0.21)) as unknown as NV4)
    .y as unknown as NF;
  const varNorm = w2.mul(w2).add(w2.oneMinus().mul(w2.oneMinus())).sqrt() as unknown as NF;
  const fblend = mix(fA, fB, w2).sub(0.5).div(varNorm).add(0.5) as unknown as NF;
  const fDetail = mix(dA, dB, w2).sub(0.5).div(varNorm).add(0.5) as unknown as NF;
  const foamPatNear = smoothstep(
    0.42,
    0.85,
    fblend.mul(0.62).add(fDetail.mul(0.38)),
  ) as unknown as NF;
  // DE-SPECKLE (round-2 critic: the canal read as "a uniform repeating
  // sparkle pattern at the same scale near and far"): the ~2 m foam
  // features drop under a pixel by a few hundred metres and the threshold
  // aliases into fixed-contrast shimmer. Collapse the pattern toward its
  // 0.30 coverage mean with distance (same constants as WaterMaterial —
  // 90→650 m spans "resolved" to "fully sub-pixel").
  const foamPat = mix(float(0.3), foamPatNear, smoothstep(650, 90, dist)) as unknown as NF;
  const shoreFoam = smoothstep(0.16, 0.03, vDepth).mul(0.42) as unknown as NF;
  // plunge churn: authored constant, optionally concentrated at the fall's
  // impact point (r/3 core → r fade puts the white where the ribbon lands
  // and lets the pool rim go still, matching the plunge-pools reference)
  let churn = float(opts.foam ?? 0) as unknown as NF;
  if (opts.impact) {
    const dImp = positionWorld.xz
      .sub(vec2(opts.impact.x, opts.impact.z))
      .length() as unknown as NF;
    churn = churn.mul(
      smoothstep(opts.impact.r, opts.impact.r / 3, dImp).mul(0.85).add(0.15),
    ) as unknown as NF;
  }
  const foam = clamp(shoreFoam.add(churn), 0, 1)
    .mul(foamPat)
    .clamp(0, 0.68) as unknown as NF;

  // ---- compose ------------------------------------------------------------------
  mat.colorNode = vec3(0.74, 0.76, 0.74).mul(foam) as unknown as typeof mat.colorNode;
  // faint self-light floor: the river reads as living light against the gold,
  // far under the 1.5 bloom threshold
  mat.emissiveNode = mix(refr, skyRefl, fres)
    .mul(foam.oneMinus())
    .add(vec3(0.012, 0.028, 0.036)) as unknown as typeof mat.emissiveNode;
  // SUN-PATH RECOVERY (same derivation as WaterMaterial): mips flatten the
  // ripple slopes past a few hundred metres, so fold the lost slope
  // variance into roughness and let the scene sun paint the far glitter
  // path. Near water keeps the approved glassy crystal read (0.05).
  const distRough = smoothstep(40, 600, dist).mul(0.23) as unknown as NF;
  mat.roughnessNode = mix(
    float(0.05).add(distRough),
    float(0.55),
    foam,
  ) as unknown as typeof mat.roughnessNode;
  mat.opacityNode = smoothstep(0.004, 0.05, vDepth).mul(0.985) as unknown as typeof mat.opacityNode;

  return mat;
}

/** viewport depth → view Z at a given uv (used by refraction + SSR above) */
function perspectiveDepthToViewZOf(uv: NV2): NF {
  const d = (viewportDepthTexture(uv) as unknown as NV4).x as unknown as NF;
  return perspectiveDepthToViewZ(d, cameraNear, cameraFar) as unknown as NF;
}

/** fall streak cycles/s — falls churn faster than the flowmap surfaces */
const FALL_CYC = 0.8;

/**
 * Waterfall ribbon material for the tier cascades: a vertical sheet of
 * downward-advected streaks (two-phase — a single scroll snaps once per
 * cycle), whitening toward the plunge, grazing-edge fresnel, soft edges.
 * The engine has no waterfall renderer — this is new, deliberately small.
 * Geometry: a +Z-facing plane, origin at the ribbon's bottom-centre,
 * `heightLocal` tall (local units; ×20 world), inside the allot group.
 */
export function crystalFallMaterial(
  hf: Heightfield,
  atm: Atmosphere,
  widthLocal: number,
  heightLocal: number,
): MeshStandardNodeMaterial {
  const noiseA = hf.noiseA;
  if (!noiseA) throw new Error('crystalFallMaterial needs baked noise');

  const mat = new MeshStandardNodeMaterial();
  mat.transparent = true;
  mat.depthWrite = false; // thin sheet over the tier face behind it
  mat.metalness = 0;
  mat.roughness = 0.35;

  // pane-local coords in WORLD metres (the allot group is scaled ×20)
  const u = positionLocal.x.mul(20) as unknown as NF;
  const yNorm = positionLocal.y.div(heightLocal).clamp(0, 1) as unknown as NF; // 0 bottom..1 top
  const v = positionLocal.y.mul(20) as unknown as NF;

  // two-phase DOWNWARD advection — fall speed ~14 m/s
  const ph1 = fract(time.mul(FALL_CYC)) as unknown as NF;
  const ph2 = fract(time.mul(FALL_CYC).add(0.5)) as unknown as NF;
  const w2 = abs(ph1.sub(0.5)).mul(2) as unknown as NF;
  const speed = 14;
  const streakAt = (off: NF, s: number, xk: number): NF =>
    (
      texture(noiseA, vec2(u.mul(xk).div(s * PERIOD_FBM), v.add(off).div(s * PERIOD_FBM * 3.4))) as unknown as NV4
    ).y as unknown as NF;
  const offA = ph1.div(FALL_CYC).mul(speed) as unknown as NF;
  const offB = ph2.div(FALL_CYC).mul(speed).add(37.1) as unknown as NF;
  // every octave lives inside the two-phase blend (WaterMaterial contract)
  const sA = streakAt(offA, 0.5, 3.2).mul(0.62).add(streakAt(offA.mul(1.31), 0.2, 5.1).mul(0.38)) as unknown as NF;
  const sB = streakAt(offB, 0.5, 3.2).mul(0.62).add(streakAt(offB.mul(1.31), 0.2, 5.1).mul(0.38)) as unknown as NF;
  const streak = mix(sA, sB, w2) as unknown as NF;

  // whiten + thicken toward the plunge; soften both vertical ends
  const plunge = smoothstep(0.22, 0.0, yNorm) as unknown as NF;
  const body = smoothstep(0.3, 0.72, streak.add(plunge.mul(0.25))) as unknown as NF;
  const edge = smoothstep(0.0, 0.06, yNorm).mul(smoothstep(1.0, 0.965, yNorm)) as unknown as NF;
  const uEdge = u.div(widthLocal * 20).add(0.5) as unknown as NF; // 0..1 across
  const sideFade = smoothstep(0.0, 0.09, uEdge).mul(smoothstep(1.0, 0.91, uEdge)) as unknown as NF;

  // grazing fresnel brightens the sheet's silhouette
  const toCam = cameraPosition.sub(positionWorld) as unknown as NV3;
  const viewDir = toCam.div(toCam.length().max(1e-4)) as unknown as NV3;
  const cosT = clamp(viewDir.z.abs(), 0, 1) as unknown as NF; // sheet faces ±Z locally
  const fres = float(0.15).add(float(0.85).mul(cosT.oneMinus().pow(3))) as unknown as NF;

  // pale sky-fed water light + white churn — under the bloom threshold
  const sky = atm.skyColor(vec3(0, 0.35, 0.94).normalize() as unknown as NV3) as unknown as NV3;
  const waterCol = vec3(0.62, 0.78, 0.86).mul(sky.mul(0.5).add(vec3(0.5, 0.5, 0.5))) as unknown as NV3;
  const white = vec3(0.92, 0.95, 0.97) as unknown as NV3;
  mat.colorNode = vec3(0.2, 0.24, 0.26).mul(body) as unknown as typeof mat.colorNode;
  // The 2026-07-29 GPU pass found the city cascade reading as a flat grey
  // veil hung over the whole south facade rather than as water, and a
  // ?stages=-river ablation confirmed the owner. The streak simulation above
  // was never the problem: the CONSTANT FLOORS underneath it were. An opacity
  // floor of 0.18 makes the sheet 18% opaque everywhere the streaks are NOT,
  // so the gaps between strands — the part that should show the facade behind
  // and read as falling water rather than a pane — were a uniform wash; the
  // 0.25 emissive floor then lit that wash. Dropping both to near zero lets
  // `body` actually carry the sheet, which is what it was written to do.
  //
  // Only the CITY cascade changes. `crystalFallMaterialWorld` keeps its
  // higher floors on purpose: the rim falls are judged from ~1 km against
  // pale rock, where this close-range translucency would vanish.
  mat.emissiveNode = mix(waterCol.mul(0.45), white.mul(0.85), plunge.mul(0.6).add(fres.mul(0.25)))
    .mul(body.mul(0.92).add(0.08)) as unknown as typeof mat.emissiveNode;
  mat.opacityNode = body
    .mul(0.88)
    .add(0.05)
    .mul(edge)
    .mul(sideFade) as unknown as typeof mat.opacityNode;

  return mat;
}

/**
 * World-space waterfall ribbon (the plateau-rim falls, ADR 0016) — sibling of
 * crystalFallMaterial, which is welded to the ×20 allotment frame (the city
 * cascades depend on that; do not unify). Differences: geometry is authored
 * in METRES (no ×20), the sheet faces an arbitrary outward azimuth around the
 * rim so fresnel/facing use the sheet's world normal (passed in — rim falls
 * never rotate after build), and dimensions are world metres.
 */
export function crystalFallMaterialWorld(
  hf: Heightfield,
  atm: Atmosphere,
  widthM: number,
  heightM: number,
  outwardNormal: Vector2,
): MeshStandardNodeMaterial {
  const noiseA = hf.noiseA;
  if (!noiseA) throw new Error('crystalFallMaterialWorld needs baked noise');

  const mat = new MeshStandardNodeMaterial();
  mat.transparent = true;
  mat.depthWrite = false;
  mat.metalness = 0;
  mat.roughness = 0.35;

  const u = positionLocal.x as unknown as NF;
  const yNorm = positionLocal.y.div(heightM).clamp(0, 1) as unknown as NF;
  const v = positionLocal.y as unknown as NF;

  const ph1 = fract(time.mul(FALL_CYC)) as unknown as NF;
  const ph2 = fract(time.mul(FALL_CYC).add(0.5)) as unknown as NF;
  const w2 = abs(ph1.sub(0.5)).mul(2) as unknown as NF;

  // ---- lane field: persistent fast/slow ropes ---------------------------------
  // Round-2 critic: the ribbons read as "uniform-alpha slabs — no internal
  // streak variation". Real ribbon falls organize into vertical ROPES fed
  // by notches in the lip — structure constant down the whole drop. Sample
  // the fbm at a FIXED v (0.317, an arbitrary row) so each x keeps its
  // lane value top to bottom; 0.14·64 ≈ 9 m lane period across the 44 m
  // sheet ≈ 5 ropes.
  const lane = (
    texture(noiseA, vec2(u.div(0.14 * PERIOD_FBM), 0.317)) as unknown as NV4
  ).y as unknown as NF;

  // two advection speeds, each inside its own two-phase pair (every
  // advected octave must live inside the blend — WaterMaterial contract):
  // 9 / 17 m/s bracket the old single 14 m/s around plausible mid-drop
  // fall speeds, and the lane picks per rope — fast and slow lanes read as
  // genuinely different water, not one scrolled texture.
  const streakAt = (off: NF, s: number, xk: number): NF =>
    (
      texture(
        noiseA,
        vec2(u.mul(xk).div(s * PERIOD_FBM), v.add(off).div(s * PERIOD_FBM * 3.4)),
      ) as unknown as NV4
    ).y as unknown as NF;
  const streakPair = (speed: number): NF => {
    const oA = ph1.div(FALL_CYC).mul(speed) as unknown as NF;
    const oB = ph2.div(FALL_CYC).mul(speed).add(37.1) as unknown as NF;
    const a = streakAt(oA, 0.5, 3.2)
      .mul(0.62)
      .add(streakAt(oA.mul(1.31), 0.2, 5.1).mul(0.38)) as unknown as NF;
    const b = streakAt(oB, 0.5, 3.2)
      .mul(0.62)
      .add(streakAt(oB.mul(1.31), 0.2, 5.1).mul(0.38)) as unknown as NF;
    return mix(a, b, w2) as unknown as NF;
  };
  const laneMask = smoothstep(0.35, 0.65, lane) as unknown as NF;
  const streak = mix(streakPair(9), streakPair(17), laneMask) as unknown as NF;

  const plunge = smoothstep(0.22, 0.0, yNorm) as unknown as NF;
  // the lane also offsets the body threshold ±0.15: sparse lanes open into
  // translucent gauze, dense lanes close into white ropes
  const body = smoothstep(
    0.3,
    0.72,
    streak.add(plunge.mul(0.25)).add(lane.sub(0.5).mul(0.3)),
  ) as unknown as NF;
  // aeration: entrained air accumulates with fall distance — white builds
  // from ~2/3 down and saturates at the plunge (the plunge-pools reference
  // shows OPAQUE white turbulence at the base, not glass). Clumped by the
  // streak field so it reads as churn, not a vertical gradient.
  const aer = smoothstep(0.7, 0.06, yNorm)
    .mul(streak.mul(0.8).add(0.35))
    .clamp(0, 1) as unknown as NF;
  const edge = smoothstep(0.0, 0.06, yNorm).mul(smoothstep(1.0, 0.965, yNorm)) as unknown as NF;

  // ---- ragged sides -----------------------------------------------------------
  // the margins wander with a downward-advected noise line (two-phase,
  // 9 m/s like the slow lanes): 3%..14% of the width per side, so the
  // silhouette flutters instead of ruling two straight lines ("perfectly
  // straight-edged slabs", round-2 critic). Rows 0.137/0.731 are arbitrary
  // decorrelated fbm rows; 0.3·64 ≈ 19 m vertical feature length.
  const uEdge = u.div(widthM).add(0.5) as unknown as NF;
  const oA9 = ph1.div(FALL_CYC).mul(9) as unknown as NF;
  const oB9 = ph2.div(FALL_CYC).mul(9).add(37.1) as unknown as NF;
  const edgeN = (row: number): NF =>
    mix(
      (texture(noiseA, vec2(float(row), v.add(oA9).div(0.3 * PERIOD_FBM))) as unknown as NV4).y,
      (texture(noiseA, vec2(float(row), v.add(oB9).div(0.3 * PERIOD_FBM))) as unknown as NV4).y,
      w2,
    ) as unknown as NF;
  const mL = edgeN(0.137).mul(0.11).add(0.03) as unknown as NF;
  const mR = edgeN(0.731).mul(0.11).add(0.03) as unknown as NF;
  const sideFade = smoothstep(mL, mL.add(0.07), uEdge).mul(
    smoothstep(float(1).sub(mR), float(1).sub(mR).sub(0.07), uEdge),
  ) as unknown as NF;

  // grazing fresnel against the sheet's WORLD normal (rim falls face outward
  // at arbitrary azimuths — the local-frame ±Z assumption does not hold here)
  const nU = uniform(new Vector3(outwardNormal.x, 0, outwardNormal.y).normalize());
  const toCam = cameraPosition.sub(positionWorld) as unknown as NV3;
  const viewDir = toCam.div(toCam.length().max(1e-4)) as unknown as NV3;
  const cosT = clamp(viewDir.dot(nU as unknown as NV3).abs(), 0, 1) as unknown as NF;
  const fres = float(0.15).add(float(0.85).mul(cosT.oneMinus().pow(3))) as unknown as NF;

  const sky = atm.skyColor(vec3(0, 0.35, 0.94).normalize() as unknown as NV3) as unknown as NV3;
  const waterCol = vec3(0.62, 0.78, 0.86).mul(
    sky.mul(0.5).add(vec3(0.5, 0.5, 0.5)),
  ) as unknown as NV3;
  const white = vec3(0.92, 0.95, 0.97) as unknown as NV3;
  // impact flash: the last ~8% (top boundary raggedized by the streak) goes
  // full white where the ribbon meets the pool — the contact line is the
  // brightest churn in every falls reference
  const impact = smoothstep(streak.mul(0.06).add(0.08), 0.0, yNorm) as unknown as NF;
  mat.colorNode = vec3(0.2, 0.24, 0.26).mul(body) as unknown as typeof mat.colorNode;
  // The old constant floors (0.3 emissive, 0.38 opacity) — added so the rim
  // falls survive a ~1 km judge against pale rock — were exactly the
  // round-2 "translucent glass rectangle" read: 38% uniform alpha wherever
  // the streaks were NOT. Cut them (0.3→0.12 emissive, 0.38→0.10 opacity)
  // and carry the ~1 km presence with structure instead: aeration whitening
  // down-fall + the near-opaque impact band. Peak emissive ≈ 1.4 stays just
  // under the 1.5 bloom threshold.
  // aeration must be ADDITIVE white: gated through the body multiply it
  // peaked ~0.3 — dimmer than the sun-lit pale rock behind, so the lower
  // ribbon DARKENED the wall instead of whitening (first-iteration shot).
  // body-carried glass ~0.75 peak + 0.5 aer + 0.4 impact ≈ 1.6 only where
  // churn stacks on the contact line — a touch of bloom at the base is the
  // reference read (falls bases glow white against shadowed rock).
  mat.emissiveNode = mix(
    waterCol.mul(0.55),
    white.mul(1.05),
    aer.mul(0.7).add(streak.mul(0.25)).add(fres.mul(0.12)).clamp(0, 1),
  )
    .mul(body.mul(0.75).add(0.12))
    .add(white.mul(aer.mul(0.5)))
    .add(white.mul(impact.mul(0.4))) as unknown as typeof mat.emissiveNode;
  mat.opacityNode = body
    .mul(0.55)
    .add(aer.mul(0.45))
    .add(impact.mul(0.35))
    .add(0.08)
    .clamp(0, 0.96)
    .mul(edge)
    .mul(sideFade) as unknown as typeof mat.opacityNode;

  return mat;
}

/**
 * Gold river-bed material with an authored-depth caustic pass. The engine's
 * applyCaustics keys on hydrology waterY (zero under the authored river), so
 * this samples the SAME per-frame CausticsBake tile with the reach's own
 * constant depth and flow advection. No-ops gracefully without the context.
 */
export function riverBedMaterial(flow: Vector2, depthM: number): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial();
  mat.color.setHex(0xd9a441);
  mat.metalness = 0.6;
  mat.roughness = 0.35;
  // the ledge pools overhang the plaza (pool0 reaches 2.6 local past the wall
  // line) and the walker legitimately passes under them — single-sided beds
  // were backface-culled from below, opening a hole straight through the
  // water to the zenith sky that read as an unlit near-black ceiling
  mat.side = DoubleSide;
  const c = causticContext();
  if (!c) return mat;
  const CAUSTIC_TILE = 11; // world metres per tile (Caustics.ts)
  const ph1 = fract(time.mul(FLOW_CYC)) as unknown as NF;
  const ph2 = fract(time.mul(FLOW_CYC).add(0.5)) as unknown as NF;
  const w2 = abs(ph1.sub(0.5)).mul(2) as unknown as NF;
  const flowU = uniform(flow.clone());
  const vel = vec2(flowU as unknown as NV2).mul(0.8) as unknown as NV2;
  const uvAt = (ph: NF): NV2 =>
    positionWorld.xz.sub(vel.mul(ph.div(FLOW_CYC))).div(CAUSTIC_TILE) as unknown as NV2;
  const tA = (texture(c.bake.tex, uvAt(ph1)) as unknown as NV4).x as unknown as NF;
  const tB = (texture(c.bake.tex, uvAt(ph2).add(vec2(0.37, 0.19)) as unknown as NV2) as unknown as NV4)
    .x as unknown as NF;
  const tint = mix(tA, tB, w2) as unknown as NF;
  // constant authored depth: focal ramp from causticTint (cm water can't focus)
  const focal = smoothstep(0.04, 0.5, float(depthM)) as unknown as NF;
  const sunUp = clamp(float(1), 0, 1) as unknown as NF; // scene sun is always up here
  // DE-SPECKLE (round-2 critic: the canal's tiled sparkle): the ~1 m
  // caustic cells are sub-pixel past a few hundred metres — the net
  // aliased into a fixed-contrast sparkle sheet down the whole channel.
  // Fade the gain out over 140→520 m (one 11 m tile ≈ 40 px → 10 px at
  // 1080p / 55° fov); the far channel then reads by its water surface
  // (fresnel sky + sun path), which is what distance actually shows.
  const bedDist = cameraPosition.sub(positionWorld).length() as unknown as NF;
  const causFade = smoothstep(520, 140, bedDist) as unknown as NF;
  const gain = tint.mul(1.5).mul(focal).mul(sunUp).mul(causFade).add(1) as unknown as NF;
  mat.colorNode = vec3(0.851, 0.643, 0.255).mul(gain) as unknown as typeof mat.colorNode;
  return mat;
}
