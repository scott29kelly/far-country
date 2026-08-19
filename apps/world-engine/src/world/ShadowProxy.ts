/**
 * ShadowProxy — coarse terrain stand-in for the shadow cascades.
 *
 * The CDLOD tiles run 2.8M+ triangles; letting them cast re-rasterizes that
 * into all four CSM cascades (~11M tri-passes — the "terrain 20M tris" debt).
 * Mountain/ridge shadows only need macro shape, so a static 512² grid (8 m
 * quads, heights from the height buffer in the vertex stage) casts instead:
 * colorWrite/depthWrite off make its main-pass cost vertex-only, while the
 * shadow pass swaps in its depth material as usual. Near-field terrain
 * self-shadow detail below 8 m is covered by the screen-space contact
 * shadows. The real terrain keeps castShadow = false.
 */

import { BufferAttribute, BufferGeometry, Mesh } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { positionLocal, transformNormalToView, vec2, vec3 } from 'three/tsl';
import type { Heightfield } from './Heightfield';
import { WORLD_SIZE } from './WorldConst';

const GRID = 512;
/**
 * Erosion radius for the vertex height sample, in fractions of a quad.
 * GA-3 round 3: at the New Jerusalem world size (12288 m) this fixed grid is
 * 24 m quads, not the 8 m the header was written against — and a 24 m
 * point-sampled facet of the mesa cliff can stand metres SUNWARD of the real
 * face, so the whole real face behind it fails the depth compare and paints
 * kilometre-scale false shadows with triangle-straight edges (the round-2
 * critic's "unlit polygon / projection seam" on falls-w1305; proven by the
 * ?ablate=proxy A/B, shots/wip/ga3/work-sky/w1305-cov0[-noproxy].png). Fix:
 * erode each vertex to the MIN height over its quad neighbourhood (centre +
 * 4 diagonal taps at ±ERODE_FRAC·quad) so the proxy sits at-or-below the
 * real surface between samples. Honest-error direction: cast shadows can
 * only RECEDE, by at most ~one quad of silhouette — sub-2-texel in the far
 * cascade — while false self-shadow protrusions are removed entirely. 0.5
 * (half-quad) proved sufficient at the falls cams; escalate toward 1.0 only
 * with new evidence.
 */
const ERODE_FRAC = 0.5;

export function buildTerrainShadowProxy(hf: Heightfield): Mesh {
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

  const mat = new MeshStandardNodeMaterial();
  // eroded height: min over the vertex + its 4 diagonal neighbours at
  // ±ERODE_FRAC·quad — see the ERODE_FRAC derivation comment above. Vertex
  // stage only (GRID² verts), 4 extra height taps.
  const e = (WORLD_SIZE / GRID) * ERODE_FRAC;
  const hEroded = hf
    .sampleHeight(vec2(positionLocal.x, positionLocal.z))
    .min(hf.sampleHeight(vec2(positionLocal.x.add(e), positionLocal.z.add(e))))
    .min(hf.sampleHeight(vec2(positionLocal.x.add(e), positionLocal.z.sub(e))))
    .min(hf.sampleHeight(vec2(positionLocal.x.sub(e), positionLocal.z.add(e))))
    .min(hf.sampleHeight(vec2(positionLocal.x.sub(e), positionLocal.z.sub(e))));
  const lifted = vec3(positionLocal.x, hEroded, positionLocal.z);
  mat.positionNode = lifted;
  (mat as unknown as { castShadowPositionNode: unknown }).castShadowPositionNode = lifted;
  // the grid ships positions only; pin the normal node so the standard
  // material never builds normalLocal against the missing attribute (TSL
  // warning). The value is irrelevant — this mesh exists for depth only.
  mat.normalNode = transformNormalToView(vec3(0, 1, 0));
  mat.colorWrite = false;
  mat.depthWrite = false;
  mat.depthTest = false;

  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  return mesh;
}
