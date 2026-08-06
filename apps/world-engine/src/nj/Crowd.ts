/**
 * Crowd — GPU-driven LOD rendering of the great multitude (M3.6 attack plan
 * step 1; ADR 0019). The vegetation idiom applied to a STATIC transform set:
 *
 *   per frame: clear counters → cull every figure (frustum sphere test +
 *   distance-ring classify with dither-band overlap) → atomic append of the
 *   figure slot into per-(variant, ring) compact regions → write indirect
 *   instance counts. Transforms and counts never touch the CPU.
 *
 * Rings (dithered complementary crossfades, the VegInstance contract):
 *   R0 ≤ 35 m   full generator mesh (~3k tris) — the tier the gated
 *               photoreal decision will upgrade or replace
 *   R1 ≤ 160 m  reduced generator mesh (~600 tris), same identity
 *   beyond      hemi-octahedral atlas impostors (2 tris), relit via the
 *               captured normals — ImpostorRuntime unchanged
 *
 * Placements come verbatim from populationModel.multitudePlacements() — the
 * probe-tested floors/clearances carry over. Per-figure identity (variant,
 * skin, hair, warmth, width) comes from figureModel.figureParams(); the
 * material selects albedo/roughness/emissive per geometry region so one draw
 * covers a whole figure.
 *
 * Deliberate simplifications vs the Forests caster rig (recorded in
 * STATUS.md): crowd casters reuse the MAIN-view compact lists (castShadow on
 * the visible draws) instead of per-cascade caster regions — a hidden
 * figure's shadow is ~2 m long, not a 40 m tree crown — and the cull skips
 * the terrain-occlusion march (the city, not the heightfield, is the
 * occluder here; the impostor ring keeps the cost of overdraw trivial).
 *
 * Bloom contract: every emissive stays under the 1.5 threshold —
 * figureModel.CROWD_EMISSIVE, probe-asserted.
 */

import {
  ClampToEdgeWrapping,
  Frustum,
  Group,
  Matrix4,
  Mesh,
  SRGBColorSpace,
  Texture,
  Vector3,
  Vector4,
} from 'three';
import type { PerspectiveCamera } from 'three';
import {
  IndirectStorageBufferAttribute,
  IrradianceNode,
  MeshStandardNodeMaterial,
  StorageBufferAttribute,
  type Renderer,
  type StorageBufferNode,
} from 'three/webgpu';
import {
  Fn,
  If,
  Return,
  atomicAdd,
  atomicLoad,
  atomicStore,
  attribute,
  bool,
  float,
  instanceIndex,
  instancedArray,
  int,
  mix,
  normalLocal,
  normalWorld,
  positionLocal,
  positionWorld,
  storage,
  texture,
  time,
  uint,
  uniform,
  uniformArray,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { NB, NF, NI, NU, NV3, NV4 } from '../gpu/TSLTypes';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import { runiform } from '../gpu/RenderUniform';
import { impostorQuad, impostorRuntimeMaterial } from '../render/ImpostorRuntime';
import {
  applyDitherFade,
  slotHash,
  updateVegViewPos,
  vegViewPos,
  type RingFade,
} from '../render/VegInstance';
import { captureImpostor } from '../vegetation/Impostors';
import {
  CROWD_EMISSIVE,
  CROWD_LOD,
  EYE_ALBEDO,
  FIGURE_ARCHETYPES,
  HAIR_GRAY,
  HAIR_RAMP,
  SKIN_RAMP,
  figureParams,
  type FigureArchetype,
} from './figureModel';
import { bakeRegionColors, buildFigureGeometry } from './FigureMesh';
import { FIGURES_VENDORED } from './figuresVendored.gen';
import { SWAY, multitudePlacements } from './populationModel';
import { NJ_SCALE } from './rimModel';

const V = FIGURE_ARCHETYPES.length;
/** groups: 2v = variant v ring 0, 2v+1 = ring 1, 2V = impostor ring */
const GROUPS = 2 * V + 1;

export interface CrowdBuild {
  group: Group;
  /** per-frame compute: frustum uniforms + cull + indirect */
  update(renderer: Renderer, camera: PerspectiveCamera): void;
  /** HUD stats (throttled async readback) */
  counterSnapshot(): Record<string, number>;
}

/** figure idle sway — the settled reverent-motion idiom (populationModel
 *  SWAY, probe A7): shader-time lateral offset, per-slot hash phase/amp */
function figureSway(slot: NU): NF {
  const phase = slotHash(slot, 41).mul(Math.PI * 2) as unknown as NF;
  const amp = slotHash(slot, 43).mul(SWAY.ampRange).add(SWAY.ampMin) as unknown as NF;
  return time.mul(SWAY.speed).add(phase).sin().mul(amp) as unknown as NF;
}

/** Probe-GI opt-in — the CityMassing/Population fragment-stage idiom. */
function patchGI(mat: MeshStandardNodeMaterial, gi: ProbeGI | null): void {
  if (!gi) return;
  const irr = gi.irradiance(positionWorld as unknown as NV3, normalWorld as unknown as NV3);
  (mat as unknown as { setupLightMap: () => unknown }).setupLightMap = () =>
    new IrradianceNode(irr as unknown as ConstructorParameters<typeof IrradianceNode>[0]);
}

/** shared-table palette ramp lerp (figureModel stops), shader side */
function ramp3(
  stops: readonly (readonly [number, number, number])[],
  t: NF,
): NV3 {
  const s = (i: number): NV3 => vec3(stops[i][0], stops[i][1], stops[i][2]) as unknown as NV3;
  const x = t.mul(stops.length - 1) as unknown as NF;
  let acc = s(0);
  for (let i = 1; i < stops.length; i++) {
    acc = mix(acc, s(i), x.sub(i - 1).clamp(0, 1)) as unknown as NV3;
  }
  return acc;
}

/** region select chain: robe / skin / hair / frond / eye (ADR 0020 heads) */
function byRegion<T extends NF | NV3>(
  region: NF,
  robe: T,
  skin: T,
  hair: T,
  frond: T,
  eye: T,
): T {
  return region
    .lessThan(0.5)
    .select(
      robe,
      region
        .lessThan(1.5)
        .select(
          skin,
          region.lessThan(2.5).select(hair, region.lessThan(3.5).select(frond, eye)),
        ),
    ) as T;
}

interface FigureBind {
  bufA: StorageBufferNode<'vec4'>;
  bufB: StorageBufferNode<'vec4'>;
  bufC: StorageBufferNode<'vec4'>;
  compact: StorageBufferNode<'uint'>;
  groupBase: number;
}

/** the decoded ADR 0020 skin atlas + its per-tile normalization means */
interface SkinAtlasTex {
  tex: Texture;
  /** LINEAR mean rgb per tile, dark -> pale (tileMeansLinear) */
  means: Vector3[];
  tiles: number;
}

/**
 * Decode the vendored 2x2 skin-diffuse atlas (base64 JPEG) into a sampler
 * texture. Browser-only (createImageBitmap); the CPU probes never build
 * materials, so node imports of this module stay decode-free.
 */
async function skinAtlasTexture(): Promise<SkinAtlasTex | null> {
  const sa = FIGURES_VENDORED.skinAtlas;
  if (!sa || typeof createImageBitmap === 'undefined') return null;
  const b = atob(sa.jpegB64);
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
  const tex = new Texture(bitmap);
  // vendored UVs are OBJ-convention (v = 0 at the bottom) — three's flipY
  // default matches; clamp because the atlas tiles must never bleed across
  tex.flipY = true;
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return {
    tex,
    means: sa.tileMeansLinear.map((m) => new Vector3(m[0], m[1], m[2])),
    tiles: sa.tiles,
  };
}

/**
 * One material renders one archetype's whole figure at one ring: compacted
 * indirect instancing (yaw + width + posture lean + idle sway) and
 * per-region identity coloring from the bufC parameters.
 */
function figureMaterial(
  bind: FigureBind,
  arch: FigureArchetype,
  fade: RingFade,
  gi: ProbeGI | null,
  skinAtlas: SkinAtlasTex | null,
): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.metalness = 0;

  const base = runiform(uint(bind.groupBase));
  const slot = bind.compact.element(instanceIndex.add(base as unknown as NU)) as unknown as NU;
  const A = bind.bufA.element(slot) as unknown as NV4;
  const B = bind.bufB.element(slot) as unknown as NV4;
  const C = bind.bufC.element(slot) as unknown as NV4;

  const region = attribute('aregion', 'float') as unknown as NF;

  // ---- instance transform: scale (uniform + lateral width), yaw, lean ------
  const c = B.x.cos();
  const s = B.x.sin();
  const lw = A.w.mul(C.w);
  // idle sway in LOCAL x (rotates per-figure), feet anchored; the raised
  // frond adds its own gentle flex toward the tip
  const hFac = positionLocal.y.div(arch.height).clamp(0, 1) as unknown as NF;
  const frondFac = positionLocal.y
    .sub(arch.height * 0.85)
    .div(arch.height * 0.5)
    .clamp(0, 1)
    .mul(region.greaterThan(2.5).select(float(1), float(0))) as unknown as NF;
  const flutterPhase = slotHash(slot, 47).mul(Math.PI * 2) as unknown as NF;
  const flutter = time
    .mul(SWAY.speed * SWAY.palmSpeedFactor)
    .add(flutterPhase)
    .sin()
    .mul(SWAY.palmTip)
    .mul(frondFac) as unknown as NF;
  const lx = positionLocal.x.mul(lw).add(figureSway(slot).mul(hFac)).add(flutter);
  const ly = positionLocal.y.mul(A.w);
  const lz = positionLocal.z.mul(lw);
  const rx = lx.mul(c).add(lz.mul(s));
  const rz = lz.mul(c).sub(lx.mul(s));
  // posture lean as shear (keeps feet planted) — placement tilts, damped
  const px = rx.add(B.y.mul(ly));
  const pz = rz.add(B.z.mul(ly));
  const wpos = vec3(px, ly, pz).add(A.xyz);
  const dist = A.xyz.sub(vegViewPos as unknown as NV3).length() as unknown as NF;

  // normals rotate with the yaw (the instanceVeg mechanism)
  m.positionNode = Fn(() => {
    const n = vec3(
      normalLocal.x.mul(c).add(normalLocal.z.mul(s)),
      normalLocal.y,
      normalLocal.z.mul(c).sub(normalLocal.x.mul(s)),
    ).toVar();
    normalLocal.assign(n);
    return wpos;
  })();
  // main draws are the casters (no per-cascade siblings — header note)
  (m as unknown as { castShadowPositionNode: unknown }).castShadowPositionNode = wpos;

  // ---- per-region identity ---------------------------------------------------
  const warm = C.z.mul(0.4) as unknown as NF;
  const robe = vec3(1.0, warm.mul(-0.06).add(1.0), warm.mul(-0.16).add(1.0)) as unknown as NV3;
  const skinRamp = ramp3(SKIN_RAMP, C.x as unknown as NF);
  let skin = skinRamp;
  if (skinAtlas) {
    // ADR 0020 slice 2: vendored parts carry real hm08 UVs; skin01 keys
    // the atlas tile (dark -> pale, matching the ramp direction) and the
    // texel is normalized by the tile's linear mean, so SKIN_RAMP keeps
    // owning each figure's AVERAGE tone — tile switches never pop, and the
    // sentinel-UV procedural skin (neck, LOD1) matches by construction.
    const auv = attribute('auv', 'vec2') as unknown as NV3;
    const tile = C.x.mul(skinAtlas.tiles).floor().clamp(0, skinAtlas.tiles - 1) as unknown as NF;
    const tileUv = vec2(
      auv.x.mul(0.5).add(tile.mod(2).mul(0.5)),
      auv.y.mul(0.5).add(tile.div(2).floor().mul(0.5)),
    );
    const texel = texture(skinAtlas.tex, tileUv as unknown as NV3).rgb as unknown as NV3;
    const meansU = uniformArray(skinAtlas.means);
    const mean = meansU.element(tile.toInt()) as unknown as NV3;
    const textured = texel.mul(skinRamp.div(mean.max(vec3(1e-3)) as unknown as NV3).clamp(0, 4)) as unknown as NV3;
    skin = auv.x.greaterThanEqual(0).select(textured, skinRamp) as unknown as NV3;
  }
  const grayK = float(arch.grayBias).mul(
    slotHash(slot, 53).mul(0.6).add(0.4),
  ) as unknown as NF;
  const hair = mix(
    ramp3(HAIR_RAMP, C.y as unknown as NF),
    vec3(HAIR_GRAY[0], HAIR_GRAY[1], HAIR_GRAY[2]),
    grayK,
  ) as unknown as NV3;
  const frondJit = slotHash(slot, 13).mul(0.25).add(0.85) as unknown as NF;
  const frond = vec3(0.31, 0.604, 0.235).mul(frondJit) as unknown as NV3;
  const eye = vec3(EYE_ALBEDO[0], EYE_ALBEDO[1], EYE_ALBEDO[2]) as unknown as NV3;
  const albedo = byRegion<NV3>(region, robe, skin, hair, frond, eye);

  m.roughnessNode = byRegion<NF>(
    region,
    float(0.62) as unknown as NF,
    float(0.48) as unknown as NF,
    float(0.6) as unknown as NF,
    float(0.55) as unknown as NF,
    float(0.28) as unknown as NF, // eyes read wet
  );
  // faint per-region self-light (Pillar B — no black peppering at range);
  // every constant under the 1.5 bloom line, probe-asserted
  const eK = byRegion<NF>(
    region,
    float(CROWD_EMISSIVE.robe) as unknown as NF,
    float(CROWD_EMISSIVE.skin) as unknown as NF,
    float(CROWD_EMISSIVE.hair) as unknown as NF,
    float(CROWD_EMISSIVE.frond) as unknown as NF,
    float(CROWD_EMISSIVE.eye) as unknown as NF,
  );
  m.emissiveNode = albedo.mul(eK) as unknown as NV3;

  applyDitherFade(m, dist, fade);
  // caster contract (the instanceVeg rules): pin alpha 1 so the shadow pass
  // never mis-derives alpha from a vec3 colorNode, and keep caster density
  // FULL through LOD bands (the union of both rings)
  m.colorNode = vec4(albedo, 1) as unknown as NV4;
  (m as unknown as { maskShadowNode: unknown }).maskShadowNode = bool(true) as unknown as NB;

  patchGI(m, gi);
  return m;
}

export async function buildCrowd(opts: {
  gi: ProbeGI | null;
  plazaTopY: number;
  renderer: Renderer;
}): Promise<CrowdBuild> {
  const { gi, plazaTopY, renderer } = opts;
  const S = NJ_SCALE;
  const group = new Group();
  group.name = 'multitude';

  // the ADR 0020 slice-2 skin atlas — one texture shared by every ring
  // material (one material per LOD tier; variety rides per-instance params)
  const skinAtlas = await skinAtlasTexture();

  // ---- instance data (CPU once — the transform set is static) ---------------
  const placements = multitudePlacements();
  const N = placements.length;
  const dataA = new Float32Array(N * 4);
  const dataB = new Float32Array(N * 4);
  const dataC = new Float32Array(N * 4);
  placements.forEach((p, i) => {
    const wx = p.x * S;
    const wz = p.z * S;
    const f = figureParams(i);
    dataA[i * 4] = wx;
    dataA[i * 4 + 1] = plazaTopY + p.y * S;
    dataA[i * 4 + 2] = wz;
    dataA[i * 4 + 3] = p.s;
    // face the summit light (ADR 0010 working pattern, unchanged)
    dataB[i * 4] = Math.atan2(-wx, -wz);
    // the placement tilts, damped to a subtle posture lean (shear)
    dataB[i * 4 + 1] = p.tiltX * 0.25;
    dataB[i * 4 + 2] = p.tiltZ * 0.25;
    dataB[i * 4 + 3] = f.variant;
    dataC[i * 4] = f.skin01;
    dataC[i * 4 + 1] = f.hair01;
    dataC[i * 4 + 2] = f.warm01;
    dataC[i * 4 + 3] = f.widthJ;
  });
  const bufA = storage(new StorageBufferAttribute(dataA, 4), 'vec4', N);
  const bufB = storage(new StorageBufferAttribute(dataB, 4), 'vec4', N);
  const bufC = storage(new StorageBufferAttribute(dataC, 4), 'vec4', N);

  // ---- geometry pools + per-variant bounding info ----------------------------
  const lod0: import('three').BufferGeometry[] = [];
  const lod1: import('three').BufferGeometry[] = [];
  // (boundCy, boundR) per variant, scale-1 metres — from the REAL geometry
  const vInfo = new Float32Array(V * 2);
  for (let v = 0; v < V; v++) {
    const g0 = buildFigureGeometry(FIGURE_ARCHETYPES[v], 0);
    const g1 = buildFigureGeometry(FIGURE_ARCHETYPES[v], 1);
    lod0.push(g0);
    lod1.push(g1);
    g0.computeBoundingBox();
    const bb = g0.boundingBox;
    if (bb) {
      const cy = (bb.min.y + bb.max.y) / 2;
      const dx = Math.max(Math.abs(bb.min.x), bb.max.x);
      const dz = Math.max(Math.abs(bb.min.z), bb.max.z);
      const dy = (bb.max.y - bb.min.y) / 2;
      vInfo[v * 2] = cy;
      // widthJ tops out at 1.08 — folded into the sphere margin
      vInfo[v * 2 + 1] = Math.hypot(Math.max(dx, dz) * 1.08, dy);
    }
  }
  const vBuf = storage(new StorageBufferAttribute(vInfo, 2), 'vec2', V);

  // ---- compact regions / counters -------------------------------------------
  const offsets = new Uint32Array(GROUPS);
  const caps = new Uint32Array(GROUPS);
  let off = 0;
  for (let g = 0; g < GROUPS; g++) {
    caps[g] = g === 2 * V ? CROWD_LOD.capImp : g % 2 === 0 ? CROWD_LOD.capR0 : CROWD_LOD.capR1;
    offsets[g] = off;
    off += caps[g];
  }
  const compact = instancedArray(off, 'uint');
  const counters = instancedArray(GROUPS, 'uint').toAtomic();
  const offBuf = storage(new StorageBufferAttribute(offsets.slice(), 1), 'uint', GROUPS);
  const capBuf = storage(new StorageBufferAttribute(caps.slice(), 1), 'uint', GROUPS);

  // ---- draws ------------------------------------------------------------------
  const fadeR0: RingFade = { fadeOutAt: CROWD_LOD.r0Far, band: CROWD_LOD.band0 };
  const fadeR1: RingFade = {
    fadeInAt: CROWD_LOD.r0Far,
    inBand: CROWD_LOD.band0,
    fadeOutAt: CROWD_LOD.r1Far,
    band: CROWD_LOD.band1,
  };
  const fadeImp: RingFade = { fadeInAt: CROWD_LOD.r1Far, band: CROWD_LOD.band1 };

  interface DrawSpec {
    group: number;
    indexCount: number;
  }
  const draws: DrawSpec[] = [];
  const meshes: Mesh[] = [];
  const groupTris = new Float32Array(GROUPS);
  const addDraw = (
    geo: import('three').BufferGeometry,
    mat: MeshStandardNodeMaterial,
    g: number,
    casts: boolean,
  ): void => {
    const indexCount = geo.index ? geo.index.count : geo.attributes.position?.count ?? 0;
    draws.push({ group: g, indexCount });
    groupTris[g] += indexCount / 3;
    const mesh = new Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.castShadow = casts;
    mesh.receiveShadow = true;
    meshes.push(mesh);
    group.add(mesh);
  };

  for (let v = 0; v < V; v++) {
    const arch = FIGURE_ARCHETYPES[v];
    addDraw(
      lod0[v],
      figureMaterial(
        { bufA, bufB, bufC, compact, groupBase: offsets[2 * v] },
        arch,
        fadeR0,
        gi,
        skinAtlas,
      ),
      2 * v,
      true,
    );
    addDraw(
      lod1[v],
      figureMaterial(
        { bufA, bufB, bufC, compact, groupBase: offsets[2 * v + 1] },
        arch,
        fadeR1,
        gi,
        skinAtlas,
      ),
      2 * v + 1,
      true,
    );
  }

  // far ring: ONE representative captured atlas — beyond 160 m identity
  // rides on scale/yaw/tint alone, so a single hemi-oct capture (adult-tall,
  // mid palette) carries the whole ring. 128 px tiles: a figure subtends a
  // handful of pixels out there; the veg default 256 would waste 24 MB.
  const capGeo = buildFigureGeometry(FIGURE_ARCHETYPES[0], 0);
  bakeRegionColors(capGeo);
  capGeo.computeBoundingBox();
  const cbb = capGeo.boundingBox;
  const capCy = cbb ? (cbb.min.y + cbb.max.y) / 2 : FIGURE_ARCHETYPES[0].height / 2;
  const capR = cbb
    ? Math.hypot(
        Math.max(Math.abs(cbb.min.x), cbb.max.x, Math.abs(cbb.min.z), cbb.max.z),
        (cbb.max.y - cbb.min.y) / 2,
      )
    : FIGURE_ARCHETYPES[0].height * 0.62;
  const atlas = await captureImpostor(
    renderer,
    [{ geometry: capGeo, kind: 'mesh', vertexColor: true }],
    { centerY: capCy, radius: capR },
    { tile: 128 },
  );
  const impMat = impostorRuntimeMaterial(atlas, {
    bufA,
    bufB,
    compact,
    groupBase: offsets[2 * V],
    fade: fadeImp,
    tint: 0.1,
  });
  patchGI(impMat, gi);
  addDraw(impostorQuad(), impMat, 2 * V, false);

  // ---- indirect buffer ---------------------------------------------------------
  const D = draws.length;
  const indirectData = new Uint32Array(D * 5);
  const drawGroups = new Uint32Array(D);
  for (let d = 0; d < D; d++) {
    indirectData[d * 5] = draws[d].indexCount;
    drawGroups[d] = draws[d].group;
  }
  const indirectAttr = new IndirectStorageBufferAttribute(indirectData, 5);
  for (let d = 0; d < D; d++) {
    meshes[d].geometry.setIndirect(indirectAttr, d * 20);
  }
  const indirectStore = storage(indirectAttr, 'uint', D * 5);
  const drawGroupBuf = storage(new StorageBufferAttribute(drawGroups, 1), 'uint', D);

  // ---- kernels -------------------------------------------------------------------
  const camU = uniform(new Vector3());
  const planesU = uniformArray(Array.from({ length: 6 }, () => new Vector4()));

  const clearK = Fn(() => {
    const i = instanceIndex;
    If(i.greaterThanEqual(GROUPS), () => {
      Return();
    });
    atomicStore(counters.element(i), uint(0));
  })().compute(GROUPS);
  clearK.setName('crowdClear');

  const inFrustum = (center: NV3, rad: NF): NF => {
    let inside: NF = float(1);
    for (let p = 0; p < 6; p++) {
      const pl = planesU.element(int(p)) as unknown as NV4;
      const d = pl.xyz.dot(center).add(pl.w);
      inside = inside.mul(d.greaterThan(rad.negate()).select(float(1), float(0)));
    }
    return inside;
  };

  const appendTo = (g: NI | NU, slot: NU): void => {
    const idx = atomicAdd(counters.element(g), uint(1)) as unknown as NU;
    If(idx.lessThan(capBuf.element(g) as unknown as NU), () => {
      compact.element((offBuf.element(g) as unknown as NU).add(idx)).assign(slot);
    });
  };

  const R0 = CROWD_LOD.r0Far;
  const B0 = CROWD_LOD.band0;
  const R1 = CROWD_LOD.r1Far;
  const B1 = CROWD_LOD.band1;
  const cullK = Fn(() => {
    const i = instanceIndex;
    If(i.greaterThanEqual(uint(Math.max(N, 1))), () => {
      Return();
    });
    const A = bufA.element(i) as unknown as NV4;
    const B = bufB.element(i) as unknown as NV4;
    const vb = vBuf.element(B.w.toInt()) as unknown as NV4;
    const s = A.w;
    const center = A.xyz.add(vec3(0, 1, 0).mul(vb.x.mul(s)));
    const rad = vb.y.mul(s);
    const dist = A.xyz.sub(camU).length();
    If(inFrustum(center, rad).lessThan(0.5), () => {
      Return();
    });
    const v2 = B.w.toInt().mul(2);
    If(dist.lessThan(R0 + B0), () => {
      appendTo(v2 as unknown as NI, i as unknown as NU);
    });
    If(dist.greaterThanEqual(R0 - B0).and(dist.lessThan(R1 + B1)), () => {
      appendTo(v2.add(1) as unknown as NI, i as unknown as NU);
    });
    If(dist.greaterThanEqual(R1 - B1), () => {
      appendTo(int(2 * V) as unknown as NI, i as unknown as NU);
    });
  })().compute(Math.max(N, 1));
  cullK.setName('crowdCull');

  const indirectK = Fn(() => {
    const i = instanceIndex;
    If(i.greaterThanEqual(D), () => {
      Return();
    });
    const g = drawGroupBuf.element(i) as unknown as NU;
    const raw = atomicLoad(counters.element(g)) as unknown as NU;
    const cap = capBuf.element(g) as unknown as NU;
    const n = raw.greaterThan(cap).select(cap, raw);
    indirectStore.element(i.mul(5).add(1)).assign(n);
  })().compute(D);
  indirectK.setName('crowdIndirect');

  const kernels = [clearK, cullK, indirectK];

  // ---- per-frame update + HUD -------------------------------------------------
  const frustum = new Frustum();
  const projView = new Matrix4();
  let frame = 0;
  let reading = false;
  let hud: Record<string, number> = {};

  const readStats = async (r: Renderer): Promise<void> => {
    try {
      const attr = (counters as unknown as { value: unknown }).value;
      const ab = await r.getArrayBufferAsync(
        attr as Parameters<Renderer['getArrayBufferAsync']>[0],
      );
      const counts = new Uint32Array(ab);
      let r0 = 0;
      let r1 = 0;
      let imp = 0;
      let tris = 0;
      for (let g = 0; g < GROUPS; g++) {
        const n = Math.min(counts[g] ?? 0, caps[g] ?? 0);
        tris += n * (groupTris[g] ?? 0);
        if (g === 2 * V) imp += n;
        else if (g % 2 === 0) r0 += n;
        else r1 += n;
      }
      hud = {
        'crowd.r0': r0,
        'crowd.r1': r1,
        'crowd.imp': imp,
        'crowd.tris': Math.round(tris),
      };
    } finally {
      reading = false;
    }
  };

  return {
    group,
    update(r: Renderer, camera: PerspectiveCamera): void {
      camU.value.copy(camera.position);
      updateVegViewPos(camera);
      projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projView);
      const arr = planesU.array as Vector4[];
      for (let p = 0; p < 6; p++) {
        const pl = frustum.planes[p];
        if (!pl) continue;
        arr[p].set(pl.normal.x, pl.normal.y, pl.normal.z, pl.constant);
      }
      for (const k of kernels) {
        r.compute(k as Parameters<Renderer['compute']>[0]);
      }
      frame++;
      // first readback early so tooling stills (settle ~20-35 frames) carry
      // crowd counters; then the Forests throttle cadence
      if ((frame === 24 || frame % 90 === 0) && !reading) {
        reading = true;
        void readStats(r);
      }
    },
    counterSnapshot(): Record<string, number> {
      return hud;
    },
  };
}
