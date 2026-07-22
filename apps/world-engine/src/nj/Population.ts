/**
 * The inhabitants of the city — the great multitude and the angelic hosts
 * (roadmap M3.6, CITY-QUALITY-BAR population floor / delta #9).
 *
 * Policy block (ADR 0011 consequence — reference like Throne referenced 0010):
 *   - ADR 0011: figural NON-divine persons permitted, generic and reverent,
 *     never portraiture; every presence traces to a cited descriptor.
 *   - ADR 0010: the divine persons stay aniconic — figures FACE the summit
 *     light; the light never resolves into a figure. Untouched here.
 *   - RENDERING-DECISIONS #3 (the settled rendering this module implements):
 *     the multitude (Rev 7:9, `great-multitude`) as simplified white-robed
 *     luminous figures, NO facial or identity features, raised palm branches,
 *     subtle scale/warm-tone variation implying "every nation", standing on
 *     the plaza and ascending terrace pavements facing the throne; the hosts
 *     (Rev 5:11, `myriads-of-angels`) as abstract vertical beings of light
 *     ringing the summit, NO wings or figural form, slowly rising and falling.
 *   - The four living creatures and the twenty-four elders are OMITTED per
 *     ADR 0011 rule 4 (symbolic-tier; no RENDERING-DECISIONS entry yet).
 *
 * Engine path: plain InstancedMesh — the sanctioned static-content path (the
 * CityMassing kit-bash idiom), NOT the vegetation scatter system. The whole
 * multitude is three draws (robe + head + palm share one transform set); the
 * hosts are two (core + halo share one set). The hosts' rise/fall is a
 * shader-time bob (positionNode + per-instance hash phase) — no CPU
 * per-instance updates (spec hard rule). Placements come exclusively from
 * populationModel.ts (CPU-pure, probe-tested); figures stand on the SAME
 * floors cityCollide.cityFloorLocalY exposes to the walker.
 *
 * Bloom contract: every emissive here stays under the 1.5 threshold — only
 * the crown + glory cross it (CityMassing). Constants live in
 * populationModel.ts so tools/probe-population.ts asserts them.
 */

import {
  CapsuleGeometry,
  ConeGeometry,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { IrradianceNode, MeshStandardNodeMaterial } from 'three/webgpu';
import { instanceIndex, normalWorld, positionLocal, positionWorld, time, vec3 } from 'three/tsl';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NF, NU, NV3 } from '../gpu/TSLTypes';
import { slotHash } from '../render/VegInstance';
import { NJ_SCALE } from './rimModel';
import {
  FIGURE,
  HEAD_EMISSIVE,
  HOST,
  HOST_CORE_EMISSIVE,
  HOST_HALO_EMISSIVE,
  PALM_EMISSIVE,
  ROBE_EMISSIVE,
  SWAY,
  hostPlacements,
  multitudePlacements,
} from './populationModel';

/**
 * Figure idle sway (M3.6 remainder) — the host-bob idiom at human scale:
 * shader-time lateral offset with per-instance hash phase/amplitude, no CPU
 * per-instance updates. Anchored at the feet; `heightFactor` (0..1 in local
 * geometry space) keeps soles planted while the crown breathes. Robes,
 * heads and palms share instance ordering, so the same hash slots yield the
 * SAME phase/amplitude per figure across all three meshes — the head rides
 * its robe's crown instead of detaching.
 */
function figureSway(): NF {
  const phase = slotHash(instanceIndex as unknown as NU, 41).mul(Math.PI * 2) as unknown as NF;
  const amp = slotHash(instanceIndex as unknown as NU, 43)
    .mul(SWAY.ampRange)
    .add(SWAY.ampMin) as unknown as NF;
  return time.mul(SWAY.speed).add(phase).sin().mul(amp) as unknown as NF;
}

/** Probe-GI opt-in — the CityMassing fragment-stage idiom. */
function patchGI(mat: MeshStandardNodeMaterial, gi: ProbeGI | null): void {
  if (!gi) return;
  const irr = gi.irradiance(positionWorld as unknown as NV3, normalWorld as unknown as NV3);
  (mat as unknown as { setupLightMap: () => unknown }).setupLightMap = () =>
    new IrradianceNode(irr as unknown as ConstructorParameters<typeof IrradianceNode>[0]);
}

/** White robe: warm-tone per-instance variation, faint self-light. */
function robeMaterial(gi: ProbeGI | null): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.metalness = 0;
  m.roughness = 0.62;
  const warm = slotHash(instanceIndex as unknown as NU, 31).mul(0.4) as unknown as NF;
  m.colorNode = vec3(
    1.0,
    warm.mul(-0.06).add(1.0),
    warm.mul(-0.16).add(1.0),
  ) as unknown as NV3;
  m.emissiveNode = vec3(1.0, 0.953, 0.886).mul(ROBE_EMISSIVE) as unknown as NV3;
  // idle sway, feet planted: offset scales with height up the robe
  const heightFactor = positionLocal.y.div(FIGURE.robeH).clamp(0, 1) as unknown as NF;
  m.positionNode = positionLocal.add(
    vec3(figureSway().mul(heightFactor), 0, 0),
  ) as unknown as NV3;
  patchGI(m, gi);
  return m;
}

/** Featureless head — tone varies with the same per-instance warm hash. */
function headMaterial(gi: ProbeGI | null): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.metalness = 0;
  m.roughness = 0.72;
  const tone = slotHash(instanceIndex as unknown as NU, 31)
    .mul(0.4)
    .mul(0.6)
    .add(0.5) as unknown as NF;
  const col = vec3(tone, tone.mul(0.85), tone.mul(0.74)) as unknown as NV3;
  m.colorNode = col;
  // tiny self-light so distant heads never pepper black (Pillar B)
  m.emissiveNode = col.mul(HEAD_EMISSIVE) as unknown as NV3;
  // the head rides the robe crown: full sway, same per-instance phase/amp
  m.positionNode = positionLocal.add(vec3(figureSway(), 0, 0)) as unknown as NV3;
  patchGI(m, gi);
  return m;
}

/** Raised palm branch (Rev 7:9) — thin green frond, per-instance value jitter. */
function palmMaterial(gi: ProbeGI | null): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.metalness = 0;
  m.roughness = 0.55;
  const jit = slotHash(instanceIndex as unknown as NU, 13).mul(0.25).add(0.85) as unknown as NF;
  m.colorNode = vec3(0.31, 0.604, 0.235).mul(jit) as unknown as NV3;
  m.emissiveNode = vec3(0.165, 0.29, 0.118).mul(PALM_EMISSIVE) as unknown as NV3;
  // the hand carries the body sway at grip height; the frond adds its own
  // gentle flex toward the tip (local y spans ±palmH/2 → tip factor 0..1)
  const handSway = figureSway().mul(0.62) as unknown as NF;
  const tipFactor = positionLocal.y.div(FIGURE.palmH).add(0.5).clamp(0, 1) as unknown as NF;
  const flexPhase = slotHash(instanceIndex as unknown as NU, 47).mul(Math.PI * 2) as unknown as NF;
  const flex = time
    .mul(SWAY.speed * SWAY.palmSpeedFactor)
    .add(flexPhase)
    .sin()
    .mul(SWAY.palmTip)
    .mul(tipFactor) as unknown as NF;
  m.positionNode = positionLocal.add(vec3(handSway.add(flex), 0, 0)) as unknown as NV3;
  patchGI(m, gi);
  return m;
}

/**
 * Host light-pillar material: pure warm emission (no lit response), soft
 * alpha, and the slow shader-time rise/fall. Same node graph for core and
 * halo (pipelines shared); intensity/opacity differ per layer.
 */
function hostMaterial(layer: 'core' | 'halo'): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.metalness = 0;
  m.roughness = 1;
  m.color.set(0x000000);
  m.transparent = true;
  m.depthWrite = false;
  m.opacity = layer === 'core' ? 0.65 : 0.2;
  const k = layer === 'core' ? HOST_CORE_EMISSIVE : HOST_HALO_EMISSIVE;
  m.emissiveNode = vec3(1.0, 0.93, 0.78).mul(k) as unknown as NV3;
  const phase = slotHash(instanceIndex as unknown as NU, 17).mul(Math.PI * 2) as unknown as NF;
  const amp = slotHash(instanceIndex as unknown as NU, 23)
    .mul(HOST.bobAmpRange)
    .add(HOST.bobAmpMin) as unknown as NF;
  const bob = time.mul(HOST.bobSpeed).add(phase).sin().mul(amp) as unknown as NF;
  m.positionNode = positionLocal.add(vec3(0, bob, 0)) as unknown as NV3;
  return m;
}

/**
 * Build the population in WORLD space (human-scale content, the TreesOfLife
 * convention — never under the ×NJ_SCALE allotment group). `plazaTopY` is
 * the city group's world Y (local y 0).
 */
export function buildPopulation(opts: { gi: ProbeGI | null; plazaTopY: number }): Group {
  const { gi, plazaTopY } = opts;
  const S = NJ_SCALE;
  const group = new Group();
  group.name = 'population';

  // ---- the great multitude (Rev 7:9) ---------------------------------------
  const placements = multitudePlacements();
  const n = placements.length;
  const robeGeo = new ConeGeometry(FIGURE.robeR, FIGURE.robeH, 8);
  robeGeo.translate(0, FIGURE.robeH / 2, 0); // origin at the feet
  const headGeo = new SphereGeometry(FIGURE.headR, 6, 4);
  const palmGeo = new ConeGeometry(FIGURE.palmR, FIGURE.palmH, 5);
  const robes = new InstancedMesh(robeGeo, robeMaterial(gi), n);
  const heads = new InstancedMesh(headGeo, headMaterial(gi), n);
  const palms = new InstancedMesh(palmGeo, palmMaterial(gi), n);
  robes.name = 'multitude-robes';
  heads.name = 'multitude-heads';
  palms.name = 'multitude-palms';

  const m4 = new Matrix4();
  const pos = new Vector3();
  const quat = new Quaternion();
  const palmQuat = new Quaternion();
  const eul = new Euler();
  const scl = new Vector3();
  const up = new Vector3(0, 1, 0);
  placements.forEach((p, i) => {
    const wx = p.x * S;
    const wz = p.z * S;
    const wy = plazaTopY + p.y * S;
    const s = p.s;
    // face the summit light (the city axis) — ADR 0010 working pattern
    const yaw = Math.atan2(-wx, -wz);
    quat.setFromAxisAngle(up, yaw);
    scl.set(s, s, s);

    pos.set(wx, wy, wz);
    m4.compose(pos, quat, scl);
    robes.setMatrixAt(i, m4);

    pos.set(wx, wy + FIGURE.robeH * s + FIGURE.headR * s * 0.3, wz);
    m4.compose(pos, quat, scl);
    heads.setMatrixAt(i, m4);

    // raised palm, offset to the throne-facing side, slightly varied tilt
    const len = Math.hypot(wx, wz) || 1;
    const ox = (-wx / len) * 0.3 * s;
    const oz = (-wz / len) * 0.3 * s;
    pos.set(wx + ox, wy + FIGURE.robeH * s * 0.62 + (FIGURE.palmH * s) / 2, wz + oz);
    eul.set(p.tiltX, yaw, p.tiltZ);
    palmQuat.setFromEuler(eul);
    m4.compose(pos, palmQuat, scl);
    palms.setMatrixAt(i, m4);
  });
  robes.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  palms.instanceMatrix.needsUpdate = true;
  robes.castShadow = true;
  robes.receiveShadow = true;
  heads.receiveShadow = true;
  palms.receiveShadow = true;
  group.add(robes, heads, palms);

  // ---- the angelic hosts (Rev 5:11) -----------------------------------------
  const hosts = hostPlacements();
  const coreGeo = new CapsuleGeometry(HOST.coreR, HOST.coreLen, 6, 12);
  const haloGeo = new CapsuleGeometry(HOST.haloR, HOST.haloLen, 6, 12);
  const core = new InstancedMesh(coreGeo, hostMaterial('core'), hosts.length);
  const halo = new InstancedMesh(haloGeo, hostMaterial('halo'), hosts.length);
  core.name = 'hosts-core';
  halo.name = 'hosts-halo';
  quat.identity();
  hosts.forEach((h, i) => {
    pos.set(h.x * S, plazaTopY + h.baseY * S, h.z * S);
    scl.set(h.s, h.s, h.s);
    m4.compose(pos, quat, scl);
    core.setMatrixAt(i, m4);
    halo.setMatrixAt(i, m4);
  });
  core.instanceMatrix.needsUpdate = true;
  halo.instanceMatrix.needsUpdate = true;
  group.add(core, halo);

  return group;
}
