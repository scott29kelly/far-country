/**
 * Vegetation materials (v1: structure-review shading; TexSynth bark/leaf
 * detail + translucency land with the texture milestone).
 *
 * All vegetation geometry carries a `vdata` vec4 attribute:
 *   x hue jitter (−1..1) · y sway flexibility · z sway phase · w baked AO.
 * Hue/AO are consumed here; sway feeds the Phase-6 wind field.
 */

import { Color, DoubleSide, type DirectionalLight, type Texture, Vector3 } from 'three';
import { MeshPhysicalNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu';
import {
  Fn,
  attribute,
  cameraPosition,
  clamp,
  float,
  mix,
  normalMap,
  normalWorld,
  positionWorld,
  smoothstep,
  texture,
  uv,
  varying,
  vec3,
} from 'three/tsl';
import { fbm3, valueNoise3 } from '../gpu/noise/NoiseTSL';
import type { NF, NV3, NV4 } from '../gpu/TSLTypes';
import { applyCaustics } from './Caustics';
import { runiform } from '../gpu/RenderUniform';

/**
 * Shared sun uniforms for the foliage translucency term (D-2). Updated by
 * the scene on init + time-of-day changes.
 */
export const sunU = {
  dir: runiform(new Vector3(0, 1, 0)),
  color: runiform(new Color(1, 1, 1)),
  intensity: runiform(0),
};

export function updateSunUniforms(sun: DirectionalLight): void {
  sunU.dir.value.copy(sun.position).normalize();
  sunU.color.value.copy(sun.color);
  sunU.intensity.value = sun.intensity;
}

/**
 * Back-lit transmission glow: light through the blade toward a camera that
 * faces the sun. Thin-surface approximation; modest k since it is not
 * shadow-gated yet (full gating with Phase-5/6 light queries).
 *
 * GA3 r4: two-lobe phase function. The original pow-5-only lobe measured ≈0
 * whenever the sun sits more than ~45° off the view axis — at the NJ rim
 * framings (T=17 sun ~80° west of the south-facing view) foliage carried NO
 * transmission at all (r3 critic: "no translucent bright edges where the low
 * sun comes through"). A wide pow-2 wing at lower amplitude keeps a real
 * forward-scatter term alive at cross-lit angles; looking into the sun the
 * tight core still dominates, so the head-on glow is not doubled.
 */
function translucency(albedo: NV3, k: number): NV3 {
  const viewDir = positionWorld.sub(cameraPosition).normalize();
  const toward = clamp(viewDir.dot(vec3(sunU.dir).negate()), 0, 1);
  const glow = toward
    .pow(5)
    .mul(0.7)
    .add(toward.mul(toward).mul(0.45))
    .mul(sunU.intensity)
    .mul(k);
  const sunCol = sunU.color as unknown as NV3;
  return albedo.mul(sunCol).mul(glow).mul(vec3(0.9, 1.05, 0.55));
}

/**
 * Exported variant for the impostor band and the canopy shell: the SAME
 * transmission model as the card crowns, so the R2-card → impostor (460 m)
 * and impostor → shell (620 m) handoffs keep one continuous glow level.
 * Before r4 the impostors had NO translucency term — strengthening the card
 * glow alone would have stamped a visible seam at every ring boundary.
 */
export function foliageTranslucency(albedo: NV3, k: number): NV3 {
  return translucency(albedo, k);
}

/** grass variant: transmission strengthens toward the blade tip */
export function grassTranslucency(albedo: NV3, tipT: NF): NV3 {
  return translucency(albedo, 0.09).mul(tipT);
}

/**
 * GA3 r4 grass contact shading (critic: "the grass beneath is an even carpet
 * with no blade texture or shadowing at contact points"). Two terms, both
 * consumed by GroundRing.grassMaterial (the NJ meadow path):
 *
 * - `grassClumpValue`: per-clump value jitter (±18%) from the instance-cell
 *   hash. The existing patch-scale (1.6 m) dryness drift is too coarse to
 *   read at walk distance — individual clumps must differ from their
 *   neighbors for the sward to carry texture.
 * - `grassContactRamp`: value darkening toward the blade BASE, applied to
 *   albedo (not aoNode) so it survives direct sun — the occlusion at a real
 *   sward's contact points is mutual blade shadowing, which kills direct
 *   light too. Fades out over 130→230 m: the far super-tufts hand off to
 *   the terrain splat at 265 m and the splat has no contact term, so the
 *   handoff must keep the r3-verified matched value.
 */
export function grassClumpValue(albedo: NV3, clumpHash: NF): NV3 {
  return albedo.mul(clumpHash.mul(0.36).add(0.82));
}

export function grassContactRamp(tipT: NF, dist: NF): NF {
  const ramp = smoothstep(-0.05, 0.62, tipT).mul(0.52).add(0.48);
  return mix(ramp, float(1), smoothstep(130, 230, dist));
}

function vdata(): NV4 {
  return attribute('vdata', 'vec4') as unknown as NV4;
}

/**
 * Sun-side self-shadow relief for crown foliage (GA3 r2 "identical
 * dark-green cauliflower clusters" fix).
 *
 * The crown shadow casters (Forests.proxyCasterMat) are solid dithered
 * ellipsoids INSIDE each crown. At a low sun (~12° at T=17) every foliage
 * fragment sits behind some proxy along the sun ray — its own crown's core
 * or a neighbor's — so the cascade maps report 60–90% occlusion across
 * ENTIRE crowns and direct sun never reaches a leaf: crowns collapse to
 * ambient-only flat dark green, erasing the per-card hue variance and the
 * lit/shade separation. ?ablate=casters A/B (shots/wip/ga3/work-veg/
 * rim-zoom-base vs -nocast) confirms the variance is fully present without
 * veg casters.
 *
 * Receiver-side correction, not a caster change: the OUTERMOST leaf along
 * the sun ray is lit by definition — a bulk-occlusion blob cannot express
 * that. Card normals are bent to the crown sphere (radially outward, see
 * VegInstance header), so dot(N, sunDir) says which shell a fragment is on.
 * Lift the received shadow toward 1 on the sun shell; keep full shadow on
 * the shade shell. Interior cards keep their baked-AO darkening (vdata.w),
 * so crowns read lit-rim / dark-core instead of uniformly flat, and the
 * ground keeps its full-strength long shadows (ground materials untouched).
 *
 * `normalWorld` (raw interpolated normal, NOT face-flipped) keeps the term
 * stable for DoubleSide cards regardless of which side faces the camera.
 */
export function foliageSunShadowRelief(
  mat: MeshStandardNodeMaterial,
  k: number,
  /** override the shell normal (impostors relight via captured normals) */
  shellNormal?: NV3,
): void {
  const n = shellNormal ?? (normalWorld as unknown as NV3);
  const facing = n.normalize().dot(vec3(sunU.dir) as unknown as NV3);
  // NOTE (r4 attempt, reverted): gating this lift by a crown-depth shellness
  // chain (varying/mix of vdata.w) turned every card crown beige — nodes
  // built from explicit varyings resolve to garbage inside the
  // receivedShadowNode lighting context (shots/wip/ga3/work-veg4/ab-*).
  // Keep this Fn attribute-free (normalWorld only, the proven r3 form);
  // interior occlusion lives in colorNode/aoNode instead (card material).
  (mat as unknown as { receivedShadowNode: unknown }).receivedShadowNode = Fn(
    (args: unknown) => {
      const shadow = (args as NF[])[0] as NF;
      // ramp eases in just past tangent so the terminator stays soft
      const lift = smoothstep(-0.08, 0.55, facing).mul(k);
      return mix(shadow, float(1), lift);
    },
  );
  // backlit fringe (r4, the honest part of the "translucent bright edges"
  // ask): a sun-shell fragment seen edge-on IS the thin rim where the low
  // sun grazes through the crown silhouette — emissive add of the sun color
  // on (1−|N·V|)^6 × a hard sun-facing gate. pow-6 because crown-sphere-bent
  // normals put a BROAD ring of every crown near the silhouette — a soft
  // pow-3 fringe painted whole sun-side crown halves warm-beige.
  const base = mat.colorNode as unknown as NV3 | null;
  if (base) {
    const viewDir = cameraPosition.sub(positionWorld).normalize();
    const rimK = float(1)
      .sub(n.normalize().dot(viewDir).abs())
      .pow(6)
      .mul(smoothstep(0.3, 0.85, facing))
      .mul(sunU.intensity)
      .mul(0.06 * k);
    const rimE = base
      .mul(sunU.color as unknown as NV3)
      .mul(vec3(1.1, 1.0, 0.62))
      .mul(rimK) as unknown as NV3;
    const prevE = mat.emissiveNode as unknown as NV3 | null;
    mat.emissiveNode = (prevE ? prevE.add(rimE) : rimE) as unknown as typeof mat.emissiveNode;
  }
  // warm forward-scatter on the sun shell: leaves transmit + inter-reflect
  // the low warm sun, so lit crown sides skew golden at 17:00 (plateau refs)
  // while shade shells keep the cool ambient green — scaled by the same k
  const prev = mat.colorNode as unknown as NV3 | null;
  if (prev) {
    const warm = smoothstep(0.0, 0.6, facing).mul(0.7 * k);
    mat.colorNode = prev.mul(
      mix(vec3(1, 1, 1), vec3(1.16, 1.05, 0.78), warm),
    ) as unknown as typeof mat.colorNode;
  }
}

/** hue jitter: rotate albedo toward yellow (+) / blue-green (−) */
function hueShift(base: NV3, hue: NF, amount: number): NV3 {
  const k = hue.mul(amount);
  const warm = vec3(1.18, 1.0, 0.55);
  const cool = vec3(0.7, 0.95, 1.25);
  const shifted = base
    .mul(warm)
    .mul(clamp(k, 0, 1))
    .add(base.mul(cool).mul(clamp(k.negate(), 0, 1)))
    .add(base.mul(float(1).sub(k.abs())));
  return shifted;
}

export interface BarkMatParams {
  color: { r: number; g: number; b: number };
  roughness?: number;
}

export function barkMaterial(p: BarkMatParams): MeshStandardNodeMaterial {
  const mat = new MeshPhysicalNodeMaterial();
  mat.specularIntensity = 0.45;
  const d = vdata();
  const base = vec3(p.color.r, p.color.g, p.color.b);
  mat.colorNode = hueShift(base, d.x, 0.18).mul(d.w.mul(0.75).add(0.25));
  mat.roughness = p.roughness ?? 0.93;
  mat.metalness = 0;
  return mat;
}

/**
 * Synthesized bark material: tileable albedo/cavity + normal/rough/height.
 * Cavity feeds `aoNode` — AO on indirect light only (DEVIATIONS D-1 close).
 */
export function barkTexturedMaterial(tex: {
  texA: Texture;
  texB: Texture;
}): MeshStandardNodeMaterial {
  const mat = new MeshPhysicalNodeMaterial();
  mat.specularIntensity = 0.45;
  const d = vdata();
  const a = texture(tex.texA, uv() as never) as unknown as NV4;
  const b = texture(tex.texB, uv() as never) as unknown as NV4;
  const albedo = a.rgb.mul(a.rgb); // sqrt-encoded at bake
  mat.colorNode = hueShift(albedo, d.x, 0.14).mul(d.w.mul(0.45).add(0.55));
  mat.normalNode = normalMap(vec3(b.x, b.y, 1));
  mat.aoNode = a.w;
  mat.roughnessNode = b.z;
  mat.metalness = 0;
  // tubes are closed — DoubleSide costs ~nothing and guarantees a trunk can
  // never read hollow regardless of LOD/dither state ("inside-out" report)
  mat.side = DoubleSide;
  return mat;
}

/**
 * Procedural rock shading (no UVs): strata banding from vdata.y, lichen
 * spots + dust on open faces, moss by upness (dressing rule), cavity AO via
 * aoNode. Geometric normals carry the meso detail (displaced mesh).
 */
export function rockMaterial(opts?: {
  moss?: number;
  /** base albedo of the lit rock — talus must match the pale cliff that
   *  shed it; the default dark tone is for mossy forest boulders */
  tone?: { r: number; g: number; b: number };
}): MeshStandardNodeMaterial {
  const mat = new MeshPhysicalNodeMaterial();
  mat.specularIntensity = 0.4;
  const d = vdata();
  const wp = positionWorld;
  const strataT = d.y;
  const upness = normalWorld.y.max(0);
  // band tint: alternating warm/cool sediment layers + grain
  const bandTint = valueNoise3(vec3(float(0), strataT.mul(7.3), float(0)).add(wp.mul(0.02)));
  const grain = fbm3(wp.mul(2.1), 3).mul(0.5).add(0.5);
  // mid-gray default: the old near-black tone (0.21/0.165/0.12 peak) was
  // darker than ANY ground splat — boulders read as alien dark blobs on
  // pale dry soil (user feedback). Moss + canopy shade still darken
  // forest rocks; lit field rock is mid-gray in every reference.
  const tone = opts?.tone ?? { r: 0.285, g: 0.255, b: 0.215 };
  let albedo = mix(
    vec3(tone.r * 0.42, tone.g * 0.44, tone.b * 0.55),
    vec3(tone.r, tone.g, tone.b),
    bandTint.mul(0.55).add(grain.mul(0.45)).clamp(0, 1),
  ) as unknown as NV3;
  // pale lichen patches on exposed faces
  const lich = smoothstep(0.62, 0.78, valueNoise3(wp.mul(3.7)))
    .mul(d.z.mul(0.7).add(0.3));
  albedo = mix(albedo, vec3(0.16, 0.175, 0.14), lich.mul(0.55)) as unknown as NV3;
  // dust settles on up-faces
  albedo = mix(albedo, vec3(0.17, 0.15, 0.12), upness.pow(2).mul(0.3)) as unknown as NV3;
  // dirt streaks bleeding down steep faces (dressing rule)
  const steep = float(1).sub(upness);
  const streakN = valueNoise3(vec3(wp.x.mul(2.6), wp.y.mul(0.22), wp.z.mul(2.6)));
  const streak = smoothstep(0.55, 0.82, streakN)
    .mul(smoothstep(0.45, 0.8, steep))
    .mul(0.55);
  albedo = mix(albedo, albedo.mul(vec3(0.5, 0.46, 0.4)), streak) as unknown as NV3;
  const mossAmt = opts?.moss ?? 0.25;
  if (mossAmt > 0) {
    const mossN = smoothstep(0.45, 0.75, fbm3(wp.mul(1.7), 3).mul(0.5).add(0.5));
    const moss = smoothstep(0.45, 0.85, upness)
      .mul(mossN).mul(d.w).mul(mossAmt * 2).clamp(0, 1);
    albedo = mix(albedo, vec3(0.045, 0.085, 0.03), moss) as unknown as NV3;
    mat.roughnessNode = mix(float(0.93), float(1), moss).sub(lich.mul(0.06));
  } else {
    mat.roughnessNode = float(0.93).sub(lich.mul(0.06));
  }
  mat.colorNode = albedo.mul(d.w.mul(0.35).add(0.65));
  mat.aoNode = d.w;
  mat.metalness = 0;
  // submerged boulders / streambed cobbles dance with the water caustics
  applyCaustics(mat);
  return mat;
}

/** deadfall wood: bark textures + moss carpet on the up-side by vdata.z */
export function deadwoodMaterial(
  tex: {
    texA: Texture;
    texB: Texture;
  },
  /** albedo multiplier — branches use the pale snag bark and blow out white
   *  at noon without a dry-wood darkening */
  dim?: { r: number; g: number; b: number },
): MeshStandardNodeMaterial {
  const mat = new MeshPhysicalNodeMaterial();
  mat.specularIntensity = 0.45;
  const d = vdata();
  const a = texture(tex.texA, uv() as never) as unknown as NV4;
  const b = texture(tex.texB, uv() as never) as unknown as NV4;
  let albedo = a.rgb.mul(a.rgb) as unknown as NV3;
  if (dim) albedo = albedo.mul(vec3(dim.r, dim.g, dim.b)) as unknown as NV3;
  const mossN = smoothstep(0.24, 0.58, fbm3(positionWorld.mul(2.6), 3).mul(0.5).add(0.5));
  const moss = smoothstep(0.05, 0.65, normalWorld.y).mul(d.z).mul(mossN).clamp(0, 1);
  albedo = mix(albedo, vec3(0.05, 0.1, 0.032), moss) as unknown as NV3;
  // rot darkening for heavily decayed wood
  albedo = albedo.mul(float(1).sub(d.z.mul(0.25))) as unknown as NV3;
  mat.colorNode = hueShift(albedo, d.x, 0.1);
  // logs lying across streams sit in the caustic band
  applyCaustics(mat);
  mat.normalNode = normalMap(vec3(b.x, b.y, 1));
  mat.aoNode = a.w;
  mat.roughnessNode = mix(b.z, float(1), moss);
  mat.metalness = 0;
  // same crossfade insurance as bark: a dither hole in a FrontSide closed
  // tube shows clean through (interior wall is a back face)
  mat.side = DoubleSide;
  return mat;
}

/**
 * Flower shading by vdata.x part id: 0 stem/leaf, 0.5 flower center, 1 petal.
 */
export function flowerMaterial(petal: {
  r: number;
  g: number;
  b: number;
}): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial();
  const d = vdata();
  const stem = vec3(0.045, 0.1, 0.03);
  const center = vec3(0.5, 0.32, 0.045);
  const petalC = vec3(petal.r, petal.g, petal.b);
  const centerK = smoothstep(0.12, 0.02, d.x.sub(0.5).abs());
  const petalK = smoothstep(0.85, 0.95, d.x);
  let albedo = mix(stem, center, centerK) as unknown as NV3;
  albedo = mix(albedo, petalC, petalK) as unknown as NV3;
  mat.colorNode = albedo.mul(d.w.mul(0.5).add(0.5));
  mat.roughness = 0.7;
  mat.metalness = 0;
  mat.side = DoubleSide;
  return mat;
}

/** mushroom shading by vdata.x part id: 0 stem, 0.5 gills, 1 cap */
export function mushroomMaterial(): MeshStandardNodeMaterial {
  const mat = new MeshStandardNodeMaterial();
  const d = vdata();
  const stem = vec3(0.32, 0.29, 0.24);
  const gills = vec3(0.42, 0.37, 0.28);
  const cap = vec3(0.23, 0.12, 0.05);
  const gillK = smoothstep(0.12, 0.02, d.x.sub(0.5).abs());
  const capK = smoothstep(0.85, 0.95, d.x);
  let albedo = mix(stem, gills, gillK) as unknown as NV3;
  albedo = mix(albedo, cap, capK) as unknown as NV3;
  mat.colorNode = albedo.mul(d.w);
  mat.roughness = 0.62;
  mat.metalness = 0;
  return mat;
}

export interface FoliageMatParams {
  color: { r: number; g: number; b: number; hueVar: number };
}

export function foliageMaterial(p: FoliageMatParams): MeshStandardNodeMaterial {
  // Physical variant for specularIntensity: white dielectric F0 0.04 at
  // glancing sun desaturates sunlit leaves to SILVER (user) — real leaves
  // read color-first; translucency + diffuse carry the lit look
  const mat = new MeshPhysicalNodeMaterial();
  mat.specularIntensity = 0.3;
  const d = vdata();
  const base = vec3(p.color.r, p.color.g, p.color.b);
  const tinted = hueShift(base, d.x, p.color.hueVar).mul(d.w.mul(0.8).add(0.2));
  // vertex-stage hoist: hue/age are flat per leaf, glow smooth at leaf scale
  mat.colorNode = varying(
    tinted as unknown as Parameters<typeof varying>[0],
  ) as unknown as typeof mat.colorNode;
  mat.emissiveNode = varying(
    translucency(tinted as unknown as NV3, 0.055) as unknown as Parameters<typeof varying>[0],
  ) as unknown as typeof mat.emissiveNode;
  // NO aoNode: vdata-derived values in lighting-context slots blow out to
  // beige on the instanced foliage materials (see foliageCardMaterial /
  // relief notes) — the interior read comes from the tinted-albedo d.w ramp.
  mat.roughness = 0.8; // real leaves keep a little sheen, far less than default
  mat.metalness = 0;
  mat.side = DoubleSide;
  // hero crowns receive card-level casters (ring-0 real geometry), so the
  // blob-occlusion error is smaller — modest relief only
  foliageSunShadowRelief(mat, 0.45);
  return mat;
}

/** captured cluster-card material: sqrt-decoded atlas albedo, alpha-tested */
export function foliageCardMaterial(
  atlas: Texture,
  p: FoliageMatParams,
): MeshStandardNodeMaterial {
  // see foliageMaterial: cards are worse — ONE flat normal per card means
  // the sheen paints whole cards silver coherently. Near-diffuse.
  const mat = new MeshPhysicalNodeMaterial();
  mat.specularIntensity = 0.18;
  const d = vdata();
  const t = texture(atlas, uv() as never) as unknown as NV4;
  const albedo = t.rgb.mul(t.rgb); // sqrt-encoded at capture
  // interior/far handling (r4): every crown-depth term below fades out by
  // ~420 m — R2 crowns are a few dozen px there and the impostor band they
  // hand off to (460 m) has no vdata, so the far aggregate value must stay
  // the r3-verified one. Near, the terms are what make a crown read as a
  // volume instead of a card pile.
  const camDistV = varying(
    positionWorld.sub(cameraPosition).length() as unknown as Parameters<typeof varying>[0],
  ) as unknown as NF;
  const farK = smoothstep(220, 420, camDistV);
  // vertex-stage hoist (Phase 7 perf): hueShift is LINEAR in its base color
  // (per-channel factor) and vdata is flat per card — fold hue + age into
  // one varying factor and multiply the atlas read by it per fragment.
  // Translucency glow likewise (view/sun terms are smooth at card scale).
  // r4 deepens the crown-core value ramp (vdata.w) on top of the existing
  // age term: core cards drop to ~0.3× shell instead of 0.59× — the WHOLE
  // interior-occlusion term (no aoNode half, see the note below).
  const deepen = varying(
    smoothstep(0.35, 0.95, d.w).mul(0.5).add(0.5) as unknown as Parameters<typeof varying>[0],
  ) as unknown as NF;
  const tintF = varying(
    hueShift(vec3(1, 1, 1), d.x, p.color.hueVar * 0.8).mul(
      d.w.mul(0.75).add(0.25),
    ) as unknown as Parameters<typeof varying>[0],
  ) as unknown as NV3;
  mat.colorNode = albedo.mul(tintF).mul(mix(deepen, float(1), farK));
  // NO aoNode here: on these instanced card materials ANY vdata-derived
  // value in a lighting-context slot (aoNode, or a receivedShadowNode gate)
  // resolves to garbage and blows the ambient term out to warm beige —
  // verified by bisection, shots/wip/ga3/work-veg4/ab-*.png. The interior
  // occlusion therefore lives entirely in the colorNode `deepen` term above
  // (colorNode chains with the same varyings are proven safe).
  // edge-thinness gate on the transmission (r4): alpha near the cutout edge
  // = optically thin foliage — those fragments carry ~3× the old glow while
  // solid card centers keep ~the old level (0.13×0.55 ≈ 0.07 ≈ old 0.06),
  // so backlit crowns read as glowing RIMS, not uniformly emissive blobs.
  const thin = float(1).sub(smoothstep(0.4, 0.85, t.w));
  mat.emissiveNode = albedo
    .mul(
      varying(
        translucency(tintF, 0.13) as unknown as Parameters<typeof varying>[0],
      ) as unknown as NV3,
    )
    .mul(thin.mul(0.9).add(0.55));
  // edge-on fade: a card whose plane is parallel to the view ray shows as a
  // bare dark sheet at close range (DELTA #5 — they read as floating slabs).
  // Fade those out within ~70 m; cross-plane cards keep crown coverage via
  // their perpendicular plane, and beyond 70 m a card is a few px anyway.
  // (flat card normal + ≤2 m extent → vertex eval is identical)
  const viewDir = cameraPosition.sub(positionWorld).normalize();
  const ndv = normalWorld.normalize().dot(viewDir).abs();
  const camDist = positionWorld.sub(cameraPosition).length();
  const edgeFade = varying(
    mix(
      smoothstep(0.06, 0.2, ndv),
      float(1),
      smoothstep(35, 70, camDist),
    ) as unknown as Parameters<typeof varying>[0],
  ) as unknown as NF;
  mat.opacityNode = t.w.mul(edgeFade);
  mat.alphaTest = 0.32;
  // near-diffuse: one flat normal per card means any real specular paints
  // the WHOLE card with a uniform silver sheen at glancing sun angles —
  // big cards then read as slate slabs (user: "sun lights some leaves up")
  mat.roughness = 0.92;
  mat.metalness = 0;
  mat.side = DoubleSide;
  // R1/R2 crowns are shadowed almost entirely by the solid crown proxies —
  // full-strength sun-shell relief or they flatten to one dark green.
  // (Interior occlusion lives in the `deepen` term above — gating the
  // shadow lift itself by a shellness varying broke in the lighting context,
  // see the relief derivation.)
  foliageSunShadowRelief(mat, 0.75);
  return mat;
}
