/**
 * Joint-metrics extractor for kimodo.cpp reference clips (M4.4 source call
 * 2026-08-31: procedural stays runtime, kimodo output is the authoring
 * REFERENCE). Samples a skeleton-only animation GLB and emits per-frame
 * scalar channels comparable to the figureModel WORSHIP curves:
 *
 *   hipsY        world Y of Hips (metres)
 *   torsoPitch   angle of Hips->Chest off vertical (rad) ~ WORSHIP bow
 *   neckPitch    angle of Chest->Head off vertical (rad) ~ HEAD_IDLE pitch
 *   armElevL/R   shoulder->hand elevation above horizontal (rad) ~ arm lift
 *   footYmin     lower of the two feet (grounding check)
 *
 * The first sample is the normalization reference (clips start standing):
 * the summary reports hip drop as a fraction of standing HEAD height so it
 * reads against WORSHIP.kneelDrop (x figure height) directly.
 *
 * Usage:
 *   npx tsx tools/kimodo-metrics.ts shots/wip/kimodo/bow-deep-seed7.glb
 *   npx tsx tools/kimodo-metrics.ts --csv out.csv --samples 150 <clip.glb>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { AnimationMixer, Object3D, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface Row {
  t: number;
  hipsY: number;
  torsoPitch: number;
  neckPitch: number;
  armElevL: number;
  armElevR: number;
  footYmin: number;
}

function findNode(root: Object3D, ...names: string[]): Object3D | null {
  let hit: Object3D | null = null;
  root.traverse((o) => {
    if (hit) return;
    const n = o.name.toLowerCase();
    for (const want of names) {
      if (n === want.toLowerCase()) {
        hit = o;
        return;
      }
    }
  });
  if (hit) return hit;
  // fall back to substring match (rig prefixes vary)
  root.traverse((o) => {
    if (hit) return;
    const n = o.name.toLowerCase();
    for (const want of names) {
      if (n.includes(want.toLowerCase())) {
        hit = o;
        return;
      }
    }
  });
  return hit;
}

function worldPos(o: Object3D): Vector3 {
  return o.getWorldPosition(new Vector3());
}

/** angle of the (a -> b) direction off the +Y axis, radians */
function pitchOffVertical(a: Vector3, b: Vector3): number {
  const d = b.clone().sub(a);
  const len = d.length();
  if (len < 1e-6) return 0;
  return Math.acos(Math.min(Math.max(d.y / len, -1), 1));
}

/** elevation of (a -> b) above the horizontal plane, radians (up positive) */
function elevation(a: Vector3, b: Vector3): number {
  const d = b.clone().sub(a);
  const len = d.length();
  if (len < 1e-6) return 0;
  return Math.asin(Math.min(Math.max(d.y / len, -1), 1));
}

async function loadGlb(path: string): Promise<GLTF> {
  const buf = readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(ab, '', resolve, reject);
  });
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let samples = 120;
  let csvOut = '';
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--samples') samples = Number(argv[++i]);
    else if (argv[i] === '--csv') csvOut = argv[++i];
    else files.push(argv[i]);
  }
  if (files.length === 0) {
    console.error('usage: kimodo-metrics.ts [--samples N] [--csv out.csv] <clip.glb>...');
    process.exit(2);
  }

  const csvLines: string[] = [
    'clip,t,hipsY,torsoPitchRad,neckPitchRad,armElevLRad,armElevRRad,footYmin',
  ];

  for (const file of files) {
    const gltf = await loadGlb(file);
    const root = gltf.scene;
    const clip = gltf.animations[0];
    if (!clip) {
      console.error(`${file}: no animation`);
      continue;
    }
    const hips = findNode(root, 'Hips');
    const chest = findNode(root, 'Chest', 'Spine2');
    const head = findNode(root, 'Head');
    const shL = findNode(root, 'LeftArm', 'L_Arm', 'LArm');
    const shR = findNode(root, 'RightArm', 'R_Arm', 'RArm');
    const handL = findNode(root, 'LeftHand', 'L_Hand', 'LHand');
    const handR = findNode(root, 'RightHand', 'R_Hand', 'RHand');
    const footL = findNode(root, 'LeftFoot', 'L_Foot', 'LFoot');
    const footR = findNode(root, 'RightFoot', 'R_Foot', 'RFoot');
    const missing = Object.entries({ hips, chest, head, shL, shR, handL, handR, footL, footR })
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (missing.length) {
      const names: string[] = [];
      root.traverse((o) => {
        if (o.name) names.push(o.name);
      });
      console.error(`${file}: missing joints ${missing.join(',')}; nodes = ${names.join(' ')}`);
      continue;
    }

    const mixer = new AnimationMixer(root);
    mixer.clipAction(clip).play();

    const rows: Row[] = [];
    for (let i = 0; i < samples; i++) {
      const t = (i / (samples - 1)) * clip.duration;
      mixer.setTime(t);
      root.updateMatrixWorld(true);
      const pHips = worldPos(hips!);
      const pChest = worldPos(chest!);
      const pHead = worldPos(head!);
      rows.push({
        t,
        hipsY: pHips.y,
        torsoPitch: pitchOffVertical(pHips, pChest),
        neckPitch: pitchOffVertical(pChest, pHead),
        armElevL: elevation(worldPos(shL!), worldPos(handL!)),
        armElevR: elevation(worldPos(shR!), worldPos(handR!)),
        footYmin: Math.min(worldPos(footL!).y, worldPos(footR!).y),
      });
    }

    const name = basename(file, '.glb');
    for (const r of rows) {
      csvLines.push(
        `${name},${r.t.toFixed(3)},${r.hipsY.toFixed(4)},${r.torsoPitch.toFixed(4)},` +
          `${r.neckPitch.toFixed(4)},${r.armElevL.toFixed(4)},${r.armElevR.toFixed(4)},` +
          `${r.footYmin.toFixed(4)}`,
      );
    }

    // summary against the WORSHIP constants' units
    const stand = rows[0];
    mixer.setTime(0);
    root.updateMatrixWorld(true);
    const headY0 = worldPos(head!).y;
    const foot0 = Math.min(worldPos(footL!).y, worldPos(footR!).y);
    const heightApprox = headY0 - foot0;
    const maxBow = Math.max(...rows.map((r) => r.torsoPitch)) - stand.torsoPitch;
    const maxNeck = Math.max(...rows.map((r) => r.neckPitch)) - stand.neckPitch;
    const minHips = Math.min(...rows.map((r) => r.hipsY));
    const dropFrac = (stand.hipsY - minHips) / heightApprox;
    const maxArm = Math.max(...rows.map((r) => Math.max(r.armElevL, r.armElevR)));
    console.log(
      `${name}: dur ${clip.duration.toFixed(2)}s height~${heightApprox.toFixed(2)}m | ` +
        `bow +${maxBow.toFixed(3)} rad (${((maxBow * 180) / Math.PI).toFixed(1)} deg) | ` +
        `neck +${maxNeck.toFixed(3)} rad | ` +
        `hipDrop ${(stand.hipsY - minHips).toFixed(3)}m = ${dropFrac.toFixed(3)} x height | ` +
        `armElev max ${maxArm.toFixed(3)} rad (${((maxArm * 180) / Math.PI).toFixed(1)} deg)`,
    );
  }

  if (csvOut) {
    writeFileSync(csvOut, csvLines.join('\n') + '\n');
    console.log(`csv -> ${csvOut} (${csvLines.length - 1} rows)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
