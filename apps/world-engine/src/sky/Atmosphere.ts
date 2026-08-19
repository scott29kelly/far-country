/**
 * Physical sky — Hillaire-style LUT atmosphere (units: kilometers).
 *
 *  - transmittance LUT (256×64): optical depth to atmosphere top
 *  - multiple-scattering LUT (32×32): isotropic 2nd-order Ψ term
 *  - sky-view LUT (192×108): full in-scatter panorama around the camera,
 *    re-baked whenever the sun moves (time of day)
 *
 * Provides: background node (sky + limb-darkened sun disc), aerial
 * perspective (applied in post from depth), CPU sun transmittance for the
 * DirectionalLight color, and an IBL refresh hook.
 */

import { Vector3 } from 'three';
import type { ComputeNode, Renderer } from 'three/webgpu';
import { StorageTexture } from 'three/webgpu';
import { HalfFloatType } from 'three';
import {
  Fn,
  sign,
  If,
  Loop,
  Return,
  asin,
  atan,
  clamp,
  cos,
  exp,
  float,
  instanceIndex,
  max,
  mix,
  positionWorldDirection,
  pow,
  sin,
  smoothstep,
  sqrt,
  texture,
  textureStore,
  uniform,
  uvec2,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import { vexp3 } from '../gpu/TSLTypes';
import type { NF, NI, NV2, NV3 } from '../gpu/TSLTypes';

// --- physical constants (km) --------------------------------------------------
const RG = 6360; // ground radius
const RT = 6460; // atmosphere top
const HR = 8.0; // rayleigh scale height
const HM = 1.2; // mie scale height
// rayleigh standard; mie boosted ~2.4× over the clean-air baseline — the
// references are humid scenes with pronounced horizon haze and depth layering
const BETA_R: [number, number, number] = [5.802e-3, 13.558e-3, 33.1e-3];
const BETA_M_S = 9.6e-3;
const BETA_M_E = 1.07e-2;
const BETA_O: [number, number, number] = [0.65e-3, 1.881e-3, 0.085e-3];
const MIE_G = 0.8;
// 3x the physical 0.265° radius: games oversize the disc — at true scale
// it reads as a tiny dot (user feedback batch 2 item 10). Disc radiance is
// dimmed below to keep total flux (and the bloom response) in range.
const SUN_ANGULAR_RADIUS = 0.014;

const T_W = 256;
const T_H = 64;
const MS_RES = 32;
const SV_W = 192;
const SV_H = 108;

/**
 * Sun irradiance at the top of atmosphere in RENDER UNITS. LUTs are baked
 * with E=1; every sky/aerial sample is scaled by this, and the sun
 * DirectionalLight uses the same constant — one knob keeps sun:sky physical.
 */
export const SUN_E = 8.0;

// --- TSL atmosphere helpers ----------------------------------------------------

const betaR = vec3(...BETA_R);
const betaO = vec3(...BETA_O);

function densities(h: NF): { dr: NF; dm: NF; doz: NF } {
  const dr = exp(h.div(-HR));
  const dm = exp(h.div(-HM));
  // stratospheric tent (Bruneton 10–25–40 km) + a boundary-layer floor.
  // GA-3 r4: with ozone zero below 10 km, a near-horizontal ray from flight
  // altitude runs ~180 km of pure rayleigh+mie — blue extinguishes, green
  // survives, and the whole horizon band graded GREEN-grey (measured
  // G > R and G > B in the aerial band). Real horizon bands stay pink-blue
  // because Chappuis-band ozone absorbs green-red along exactly these long
  // grazing paths. Floor 0.32·exp(−h/6): τ_G ≈ 0.09 over a 180 km grazing
  // path (kills the green hump) but < 0.006 on any vertical path — zenith
  // and mid-elevation sky are untouched, as is the sun disc (~40 km path).
  const doz = max(0, float(1).sub(h.sub(25).abs().div(15))).max(
    exp(h.div(-6)).mul(0.32),
  );
  return { dr, dm, doz };
}

/** distance from (r, mu) to the atmosphere top along the ray */
function distToTop(r: NF, mu: NF): NF {
  const disc = r.mul(r).mul(mu.mul(mu).sub(1)).add(RT * RT);
  return max(0, r.negate().mul(mu).add(sqrt(max(0, disc))));
}

/** distance to ground, or -1 if the ray misses */
function distToGround(r: NF, mu: NF): NF {
  const disc = r.mul(r).mul(mu.mul(mu).sub(1)).add(RG * RG);
  const d = r.negate().mul(mu).sub(sqrt(max(0, disc)));
  return disc.lessThan(0).or(d.lessThan(0)).select(float(-1), d);
}

/** transmittance LUT uv from (r, mu) — Bruneton mapping */
function transmittanceUv(r: NF, mu: NF): NV2 {
  const H = Math.sqrt(RT * RT - RG * RG);
  const rho = sqrt(max(0, r.mul(r).sub(RG * RG)));
  const d = distToTop(r, mu);
  const dMin = float(RT).sub(r);
  const dMax = rho.add(H);
  const xMu = d.sub(dMin).div(dMax.sub(dMin));
  const xR = rho.div(H);
  return vec2(clamp(xMu, 0, 1), clamp(xR, 0, 1));
}

const RAYLEIGH_PHASE_K = 3 / (16 * Math.PI);

function rayleighPhase(nu: NF): NF {
  return nu.mul(nu).add(1).mul(RAYLEIGH_PHASE_K);
}

/** Cornette–Shanks */
function miePhase(nu: NF): NF {
  const g = MIE_G;
  const g2 = g * g;
  const k = (3 / (8 * Math.PI)) * ((1 - g2) / (2 + g2));
  const num = nu.mul(nu).add(1);
  const den = pow(float(1 + g2).sub(nu.mul(2 * g)), 1.5);
  return num.div(den).mul(k);
}

export class Atmosphere {
  readonly transmittanceLUT: StorageTexture;
  readonly multiScatterLUT: StorageTexture;
  readonly skyViewLUT: StorageTexture;
  /** sun direction (world, normalized, y up) */
  readonly sunDir = uniform(new Vector3(0.3, 0.6, 0.2).normalize());
  /**
   * Boundary-layer (humid valley) haze extinction at the reference height, per
   * km — the dominant near-ground term of the aerial perspective. Default 0.22
   * is the tuned humid look for ?scene=world; scenes may pull it back (the New
   * Jerusalem does, so the city reads as glowing THROUGH clearer air per
   * Rev 21:23 rather than dissolving into the wash at citywide distance).
   */
  readonly aerialFogK = uniform(0.22);
  /**
   * Scene clarity (0..1): lerps the aerial transmittance toward 1, de-hazing
   * ALL terms (rayleigh + mie + fog) uniformly. 0 = full physical haze
   * (?scene=world default). The New Jerusalem raises it so the city keeps its
   * saturated colour and glow at citywide distance instead of bleaching toward
   * the sky tone — the desaturating veil is the part of the wash that the
   * per-frame auto-exposure cannot undo (exposure only rescales brightness).
   */
  readonly aerialClarity = uniform(0);
  /**
   * Sky-view LUT ray origin altitude (km above ground). GA-3 round 4: the LUT
   * was baked at a FIXED 350 m — from the aerial cam at 3.4 km every
   * below-horizon direction still marched the full boundary-layer mie soup
   * (dm at 350 m = 0.75 vs 0.06 at 3.4 km), so the whole horizon band read as
   * one murky brown wall ("no sky — murky brown-grey gradient", r3 critic).
   * trackCamera() re-bakes the panorama when the camera climbs/descends past
   * a threshold; at altitude the horizon grades physically — thin blue air
   * above, a warm sunlit veil pooling low — because the ray origin now sits
   * above the dense layer instead of inside it.
   */
  private readonly camAltKm = uniform(0.35);
  private lastBakedAltKm = 0.35;
  private renderer: Renderer | null = null;
  private skyCompute: ComputeNode | null = null;

  constructor() {
    this.transmittanceLUT = this.makeLUT(T_W, T_H);
    this.multiScatterLUT = this.makeLUT(MS_RES, MS_RES);
    this.skyViewLUT = this.makeLUT(SV_W, SV_H);
    // tuning/ablation overrides (house ?fog=/?cov= idiom): ?afog=N sets the
    // boundary-layer haze K, ?aclar=N the clarity lerp — ?aclar=1 nulls the
    // whole aerial term (T=1), the bisect probe for "is this wash aerial?"
    // Baked into the graph as constants at build time (aerial() runs after
    // the scene pins the uniforms, so a .value write here would be clobbered).
    const q = new URLSearchParams(window.location.search);
    const afog = Number(q.get('afog') ?? NaN);
    const aclar = Number(q.get('aclar') ?? NaN);
    if (Number.isFinite(afog)) this.afogOverride = afog;
    if (Number.isFinite(aclar)) this.aclarOverride = aclar;
  }

  private afogOverride: number | null = null;
  private aclarOverride: number | null = null;

  private makeLUT(w: number, h: number): StorageTexture {
    const t = new StorageTexture(w, h);
    t.type = HalfFloatType;
    t.generateMipmaps = false;
    return t;
  }

  /** sample transmittance toward the sun/top from radius r, cos zenith mu */
  sampleTransmittance(r: NF, mu: NF): NV3 {
    return texture(this.transmittanceLUT, transmittanceUv(r, mu)).rgb;
  }

  private sampleMultiScatter(r: NF, muS: NF): NV3 {
    const u = clamp(muS.mul(0.5).add(0.5), 0, 1);
    const v = clamp(r.sub(RG).div(RT - RG), 0, 1);
    return texture(this.multiScatterLUT, vec2(u, v)).rgb;
  }

  async init(renderer: Renderer): Promise<void> {
    this.renderer = renderer;

    // --- transmittance bake ----------------------------------------------------
    const tK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(T_W * T_H), () => {
        Return();
      });
      const x = i.mod(T_W);
      const y = i.div(T_W);
      const uv = vec2(float(x).add(0.5).div(T_W), float(y).add(0.5).div(T_H));
      const H = Math.sqrt(RT * RT - RG * RG);
      const rho = uv.y.mul(H);
      const r = sqrt(rho.mul(rho).add(RG * RG));
      const dMin = float(RT).sub(r);
      const dMax = rho.add(H);
      const d = mix(dMin, dMax, uv.x);
      const mu = d
        .lessThanEqual(1e-4)
        .select(float(1), float(H * H).sub(rho.mul(rho)).sub(d.mul(d)).div(r.mul(d).mul(2)));
      const muC = clamp(mu, -1, 1);

      const STEPS = 44;
      const dt = d.div(STEPS);
      const tau = vec3(0).toVar();
      Loop(STEPS, ({ i: si }: { readonly i: NI }) => {
        const t = float(si).add(0.5).mul(dt);
        const rx = sqrt(t.mul(t).add(r.mul(r)).add(t.mul(r).mul(muC).mul(2)));
        const h = rx.sub(RG);
        const { dr, dm, doz } = densities(h);
        tau.addAssign(
          betaR.mul(dr).add(vec3(BETA_M_E).mul(dm)).add(betaO.mul(doz)).mul(dt),
        );
      });
      textureStore(this.transmittanceLUT, uvec2(x.toUint(), y.toUint()), vec4(vexp3(tau.negate()), 1)).toWriteOnly();
    })().compute(T_W * T_H);
    tK.setName('atmoTransmittance');
    await renderer.computeAsync(tK);

    // --- multiple-scattering bake -----------------------------------------------
    // 64 uniform sphere directions (golden spiral), unrolled as constants
    const dirs: [number, number, number][] = [];
    for (let k = 0; k < 64; k++) {
      const zc = 1 - (2 * k + 1) / 64;
      const rr = Math.sqrt(Math.max(0, 1 - zc * zc));
      const phi = k * 2.399963229728653;
      dirs.push([rr * Math.cos(phi), zc, rr * Math.sin(phi)]);
    }
    const msK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(MS_RES * MS_RES), () => {
        Return();
      });
      const x = i.mod(MS_RES);
      const y = i.div(MS_RES);
      const muS = float(x).add(0.5).div(MS_RES).mul(2).sub(1);
      const r = float(y).add(0.5).div(MS_RES).mul(RT - RG).add(RG).min(RT - 0.01);
      const sunD = vec3(sqrt(max(0, float(1).sub(muS.mul(muS)))), muS, 0);

      const L2 = vec3(0).toVar();
      const fms = vec3(0).toVar();
      for (const [dx, dy, dz] of dirs) {
        const dir = vec3(dx, dy, dz);
        const mu = dir.y;
        const dGround = distToGround(r, mu);
        const dTop = distToTop(r, mu);
        const dEnd = dGround.greaterThan(0).select(dGround, dTop);
        const STEPS = 18;
        const dt = dEnd.div(STEPS);
        const T = vec3(1).toVar();
        Loop(STEPS, ({ i: si }: { readonly i: NI }) => {
          const t = float(si).add(0.5).mul(dt);
          const rx = sqrt(t.mul(t).add(r.mul(r)).add(t.mul(r).mul(mu).mul(2)));
          const h = rx.sub(RG).max(0);
          const { dr, dm, doz } = densities(h);
          const sigmaS = betaR.mul(dr).add(vec3(BETA_M_S).mul(dm));
          const sigmaE = betaR.mul(dr).add(vec3(BETA_M_E).mul(dm)).add(betaO.mul(doz));
          const muSx = rx.mul(muS).add(t.mul(dir.dot(sunD))).div(rx).clamp(-1, 1);
          const tSun = this.sampleTransmittance(rx, muSx);
          const stepT = vexp3(sigmaE.mul(dt).negate());
          // isotropic phase 1/4π; energy-conserving integration
          const Sint = sigmaS.mul(tSun).mul(1 / (4 * Math.PI));
          L2.addAssign(T.mul(Sint.sub(Sint.mul(stepT))).div(sigmaE.max(1e-6)));
          fms.addAssign(T.mul(sigmaS.sub(sigmaS.mul(stepT))).div(sigmaE.max(1e-6)));
          T.mulAssign(stepT);
        });
        // ground bounce (albedo 0.3)
        const groundHit = dGround.greaterThan(0);
        const muSg = clamp(muS, 0, 1);
        const tg = this.sampleTransmittance(float(RG + 0.01), muSg);
        L2.addAssign(groundHit.select(T.mul(tg).mul(muSg).mul(0.3 / Math.PI), vec3(0)));
      }
      const inv = 1 / 64;
      const L2a = L2.mul(inv);
      const fmsA = fms.mul(inv);
      const psi = L2a.div(max(1e-4, float(1).sub(fmsA.x.add(fmsA.y).add(fmsA.z).div(3))));
      textureStore(this.multiScatterLUT, uvec2(x.toUint(), y.toUint()), vec4(psi, 1)).toWriteOnly();
    })().compute(MS_RES * MS_RES);
    msK.setName('atmoMultiScatter');
    await renderer.computeAsync(msK);

    // --- sky-view kernel (re-run per sun change) ----------------------------------
    const svK = Fn(() => {
      const i = instanceIndex;
      If(i.greaterThanEqual(SV_W * SV_H), () => {
        Return();
      });
      const x = i.mod(SV_W);
      const y = i.div(SV_W);
      const u = float(x).add(0.5).div(SV_W);
      const v = float(y).add(0.5).div(SV_H);
      // sqrt-warped elevation: horizon detail concentrated at v=0.5
      const lRaw = v.mul(2).sub(1);
      const elev = lRaw.abs().mul(lRaw.abs()).mul(Math.PI / 2).mul(sign(lRaw));
      // azimuth relative to sun azimuth
      const sunAz = atan(this.sunDir.z, this.sunDir.x);
      const az = u.mul(2 * Math.PI).sub(Math.PI).add(sunAz);
      const dir = vec3(cos(elev).mul(cos(az)), sin(elev), cos(elev).mul(sin(az)));

      // ray origin at the CAMERA's altitude (see camAltKm above). Clamped so
      // the origin never dips into the ground row of the transmittance LUT.
      const r = float(RG).add(clamp(this.camAltKm as unknown as NF, 0.05, 60));
      const mu = dir.y;
      const dGround = distToGround(r, mu);
      const dTop = distToTop(r, mu);
      // path cap 180 km: long near-horizon paths saturate toward source-
      // function white (tried 320 at altitude — the whole band bleached to
      // grey; 180 keeps the horizon veil WARM-BLUE and graded, and the
      // truncation error hides under the ground/terrain silhouette anyway)
      const dEnd = dGround.greaterThan(0).select(dGround, dTop).min(180);

      const sunDirN = this.sunDir.normalize();
      const nu = dir.dot(sunDirN).clamp(-1, 1);
      const pR = rayleighPhase(nu);
      const pM = miePhase(nu);

      const STEPS = 40;
      const dt = dEnd.div(STEPS);
      const L = vec3(0).toVar();
      const T = vec3(1).toVar();
      Loop(STEPS, ({ i: si }: { readonly i: NI }) => {
        const t = float(si).add(0.5).mul(dt);
        const rx = sqrt(t.mul(t).add(r.mul(r)).add(t.mul(r).mul(mu).mul(2)));
        const h = rx.sub(RG).max(0);
        const { dr, dm, doz } = densities(h);
        const sigmaSR = betaR.mul(dr);
        const sigmaSM = vec3(BETA_M_S).mul(dm);
        const sigmaE = betaR.mul(dr).add(vec3(BETA_M_E).mul(dm)).add(betaO.mul(doz)).max(1e-9);
        const muSx = rx.mul(sunDirN.y).add(t.mul(nu)).div(rx).clamp(-1, 1);
        const tSun = this.sampleTransmittance(rx, muSx);
        const psi = this.sampleMultiScatter(rx, muSx);
        const S = sigmaSR
          .mul(pR)
          .add(sigmaSM.mul(pM))
          .mul(tSun)
          .add(psi.mul(sigmaSR.add(sigmaSM)));
        const stepT = vexp3(sigmaE.mul(dt).negate());
        L.addAssign(T.mul(S.sub(S.mul(stepT))).div(sigmaE));
        T.mulAssign(stepT);
      });
      // rays that hit ground: add sun-lit distant land (hazy luminous horizon,
      // not a black void below the horizon line)
      const hitGround = dGround.greaterThan(0);
      const muSg = clamp(sunDirN.y, 0, 1);
      const tSunG = this.sampleTransmittance(float(RG + 0.05), muSg);
      const groundL = T.mul(tSunG).mul(muSg).mul(0.32 / Math.PI);
      L.addAssign(hitGround.select(groundL, vec3(0)));
      textureStore(this.skyViewLUT, uvec2(x.toUint(), y.toUint()), vec4(L, 1)).toWriteOnly();
    })().compute(SV_W * SV_H);
    svK.setName('atmoSkyView');
    this.skyCompute = svK;
    await renderer.computeAsync(svK);
  }

  /** point the sun (unit world dir) and re-bake the sky-view LUT */
  async setSun(dir: Vector3): Promise<void> {
    this.sunDir.value.copy(dir).normalize();
    if (this.renderer && this.skyCompute) {
      await this.renderer.computeAsync(this.skyCompute);
    }
  }

  /**
   * Per-frame altitude tracking (called by the post stack with the scene
   * camera): re-bake the sky-view panorama when the camera has climbed or
   * descended enough to change what the horizon looks like. Threshold is
   * RELATIVE (12%) with a 40 m floor: at walk height (300–500 m) it never
   * fires during normal play; a flight to the aerial vantage re-bakes a
   * handful of times on the way up. The bake itself is 192×108×40 steps —
   * far below one shadow cascade, safe to run inline on a frame.
   */
  trackCamera(altM: number): void {
    if (!this.renderer || !this.skyCompute) return;
    const altKm = Math.min(60, Math.max(0.05, altM / 1000));
    const dead = Math.max(0.04, this.lastBakedAltKm * 0.12);
    if (Math.abs(altKm - this.lastBakedAltKm) < dead) return;
    this.camAltKm.value = altKm;
    this.lastBakedAltKm = altKm;
    this.renderer.compute(this.skyCompute);
  }

  /** sample the sky-view LUT for an arbitrary world direction */
  skyColor(dir: NV3): NV3 {
    const elev = asin(clamp(dir.y, -1, 1));
    const lRaw = elev.div(Math.PI / 2);
    const v = sqrt(lRaw.abs()).mul(sign(lRaw)).mul(0.5).add(0.5);
    const sunAz = atan(this.sunDir.z, this.sunDir.x);
    const az = atan(dir.z, dir.x).sub(sunAz);
    const u = az.div(2 * Math.PI).add(0.5).fract();
    return texture(this.skyViewLUT, vec2(u, v)).rgb.mul(SUN_E);
  }

  /** full background: sky + transmittance-tinted, limb-darkened sun disc */
  backgroundNode(): NV3 {
    const dir = positionWorldDirection.normalize();
    const sky = this.skyColor(dir);
    const sunDirN = this.sunDir.normalize();
    const cosA = dir.dot(sunDirN);
    const cosR = Math.cos(SUN_ANGULAR_RADIUS);
    const inDisc = smoothstep(cosR, cosR + 0.00008, cosA);
    const centerT = clamp(
      cosA.sub(cosR).div(1 - cosR),
      0,
      1,
    );
    const limb = pow(centerT, 0.45).mul(0.55).add(0.45);
    const tSun = this.sampleTransmittance(float(RG + 0.35), clamp(sunDirN.y, -1, 1));
    const sunL = tSun.mul(limb).mul(inDisc).mul(50 * SUN_E);
    return sky.add(sunL);
  }

  /**
   * Aerial perspective for post: altitude-aware analytic atmosphere PLUS a
   * boundary-layer haze term (humid valley mist — the references' depth
   * layering is this, not clean-air rayleigh, which is subtle under 15 km).
   */
  aerial(color: NV3, viewDir: NV3, camAltKm: NF, distKm: NF): NV3 {
    const fragAlt = camAltKm.add(viewDir.y.mul(distKm)).max(0);
    const hAvg = camAltKm.add(fragAlt).mul(0.5).max(0.02);
    const dr = exp(hAvg.div(-HR));
    const dm = exp(hAvg.div(-HM));
    const tauR = betaR.mul(dr).mul(distKm);
    const tauM = float(BETA_M_E).mul(dm).mul(distKm);

    // boundary-layer fog: density k·exp(−(h−h0)/Hf); exact path integral.
    // FOG_K is a uniform (scene-settable — see aerialFogK); H0/HF are fixed.
    const FOG_H0 = 0.16; // reference altitude (≈ valley floor), km
    const FOG_HF = 0.38; // scale height, km
    const y0 = camAltKm.sub(FOG_H0).div(FOG_HF);
    const y1 = fragAlt.sub(FOG_H0).div(FOG_HF);
    const dy = y1.sub(y0);
    const flat = dy.abs().lessThan(1e-4);
    const integ = flat.select(
      exp(y0.negate()).mul(distKm),
      exp(y0.negate()).sub(exp(y1.negate())).div(dy).mul(distKm),
    );
    const fogKNode =
      this.afogOverride !== null ? float(this.afogOverride) : (this.aerialFogK as unknown as NF);
    const tauF = integ.mul(fogKNode).max(0);

    // scene clarity lerps transmittance toward 1 (de-haze); 0 keeps the full
    // physical haze. Applied per-scene so the city can read through clear air.
    const clarNode =
      this.aclarOverride !== null
        ? float(this.aclarOverride)
        : (this.aerialClarity as unknown as NF);
    // In-scatter tint: sample the sky-view LUT at a HORIZON-CLAMPED direction,
    // never below it. GA-3 round 4: below-horizon LUT texels hold the distant-
    // land radiance (the marched brown-warm ground band) — feeding that back
    // as the haze color meant every downward ray tinted terrain toward mud,
    // and the tint JUMPED color exactly at the screen's horizon line, printing
    // the "horizontal veil that starts and stops abruptly" the critic flagged
    // (proven by ?aclar=1: veil band + the near-forest brown wash both vanish).
    // 0.015 rad ≈ 0.9° above horizon: the warmest legitimate sky the LUT has —
    // haze now grades smoothly with the reference's warm horizon light and
    // cools upward with elevation instead of switching source texture.
    const hazeDir = vec3(viewDir.x, viewDir.y.max(0.015), viewDir.z).normalize();
    const sky = this.skyColor(hazeDir);

    // GA-3 r4 — the fog is COMPOSITED SEPARATELY with its own, dimmer source.
    // The old single-T formulation gave the boundary-layer mist the same
    // in-scatter radiance as the km-scale atmosphere: the full near-horizon
    // sky ring. That ring is 10–20× brighter than shaded foliage, so even the
    // 2–3% wash a few hundred meters of mist produces dragged every dark
    // crown toward glowing tan (?afog=0 turned the forest green again). A
    // real ground-hugging parcel can't SEE the horizon ring — terrain blocks
    // it; its illumination is the upper sky dome plus the sun-warmed veil.
    // Source model: mix(zenith, horizon-sky, 0.45) ≈ hemispheric mean of the
    // dome as seen from inside the boundary layer — roughly half the horizon
    // ring's radiance and cooler, so short-range mist DESATURATES instead of
    // glowing, while 5–15 km paths still pool into the references' warm veil.
    const Ta = vexp3(tauR.add(tauM).negate());
    const TaC = Ta.add(vec3(1).sub(Ta).mul(clarNode));
    const TfPhys = exp(tauF.negate());
    const Tf = TfPhys.add(float(1).sub(TfPhys).mul(clarNode));
    const fogSky = mix(this.skyColor(vec3(0, 1, 0)), sky, 0.45);
    // near-to-far compositing: mist first (it hugs the ground between the
    // camera and the fragment), then the clean-air atmosphere over the result
    const fogged = color.mul(Tf).add(fogSky.mul(float(1).sub(Tf)));
    // per-channel energy exchange: blue extinguishes first → haze reads blue
    return fogged.mul(TaC).add(sky.mul(vec3(1).sub(TaC)));
  }

  /** CPU transmittance toward the sun at ground level (for light color) */
  sunTransmittanceCpu(sunDir: Vector3): [number, number, number] {
    const r = RG + 0.35;
    const mu = Math.max(-1, Math.min(1, sunDir.y));
    const disc = r * r * (mu * mu - 1) + RT * RT;
    const d = Math.max(0, -r * mu + Math.sqrt(Math.max(0, disc)));
    const N = 40;
    const dt = d / N;
    const tau = [0, 0, 0];
    for (let s = 0; s < N; s++) {
      const t = (s + 0.5) * dt;
      const rx = Math.sqrt(t * t + r * r + 2 * t * r * mu);
      const h = Math.max(0, rx - RG);
      const drD = Math.exp(-h / HR);
      const dmD = Math.exp(-h / HM);
      // keep the CPU sun-transmittance in lockstep with the GPU densities()
      // (boundary-layer ozone floor — see densities() derivation)
      const dozD = Math.max(
        Math.max(0, 1 - Math.abs(h - 25) / 15),
        0.32 * Math.exp(-h / 6),
      );
      for (let c = 0; c < 3; c++) {
        tau[c] =
          (tau[c] as number) +
          ((BETA_R[c] as number) * drD + BETA_M_E * dmD + (BETA_O[c] as number) * dozD) * dt;
      }
    }
    return [Math.exp(-(tau[0] as number)), Math.exp(-(tau[1] as number)), Math.exp(-(tau[2] as number))];
  }
}
