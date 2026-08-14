/**
 * The inhabitants of the city — the great multitude and the angelic hosts
 * (roadmap M3.6, CITY-QUALITY-BAR population floor / delta #9).
 *
 * Policy block (ADR 0019 + 0011 consequence — reference like Throne
 * referenced 0010):
 *   - ADR 0019: the REDEEMED render as realistic human beings — generic,
 *     never portraits; visibly diverse in ethnicity, age and build
 *     (Rev 7:9 "from every nation"); white robes + palm branches kept
 *     (rule 3). The multitude rendering lives in Crowd.ts (GPU LOD
 *     cull) + FigureMesh.ts (seeded parametric figures) + figureModel.ts
 *     (diversity as data).
 *   - ADR 0010: the divine persons stay aniconic — figures FACE the summit
 *     light; the light never resolves into a figure. Untouched here.
 *   - ADR 0011 (still in force for non-humans): the hosts
 *     (Rev 5:11, `myriads-of-angels`) stay abstract vertical beings of
 *     light ringing the summit, NO wings or figural form, slowly rising
 *     and falling (RENDERING-DECISIONS #3 — unchanged by ADR 0019 rule 5).
 *   - The four living creatures and the twenty-four elders are OMITTED per
 *     ADR 0011 rule 4 (symbolic-tier; no RENDERING-DECISIONS entry yet).
 *
 * Engine paths: the multitude is GPU-driven compacted-indirect instancing
 * (Crowd.ts — the vegetation idiom on a static transform set); the hosts
 * remain plain InstancedMesh (two draws, core + halo share one transform
 * set). The hosts' rise/fall is a shader-time bob (positionNode +
 * per-instance hash phase) — no CPU per-instance updates (spec hard rule).
 * Placements come exclusively from populationModel.ts (CPU-pure,
 * probe-tested); figures stand on the SAME floors
 * cityCollide.cityFloorLocalY exposes to the walker.
 *
 * Bloom contract: every emissive here stays under the 1.5 threshold — only
 * the crown + glory cross it (CityMassing). Constants live in
 * populationModel.ts / figureModel.ts so the probes assert them.
 */

import { CapsuleGeometry, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import { MeshStandardNodeMaterial, type Renderer } from 'three/webgpu';
import { instanceIndex, positionLocal, time, vec3 } from 'three/tsl';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NF, NU, NV3 } from '../gpu/TSLTypes';
import { slotHash } from '../render/VegInstance';
import { buildCrowd, type CrowdBuild } from './Crowd';
import { NJ_SCALE } from './rimModel';
import {
  HOST,
  HOST_CORE_EMISSIVE,
  HOST_HALO_EMISSIVE,
  hostPlacements,
} from './populationModel';

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

export interface PopulationBuild {
  group: Group;
  /** per-frame crowd compute (cull + indirect); hosts are shader-time only.
   *  worldTime (engine freezable clock) drives the crowd worship cycles. */
  update(renderer: Renderer, camera: PerspectiveCamera, worldTime: number): void;
  /** HUD stats from the crowd's throttled counter readback */
  counterSnapshot(): Record<string, number>;
}

/**
 * Build the population in WORLD space (human-scale content, the TreesOfLife
 * convention — never under the ×NJ_SCALE allotment group). `plazaTopY` is
 * the city group's world Y (local y 0). Async: the crowd's far-ring atlas
 * is captured through the live renderer at build time.
 */
export async function buildPopulation(opts: {
  gi: ProbeGI | null;
  plazaTopY: number;
  renderer: Renderer;
}): Promise<PopulationBuild> {
  const { gi, plazaTopY, renderer } = opts;
  const S = NJ_SCALE;
  const group = new Group();
  group.name = 'population';

  // ---- the great multitude (Rev 7:9) — ADR 0019 rebuild ---------------------
  const crowd: CrowdBuild = await buildCrowd({ gi, plazaTopY, renderer });
  group.add(crowd.group);

  // ---- the angelic hosts (Rev 5:11) -----------------------------------------
  const hosts = hostPlacements();
  const coreGeo = new CapsuleGeometry(HOST.coreR, HOST.coreLen, 6, 12);
  const haloGeo = new CapsuleGeometry(HOST.haloR, HOST.haloLen, 6, 12);
  const core = new InstancedMesh(coreGeo, hostMaterial('core'), hosts.length);
  const halo = new InstancedMesh(haloGeo, hostMaterial('halo'), hosts.length);
  core.name = 'hosts-core';
  halo.name = 'hosts-halo';
  const m4 = new Matrix4();
  const pos = new Vector3();
  const quat = new Quaternion();
  const scl = new Vector3();
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

  return {
    group,
    update: (r, camera, worldTime) => crowd.update(r, camera, worldTime),
    counterSnapshot: () => crowd.counterSnapshot(),
  };
}
