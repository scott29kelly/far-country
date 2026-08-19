/**
 * CanopyShell — far forests as a lit aggregate surface (spec: "mid-distance
 * forests as lit canopy-shell/impostor fields, never fog silhouettes").
 *
 * One static 512² grid over the world. Vertices ride the heightfield plus a
 * canopy-coverage lift (the scatter-splatted canopy map), with hash bumps at
 * crown scale so ridgelines stay lumpy; cells without forest sink below the
 * terrain and z-fail away. Normals come from finite differences of the same
 * field, so the shell shades like a rolling foliage surface. It dithers IN
 * past the impostor mid-range and owns the 600 m → world-edge band together
 * with sparse impostors (which continue to give individual-tree silhouettes).
 */

import { BufferAttribute, BufferGeometry, Mesh } from 'three';
import { MeshPhysicalNodeMaterial, type StorageTexture } from 'three/webgpu';
import {
  Discard,
  Fn,
  cameraPosition,
  float,
  interleavedGradientNoise,
  mix,
  positionLocal,
  positionWorld,
  screenCoordinate,
  smoothstep,
  transformNormalToView,
  varying,
  vec2,
  vec3,
} from 'three/tsl';
import { canopyAt, cellHash2 } from '../gpu/passes/Scatter';
import { fbm3 } from '../gpu/noise/NoiseTSL';
import { grassTranslucency } from '../render/VegMaterials';
import type { NF, NV2, NV3 } from '../gpu/TSLTypes';
import type { Heightfield } from './Heightfield';
import { WORLD_SIZE } from './WorldConst';

const GRID = 512;
const FADE_IN = 620;
// 90 m band read as a 180 m-wide screen-door wash at the rim framings (half
// the pixels mid-dither); 55 m keeps the pop hidden while TRAA can still
// resolve the dither
const FADE_BAND = 55;

export function buildCanopyShell(
  hf: Heightfield,
  canopyTex: StorageTexture,
): Mesh {
  const n = GRID + 1;
  const pos = new Float32Array(n * n * 3);
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++) {
      const i = (z * n + x) * 3;
      pos[i] = (x / GRID - 0.5) * WORLD_SIZE;
      pos[i + 1] = 0;
      pos[i + 2] = (z / GRID - 0.5) * WORLD_SIZE;
    }
  }
  const idx = new Uint32Array(GRID * GRID * 6);
  let w = 0;
  for (let z = 0; z < GRID; z++) {
    for (let x = 0; x < GRID; x++) {
      const a = z * n + x;
      idx[w++] = a;
      idx[w++] = a + n;
      idx[w++] = a + 1;
      idx[w++] = a + 1;
      idx[w++] = a + n;
      idx[w++] = a + n + 1;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setIndex(new BufferAttribute(idx, 1));

  // physical for specularIntensity — the far-forest aggregate silvered at
  // glancing sun exactly like the cards (user feedback batch 2 item 11)
  const mat = new MeshPhysicalNodeMaterial();
  mat.specularIntensity = 0.2;

  /** canopy-top height field: terrain + coverage lift + crown bumps */
  const shellY = (p: NV2): NF => {
    const cov = canopyAt(canopyTex, p);
    const lift = smoothstep(0.18, 0.5, cov).mul(cov.mul(7).add(11));
    const bump = cellHash2(p.div(7).floor(), 911)
      .x.sub(0.5)
      .mul(4.5)
      .add(fbm3(vec3(p.x.mul(0.02), 4.4, p.y.mul(0.02)), 2).mul(2.6));
    const h = hf.sampleHeight(p);
    // forestless cells dive under the terrain and z-fail
    return mix(h.sub(8), h.add(lift).add(bump.mul(smoothstep(0.2, 0.45, cov))), smoothstep(0.16, 0.3, cov));
  };

  mat.positionNode = Fn(() => {
    const p = vec2(positionLocal.x, positionLocal.z);
    const y0 = shellY(p).toVar();
    return vec3(positionLocal.x, y0, positionLocal.z);
  })();

  // analytic canopy-top normal, carried by a vertex-stage varying into the
  // material's normal node. The grid ships positions ONLY: assigning
  // normalLocal (the old path) forced three to build the normal attribute
  // node first, which warned "attribute not found" on every boot — the
  // varying + normalNode route never touches the attribute, keeps the
  // height sampling in the vertex stage, and lands in the same normalView.
  const pN = vec2(positionLocal.x, positionLocal.z);
  const eN = float(WORLD_SIZE / GRID);
  const nrmV = varying(
    vec3(
      shellY(pN).sub(shellY(pN.add(vec2(eN, 0)))),
      eN,
      shellY(pN).sub(shellY(pN.add(vec2(0, eN)))),
    ),
  ) as unknown as NV3;
  mat.normalNode = transformNormalToView(nrmV.normalize() as never);

  // foliage palette by coverage + macro noise; translucency for the low sun
  const cov = canopyAt(canopyTex, positionWorld.xz);
  const macro = fbm3(positionWorld.mul(0.013).add(3.1), 2).mul(0.5).add(0.5);
  let albedo = mix(
    vec3(0.045, 0.105, 0.05),
    vec3(0.085, 0.155, 0.055),
    macro,
  ) as unknown as NV3;
  albedo = mix(albedo, vec3(0.1, 0.13, 0.045), cov.mul(0.4)) as unknown as NV3;
  // per-crown-cell hue/value mosaic on the SAME 7 m cells as the bump field,
  // so color follows the lumps: without it the shell is one flat green sheet
  // (r2 critic: "green bench patches render as flat unlit decals") while the
  // ref forest masses at this range are a mosaic of warm/cool crown colors.
  // Amplitude matches the near-field spread (species hueVar ~0.25 + instance
  // tint) so the impostor→shell band doesn't flatten with distance.
  const crownCell = cellHash2(positionWorld.xz.div(7).floor(), 613);
  albedo = albedo
    .mul(mix(vec3(1.22, 1.06, 0.72), vec3(0.78, 0.96, 1.14), crownCell.x))
    .mul(crownCell.y.mul(0.44).add(0.78)) as unknown as NV3;
  // fade distance from the DISPLACED position: the old varying pinned y=0,
  // inflating the distance from any elevated camera (~+18% at y≈510) and
  // parking the dither band exactly on the rim-view bench faces
  const distF = positionWorld.sub(cameraPosition).length();
  mat.colorNode = Fn(() => {
    // dither IN beyond the impostor mid-band
    Discard(
      smoothstep(FADE_IN - FADE_BAND, FADE_IN + FADE_BAND, distF).lessThanEqual(
        interleavedGradientNoise(screenCoordinate.xy),
      ),
    );
    return albedo;
  })();
  mat.emissiveNode = grassTranslucency(albedo, float(0.5)).mul(0.5);
  mat.roughness = 0.85;
  mat.metalness = 0;

  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}
