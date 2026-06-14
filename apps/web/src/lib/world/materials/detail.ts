"use client";

/**
 * Procedural surface-detail textures — the foundation of the photorealism pass.
 *
 * The MVP surfaces read as flat CGI because they had no micro-relief: a real
 * polished gold floor has hammer marks and fine scratches, real crystal has
 * facet planes and fractures, real jasper has mineral veining. This module
 * bakes those as NORMAL maps (and roughness maps) from layered value noise, on
 * a canvas, once on the client (next/dynamic gates SSR so `document` is safe).
 *
 * Everything is generated rather than downloaded so the world stays
 * self-contained (no network textures / HDRIs), consistent with the existing
 * Lightformer-based environment.
 */
import { CanvasTexture, type Texture, RepeatWrapping } from "three";

/** Small fast PRNG so generated detail is deterministic frame-to-frame. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise on a GRID×GRID lattice (wraps, so textures tile). */
function makeValueNoise(seed: number, grid = 256) {
  const vals = new Float32Array(grid * grid);
  const rnd = mulberry32(seed);
  for (let i = 0; i < vals.length; i++) vals[i] = rnd();
  const at = (x: number, y: number) =>
    vals[(((y % grid) + grid) % grid) * grid + (((x % grid) + grid) % grid)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smooth(x - x0);
    const fy = smooth(y - y0);
    const v00 = at(x0, y0);
    const v10 = at(x0 + 1, y0);
    const v01 = at(x0, y0 + 1);
    const v11 = at(x0 + 1, y0 + 1);
    const a = v00 + (v10 - v00) * fx;
    const b = v01 + (v11 - v01) * fx;
    return a + (b - a) * fy;
  };
}

type Noise = (x: number, y: number) => number;

/** Fractal sum (fBm). `cells` controls how many noise cells span the texture. */
function fbm(noise: Noise, u: number, v: number, octaves: number, cells: number) {
  let amp = 0.5;
  let freq = cells;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(u * freq, v * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Ridged fractal — sharp creases, good for facets/veins. */
function ridged(noise: Noise, u: number, v: number, octaves: number, cells: number) {
  let amp = 0.5;
  let freq = cells;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = 1 - Math.abs(noise(u * freq, v * freq) * 2 - 1);
    sum += amp * n * n;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

type HeightFn = (u: number, v: number) => number;

/** Bake a height field into a tangent-space normal map. */
function normalMapFrom(size: number, height: HeightFn, strength: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);

  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) h[y * size + x] = height(x / size, y / size);
  }
  const idx = (x: number, y: number) =>
    (((y % size) + size) % size) * size + (((x % size) + size) % size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hl = h[idx(x - 1, y)];
      const hr = h[idx(x + 1, y)];
      const hd = h[idx(x, y - 1)];
      const hu = h[idx(x, y + 1)];
      const dx = (hl - hr) * strength;
      const dy = (hd - hu) * strength;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * size + x) * 4;
      img.data[o] = ((dx / len) * 0.5 + 0.5) * 255;
      img.data[o + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[o + 2] = (1 / len) * 255;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

/** Bake a scalar field into a greyscale (e.g. roughness) map. */
function grayMapFrom(size: number, fn: HeightFn): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = Math.max(0, Math.min(1, fn(x / size, y / size))) * 255;
      const o = (y * size + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = c;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  return tex;
}

function repeat(tex: Texture, r: number): Texture {
  tex.repeat.set(r, r);
  return tex;
}

/**
 * Faceted crystal relief — ridged facet planes plus a fine sparkle grain, so
 * the terraces and walls catch light as cut crystal rather than smooth glass.
 */
export function crystalNormalMap(repeats = 4): Texture {
  const big = makeValueNoise(1337);
  const fine = makeValueNoise(7);
  const height: HeightFn = (u, v) =>
    ridged(big, u, v, 4, 5) * 0.8 + fbm(fine, u, v, 3, 28) * 0.2;
  return repeat(normalMapFrom(512, height, 2.4), repeats);
}

/**
 * Polished-gold micro-surface: broad hammer dimples + fine directional brush
 * scratches. Returns a normal map and a matching roughness map (scratches read
 * slightly rougher than the polished field).
 */
export function goldDetailMaps(repeats = 6): { normalMap: Texture; roughnessMap: Texture } {
  const dimple = makeValueNoise(42);
  const brush = makeValueNoise(99);
  // Anisotropic brush: stretch v so scratches run along one axis.
  const height: HeightFn = (u, v) =>
    fbm(dimple, u, v, 3, 10) * 0.55 + fbm(brush, u * 0.15, v, 2, 40) * 0.45;
  const normalMap = repeat(normalMapFrom(512, height, 1.3), repeats);
  const roughnessMap = repeat(
    grayMapFrom(512, (u, v) => 0.34 + fbm(brush, u * 0.15, v, 2, 40) * 0.28),
    repeats,
  );
  return { normalMap, roughnessMap };
}

/** Mineral veining for the jasper walls. */
export function jasperNormalMap(repeats = 3): Texture {
  const vein = makeValueNoise(2024);
  const grain = makeValueNoise(5);
  const height: HeightFn = (u, v) =>
    ridged(vein, u, v, 5, 4) * 0.7 + fbm(grain, u, v, 3, 22) * 0.3;
  return repeat(normalMapFrom(512, height, 1.8), repeats);
}

/** Bumpy leaf-cluster relief for the tree canopies. */
export function foliageNormalMap(repeats = 3): Texture {
  const clump = makeValueNoise(808);
  const fine = makeValueNoise(909);
  const height: HeightFn = (u, v) =>
    fbm(clump, u, v, 4, 9) * 0.55 + ridged(fine, u, v, 3, 34) * 0.45;
  return repeat(normalMapFrom(256, height, 2.2), repeats);
}
