/**
 * Volumetric clouds — 2-layer raymarched Worley–Perlin density field:
 *  - 3D noise textures baked by compute (base 96³ perlin-worley, detail 32³)
 *  - cumulus layer in an altitude band that sits BELOW the high summits so
 *    vistas can look across/down onto cloud tops (reference: Witcher frame)
 *  - half-res raymarch in the post chain with temporal blue-noise jitter,
 *    Beer–Powder lighting, HG phase toward the sun, ambient from the sky LUT
 *  - cloud shadows: a top-down transmittance map sampled by the terrain
 *    material and the light shaft pass
 */

import { HalfFloatType, RedFormat, RepeatWrapping, Vector2 } from 'three';
import type { Renderer } from 'three/webgpu';
import { Storage3DTexture, StorageTexture } from 'three/webgpu';
import {
  Fn,
  If,
  Loop,
  Return,
  clamp,
  exp,
  float,
  instanceIndex,
  mix,
  mx_fractal_noise_float,
  mx_worley_noise_float,
  pow,
  smoothstep,
  texture,
  texture3D,
  textureStore,
  uniform,
  uvec2,
  uvec3,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import type { NF, NI, NV2, NV3 } from '../gpu/TSLTypes';
import { windU } from '../render/Wind';
import { WORLD_SIZE } from '../world/WorldConst';
import type { Atmosphere } from './Atmosphere';
import { SUN_E } from './Atmosphere';

const BASE_RES = 96;
const DETAIL_RES = 32;
const SHADOW_RES = 768;
const WEATHER_RES = 512;
/** weather field world span (m) — tiles beyond this, far past the playable area */
const WEATHER_WORLD = 26000;
/** cloud layer altitudes (m) — below the ~2000 m summits */
export const CLOUD_BOTTOM = 1250;
export const CLOUD_TOP = 1900;
const SHADOW_WORLD = WORLD_SIZE * 1.6;

export class Clouds {
  readonly baseNoise: Storage3DTexture;
  readonly detailNoise: Storage3DTexture;
  /** r: weather/coverage field (baked 3-oct fbm — hot path in the march) */
  readonly weatherMap: StorageTexture;
  /** r: transmittance toward the sun through the layer, top-down */
  readonly shadowMap: StorageTexture;
  readonly coverage = uniform(0.62);
  readonly density = uniform(0.85);
  private atmosphere: Atmosphere;
  private shadowKernel: Parameters<Renderer['computeAsync']>[0] | null = null;
  /** ?cloudflat=1 — constant density slab, bypasses noise textures (bisect) */
  private flatDebug = false;
  /**
   * Weather motion (Phase 6 / Pillar F "clouds evolve"): the whole field
   * translates downwind at cloud-layer speed; the detail erosion drifts
   * 1.35× faster, so masses churn instead of sliding as a rigid sheet.
   * CPU-owned clock (uniform) so the periodic shadow re-bake and the live
   * lookup agree exactly.
   */
  private readonly uTime = uniform(0);
  private readonly uDriftBase = uniform(new Vector2());
  private timeAcc = 0;
  private lastBakeT = -1e9;
  private readonly DRIFT_V = 22; // m/s at the cloud layer

  constructor(atmosphere: Atmosphere) {
    this.atmosphere = atmosphere;
    // tuning overrides: ?cov=0.6&cdens=1.2
    const q = new URLSearchParams(window.location.search);
    const covQ = Number(q.get('cov') ?? NaN);
    const densQ = Number(q.get('cdens') ?? NaN);
    if (Number.isFinite(covQ)) this.coverage.value = covQ;
    if (Number.isFinite(densQ)) this.density.value = densQ;
    this.flatDebug = q.get('cloudflat') === '1';
    this.baseNoise = new Storage3DTexture(BASE_RES, BASE_RES, BASE_RES);
    this.baseNoise.type = HalfFloatType;
    this.baseNoise.format = RedFormat;
    this.detailNoise = new Storage3DTexture(DETAIL_RES, DETAIL_RES, DETAIL_RES);
    this.detailNoise.type = HalfFloatType;
    this.detailNoise.format = RedFormat;
    // FC-0011 (with the periodic bake in init): the march tiles these with
    // fract(worldPos/period), so the sampler must wrap — under the default
    // clamp-to-edge, texel N−1 never interpolates into texel 0 and the wrap
    // plane keeps a one-texel step (measured ~3/255 residual at the gate
    // cam's centre column after the content fix alone).
    for (const t of [this.baseNoise, this.detailNoise]) {
      t.wrapS = RepeatWrapping;
      t.wrapT = RepeatWrapping;
      t.wrapR = RepeatWrapping;
    }
    this.shadowMap = new StorageTexture(SHADOW_RES, SHADOW_RES);
    this.shadowMap.type = HalfFloatType;
    this.shadowMap.generateMipmaps = false;
    this.weatherMap = new StorageTexture(WEATHER_RES, WEATHER_RES);
    this.weatherMap.type = HalfFloatType;
    this.weatherMap.generateMipmaps = false;
  }

  async init(renderer: Renderer): Promise<void> {
    // Periodic-ization (FC-0011): the march samples these bakes with
    // fract(worldPos / period), but the mx worley/perlin fields are NOT
    // periodic — texel 0 ≠ texel N−1, so every world seam plane (x or z a
    // multiple of 3600 m for base, 420 m for detail) printed a hard value
    // step through the layer. The gate cam (x = 0, yaw exactly π) projects
    // the x = 0 plane onto exact screen centre — the measured 4/255
    // half-width sky seam (proven by ablate=clouds → step 8.2 → 0.5/255).
    // Fix at BAKE time (zero march cost): 8-corner low-edge crossfade
    //   g(p) = Σ n(p + corner)·Π w,  w = smoothstep(M, 0, u) for the +1 axis
    // which makes g(0) = n(1) = g(1) exactly (periodic in all three axes)
    // and leaves the field beyond the M = 12% margin band untouched.
    const SEAM_M = 0.12;
    const periodic = (p: NV3, n: (q: NV3) => NF): NF => {
      const wx = smoothstep(SEAM_M, 0, p.x);
      const wy = smoothstep(SEAM_M, 0, p.y);
      const wz = smoothstep(SEAM_M, 0, p.z);
      let sum: NF = float(0);
      for (const ix of [0, 1] as const) {
        for (const iy of [0, 1] as const) {
          for (const iz of [0, 1] as const) {
            const w = (ix ? wx : wx.oneMinus())
              .mul(iy ? wy : wy.oneMinus())
              .mul(iz ? wz : wz.oneMinus());
            sum = sum.add(n(p.add(vec3(ix, iy, iz))).mul(w));
          }
        }
      }
      return sum;
    };

    // --- base: perlin-worley remap, periodic via the 8-corner crossfade ------
    const N = BASE_RES;
    const basePwAt = (p: NV3): NF => {
      const pw = p.mul(4);
      const perlin = mx_fractal_noise_float(pw.mul(2), 4, 2.0, 0.55, 1).mul(0.5).add(0.5);
      const w0 = float(1).sub(clamp(mx_worley_noise_float(pw, 1), 0, 1));
      const w1 = float(1).sub(clamp(mx_worley_noise_float(pw.mul(2.03).add(19.7), 1), 0, 1));
      const w2 = float(1).sub(clamp(mx_worley_noise_float(pw.mul(4.01).add(47.3), 1), 0, 1));
      const wfbm = w0.mul(0.625).add(w1.mul(0.25)).add(w2.mul(0.125));
      // remap perlin by worley (Schneider-style perlin-worley)
      return clamp(perlin.sub(wfbm.oneMinus()).div(wfbm.max(1e-3)), 0, 1);
    };
    const baseK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(N * N * N), () => {
        Return();
      });
      const x = i.mod(N);
      const y = i.div(N).mod(N);
      const z = i.div(N * N);
      const p = vec3(float(x), float(y), float(z)).add(0.5).div(N);
      const pwv = periodic(p, basePwAt);
      textureStore(this.baseNoise, uvec3(x.toUint(), y.toUint(), z.toUint()), vec4(pwv, 0, 0, 1)).toWriteOnly();
    })().compute(N * N * N);
    baseK.setName('cloudBaseNoise');
    await renderer.computeAsync(baseK);

    const M = DETAIL_RES;
    const detailAt = (p: NV3): NF => {
      const w0 = float(1).sub(clamp(mx_worley_noise_float(p.mul(3), 1), 0, 1));
      const w1 = float(1).sub(clamp(mx_worley_noise_float(p.mul(6.02).add(7.7), 1), 0, 1));
      return w0.mul(0.65).add(w1.mul(0.35));
    };
    const detailK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(M * M * M), () => {
        Return();
      });
      const x = i.mod(M);
      const y = i.div(M).mod(M);
      const z = i.div(M * M);
      const p = vec3(float(x), float(y), float(z)).add(0.5).div(M);
      const d = periodic(p, detailAt);
      textureStore(this.detailNoise, uvec3(x.toUint(), y.toUint(), z.toUint()), vec4(d, 0, 0, 1)).toWriteOnly();
    })().compute(M * M * M);
    detailK.setName('cloudDetailNoise');
    await renderer.computeAsync(detailK);

    // --- weather field bake (wraps at WEATHER_WORLD) ---------------------------
    const W = WEATHER_RES;
    const weatherK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(W * W), () => {
        Return();
      });
      const x = i.mod(W);
      const y = i.div(W);
      const uv01 = vec2(float(x).add(0.5), float(y).add(0.5)).div(W);
      // periodic domain via worley/fractal over a wrapped circle would cost
      // more than it buys at this span; sample fbm directly (seam is 26 km out)
      const wUv = uv01.sub(0.5).mul(WEATHER_WORLD / 5200);
      const v = mx_fractal_noise_float(wUv, 3, 2.2, 0.5, 1).mul(0.5).add(0.5);
      textureStore(this.weatherMap, uvec2(x.toUint(), y.toUint()), vec4(v, 0, 0, 1)).toWriteOnly();
    })().compute(W * W);
    weatherK.setName('cloudWeather');
    await renderer.computeAsync(weatherK);

    // --- cloud shadow map kernel (re-run on sun/ToD change) -------------------
    const S = SHADOW_RES;
    const shadowK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(S * S), () => {
        Return();
      });
      const x = i.mod(S);
      const y = i.div(S);
      const wpos = vec2(float(x).add(0.5), float(y).add(0.5))
        .div(S)
        .sub(0.5)
        .mul(SHADOW_WORLD);
      // march vertically through the layer, accumulate optical depth; the
      // sun-angle offset is approximated by shifting with the sun direction
      const sunDir = this.atmosphere.sunDir;
      const STEPS = 20;
      const dh = (CLOUD_TOP - CLOUD_BOTTOM) / STEPS;
      const tau = float(0).toVar();
      Loop(STEPS, ({ i: si }: { readonly i: NI }) => {
        const h = float(si).add(0.5).mul(dh).add(CLOUD_BOTTOM);
        // shift sample along the sun's horizontal direction as we ascend
        const k = h.sub(CLOUD_BOTTOM).div(sunDir.y.abs().max(0.15));
        const sp = wpos.add(vec2(sunDir.x, sunDir.z).mul(k).negate());
        tau.addAssign(this.sampleDensity(vec3(sp.x, h, sp.y), false, true).mul(dh));
      });
      const trans = exp(tau.mul(-0.045));
      textureStore(this.shadowMap, uvec2(x.toUint(), y.toUint()), vec4(trans, 0, 0, 1)).toWriteOnly();
    })().compute(S * S);
    shadowK.setName('cloudShadowMap');
    this.shadowKernel = shadowK;
    await renderer.computeAsync(shadowK);
  }

  /** re-bake the shadow map (call after sun changes) */
  async refreshShadow(renderer: Renderer): Promise<void> {
    this.uDriftBase.value
      .set(windU.dir.value.x, windU.dir.value.y)
      .multiplyScalar(this.timeAcc * this.DRIFT_V);
    this.lastBakeT = this.timeAcc;
    if (this.shadowKernel) await renderer.computeAsync(this.shadowKernel);
  }

  /** per-frame: advance the weather clock; re-bake the drifted shadow ~2.5 s */
  tick(renderer: Renderer, dt: number): void {
    this.timeAcc += dt;
    this.uTime.value = this.timeAcc;
    if (this.timeAcc - this.lastBakeT > 2.5 && this.shadowKernel) {
      this.uDriftBase.value
        .set(windU.dir.value.x, windU.dir.value.y)
        .multiplyScalar(this.timeAcc * this.DRIFT_V);
      this.lastBakeT = this.timeAcc;
      renderer.compute(this.shadowKernel as Parameters<Renderer['compute']>[0]);
    }
  }

  /** downwind translation of the cloud field at time t (m) */
  private driftAt(t: NF): NV2 {
    return vec2(windU.dir as unknown as NV2).mul(t.mul(this.DRIFT_V));
  }

  /**
   * cloud density at a world position (m). detail=false for the shadow
   * march. `frozen=true` bakes with the drift FIXED at uDriftBase (the
   * shadow map re-bakes every few seconds; shadowAt applies the residual).
   */
  sampleDensity(wp: NV3, detail: boolean, frozen = false): NF {
    const hNorm = wp.y.sub(CLOUD_BOTTOM).div(CLOUD_TOP - CLOUD_BOTTOM);
    const inLayer = smoothstep(0, 0.12, hNorm).mul(smoothstep(1, 0.55, hNorm));
    if (this.flatDebug) return inLayer.mul(0.3).mul(float(this.density));
    const drift = frozen
      ? (vec2(this.uDriftBase) as unknown as NV2)
      : this.driftAt(this.uTime as unknown as NF);
    const xz = wp.xz.sub(drift);
    // weather/coverage field: large-scale variation breaks the layer into
    // cumulus masses with clear lanes (baked texture — fbm here was the
    // hottest math in the march: 40 steps × 4 sun taps × 3 octaves)
    const wUv = xz.div(WEATHER_WORLD).add(0.5).fract();
    // contrast-stretch: raw fbm hovers near 0.5 — dense cores + clear lanes
    const weather = smoothstep(0.3, 0.78, texture(this.weatherMap, wUv, 0).x);
    const cov = clamp(weather.sub(float(1).sub(float(this.coverage))), 0, 1).mul(2.2);
    const base = texture3D(this.baseNoise, vec3(xz.x, wp.y, xz.y).div(3600).fract(), 0).x;
    let dens = clamp(base.mul(cov).sub(float(0.32).mul(hNorm.add(0.45))), 0, 1).mul(inLayer);
    if (detail) {
      // detail erodes at a different drift rate — shapes churn, not slide
      const drift2 = frozen
        ? (vec2(this.uDriftBase) as unknown as NV2)
        : this.driftAt((this.uTime as unknown as NF).mul(1.35));
      const xz2 = wp.xz.sub(drift2);
      const det = texture3D(this.detailNoise, vec3(xz2.x, wp.y, xz2.y).div(420).fract(), 0).x;
      dens = clamp(dens.sub(det.mul(0.22).mul(float(1).sub(dens))), 0, 1);
    }
    return dens.mul(float(this.density));
  }

  /** sample the top-down cloud shadow transmittance at a world xz */
  shadowAt(wxz: NV2): NF {
    // shift by the drift accumulated since the last shadow bake (kept ≤ a
    // few seconds by tick() — the offset never nears the map border)
    const resid = this.driftAt(this.uTime as unknown as NF).sub(
      vec2(this.uDriftBase) as unknown as NV2,
    );
    const uv = wxz.sub(resid).div(SHADOW_WORLD).add(0.5);
    const inside = smoothstep(0.0, 0.02, uv.x)
      .mul(smoothstep(1.0, 0.98, uv.x))
      .mul(smoothstep(0.0, 0.02, uv.y))
      .mul(smoothstep(1.0, 0.98, uv.y));
    const t = texture(this.shadowMap, clamp(uv, 0, 1)).x;
    return mix(float(1), t, inside);
  }

  /**
   * Raymarch the cloud layer for a view ray; returns rgb radiance + alpha.
   * Designed to run in the post chain after the scene (composited by depth).
   */
  march(camPos: NV3, dir: NV3, maxDistM: NF, jitter: NF): { color: NV3; alpha: NF } {
    const sunDir = this.atmosphere.sunDir.normalize();

    // ray-layer intersection (horizontal slab)
    const t0 = float(CLOUD_BOTTOM).sub(camPos.y).div(dir.y);
    const t1 = float(CLOUD_TOP).sub(camPos.y).div(dir.y);
    const tEnterRaw = t0.min(t1);
    const tExitRaw = t0.max(t1);
    const inside = camPos.y.greaterThan(CLOUD_BOTTOM).and(camPos.y.lessThan(CLOUD_TOP));
    const tEnter = inside.select(float(0), tEnterRaw.max(0));
    const tExit = tExitRaw.min(maxDistM).min(26000);

    const valid = tExit.greaterThan(tEnter).and(dir.y.abs().greaterThan(1e-4));

    const STEPS = 32;
    const seg = tExit.sub(tEnter).div(STEPS);
    const trans = float(1).toVar();
    const light = vec3(0).toVar();
    const ambient = this.atmosphere
      .skyColor(vec3(dir.x, dir.y.abs().max(0.25), dir.z))
      .mul(0.5)
      .add(this.atmosphere.skyColor(dir).mul(0.5));
    const nu = dir.dot(sunDir);
    // dual-lobe HG
    const g1 = 0.62;
    const g2 = -0.18;
    const hg = (g: number): NF => {
      const gg = g * g;
      return float((1 - gg) / (4 * Math.PI)).div(
        pow(float(1 + gg).sub(nu.mul(2 * g)), 1.5),
      );
    };
    // isotropic floor ≈ multiple scattering (clouds are never phase-black).
    // 0.14 → 0.10: the flat floor was lifting self-shadowed bases toward
    // their tops — the r0 critic's "uniformly white, no gray undersides"
    // (Trail Ridge ref: bases ~two stops below tops). The base/top split
    // itself comes from the ambient height ramp below.
    const phase = hg(g1).mul(0.75).add(hg(g2).mul(0.25)).add(0.1);
    const sunT = this.atmosphere.sampleTransmittance(float(6360.35), clamp(sunDir.y, -1, 1));

    If(valid, () => {
      Loop(STEPS, ({ i: si }: { readonly i: NI }) => {
        const t = tEnter.add(float(si).add(jitter).mul(seg));
        const sp = camPos.add(dir.mul(t));
        const dens = this.sampleDensity(sp, true);
        If(dens.greaterThan(0.002), () => {
          // cheap sun occlusion: 3 coarse steps toward the sun
          const lTau = float(0).toVar();
          for (let ls = 1; ls <= 3; ls++) {
            const lp = sp.add(sunDir.mul(ls * 165));
            lTau.addAssign(this.sampleDensity(lp, false).mul(165));
          }
          // −0.04 → −0.055: deepen in-cloud sun occlusion so shadowed cores
          // and bases separate from lit tops (Trail Ridge two-stop split);
          // at the new low 17:00 sun the 3-step light march runs nearly
          // horizontally through neighbouring mass, which this scales.
          const sunVis = exp(lTau.mul(-0.055));
          const powder = float(1).sub(exp(dens.mul(-22)));
          // ambient sees less sky toward the cloud base
          const hn = clamp(
            sp.y.sub(CLOUD_BOTTOM).div(CLOUD_TOP - CLOUD_BOTTOM),
            0,
            1,
          );
          // source radiance: sun (phase-weighted, self-occluded) + sky ambient.
          // Ambient height ramp 0.45+0.55·hn → 0.16+0.84·hn: a cloud base sees
          // almost no sky dome (self-occluded from above), so bases must fall
          // well below lit tops per the Trail Ridge reference (~two stops) —
          // the old 0.45 floor held the whole underside within a quarter stop
          // of the tops (measured r0: base/top 187/226). Ours lands ~1.3-1.5
          // stops, deliberately short of the ref's two: Trail Ridge is a
          // midday frame, and at this scene's low 17:00 sun real bases catch
          // warm raking light — a full two-stop base would read overcast.
          const S = sunT
            .mul(sunVis)
            .mul(phase)
            .mul(SUN_E * 3.4)
            .add(ambient.mul(hn.mul(0.84).add(0.16)).mul(0.38))
            .mul(powder.mul(0.75).add(0.25));
          const stepT = exp(dens.mul(seg).mul(-0.052));
          light.addAssign(S.mul(trans).mul(float(1).sub(stepT)));
          trans.mulAssign(stepT);
        });
      });
    });
    return { color: light, alpha: float(1).sub(trans) };
  }
}
