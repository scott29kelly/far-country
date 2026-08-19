/**
 * SunSky — time-of-day model wiring the Atmosphere into the scene:
 * sun DirectionalLight (transmittance-tinted), sky background, and IBL
 * (PMREM re-baked from the sky on ToD changes). `[` / `]` step time live.
 */

import { Color, CubeCamera, HalfFloatType, HemisphereLight, Scene, Vector3 } from 'three';
import { DirectionalLight } from 'three';
import { positionWorldDirection } from 'three/tsl';
import { CubeRenderTarget, type Renderer } from 'three/webgpu';
import type { Engine } from '../core/Engine';
import { Atmosphere, SUN_E } from './Atmosphere';

const SUN_DISTANCE = 9000;

export class SunSky {
  readonly atmosphere: Atmosphere;
  readonly sun: DirectionalLight;
  timeOfDay: number;
  private engine: Engine;
  private iblScene: Scene;
  private iblCube: CubeRenderTarget;
  private iblCam: CubeCamera;
  private renderer: Renderer | null = null;
  private iblDirty = true;
  private sunDirWorld = new Vector3();
  private hemi!: HemisphereLight;
  /** ambient floor scale: dropped to ~0.15 when probe GI is active */
  private ambientScale = 1;

  constructor(engine: Engine, initialTod: number) {
    this.engine = engine;
    this.atmosphere = new Atmosphere();
    this.timeOfDay = initialTod;
    this.sun = new DirectionalLight(0xffffff, 5);
    this.sun.castShadow = false; // shadow setup module enables + configures
    engine.scene.add(this.sun);
    engine.scene.add(this.sun.target);

    this.iblScene = new Scene();
    this.iblCube = new CubeRenderTarget(64, { type: HalfFloatType });
    this.iblCam = new CubeCamera(0.1, 50, this.iblCube);

    // Ambient stopgap until Phase-3 probe GI: sky/ground hemisphere driven by
    // the atmosphere's CPU side. Guarantees the no-black-shadows law from day
    // one even where the env-map path underdelivers.
    this.hemi = new HemisphereLight(0x9db8e8, 0x55503e, 1);
    engine.scene.add(this.hemi);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        const step = e.code === 'BracketLeft' ? -0.5 : 0.5;
        void this.setTimeOfDay((this.timeOfDay + step + 24) % 24);
        // eslint-disable-next-line no-console
        console.log(`[laas] T=${this.timeOfDay.toFixed(2)}`);
      }
    });
  }

  async init(renderer: Renderer): Promise<void> {
    this.renderer = renderer;
    await this.atmosphere.init(renderer);
    this.engine.scene.backgroundNode = this.atmosphere.backgroundNode();
    // IBL env: sky only — the sun's direct term comes from the DirectionalLight
    this.iblScene.backgroundNode = this.atmosphere.skyColor(
      positionWorldDirection.normalize(),
    );
    await this.setTimeOfDay(this.timeOfDay);
  }

  /**
   * hours [0,24) → sun world direction (world axes: +x east, +z south —
   * NE-mountain world, sun arcs S).
   *
   * GA-3 round 1: the old stylized sine arc (daylight 5.4–20.6, peak
   * 0.935 rad) put the 17:00 sun at 34.7° elevation — the round-0 critic
   * measured "reads as 12:30" against the approved late-afternoon reference
   * set (shots/ref/sky/, all Canyonlands evening shots). Replaced with the
   * physical equinox solar path at the references' latitude (Canyonlands,
   * 38.5° N; declination 0): sin(elev) = cos(lat)·cos(h), h the hour angle,
   * azimuth A = atan2(sin h, cos h · sin lat) west of south. Daylight runs
   * 6:00–18:00; noon peaks at 51.5°; 17:00 renders at 11.7° elevation,
   * 80.5° west of south — the low raking warm sun the reference set was
   * approved against.
   */
  static sunDirection(t: number, out: Vector3): Vector3 {
    const LAT = (38.5 * Math.PI) / 180; // Canyonlands reference latitude
    const h = ((t - 12) * Math.PI) / 12; // hour angle: 0 at solar noon
    const sinE = Math.cos(LAT) * Math.cos(h);
    const elev = Math.asin(Math.min(Math.max(sinE, -1), 1));
    // azimuth from south (+z), positive toward west (−x)
    const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(LAT));
    // night clamp kept from the old mapping: the atmosphere LUTs and the
    // `above` fade in setTimeOfDay expect the dir to bottom out just below
    // the horizon rather than swing under the world
    const y = Math.sin(Math.max(elev, -0.12));
    const c = Math.cos(Math.max(elev, -0.12));
    out.set(-Math.sin(az) * c, y, Math.cos(az) * c);
    return out.normalize();
  }

  async setTimeOfDay(t: number): Promise<void> {
    this.timeOfDay = t;
    SunSky.sunDirection(t, this.sunDirWorld);
    await this.atmosphere.setSun(this.sunDirWorld);

    const [tr, tg, tb] = this.atmosphere.sunTransmittanceCpu(this.sunDirWorld);
    const lum = 0.2126 * tr + 0.7152 * tg + 0.0722 * tb;
    const above = Math.max(0, Math.min(1, (this.sunDirWorld.y + 0.03) / 0.06));
    this.sun.intensity = SUN_E * lum * above;
    const m = Math.max(tr, tg, tb) || 1;
    this.sun.color = new Color(tr / m, tg / m, tb / m);
    this.sun.position.copy(this.sunDirWorld).multiplyScalar(SUN_DISTANCE);
    this.sun.target.position.set(0, 0, 0);

    // hemisphere ambient ≈ sky irradiance: cool zenith, warm-gray ground
    // bounce; dims and warms with the sun's transmittance through the day
    const day = above * lum;
    const warm = 1 - Math.min(1, Math.max(0, this.sunDirWorld.y * 3));
    this.hemi.intensity = SUN_E * (0.085 + 0.1 * day) * this.ambientScale;
    this.hemi.color = new Color(
      0.34 + 0.25 * warm * 0.4,
      0.45 + 0.08 * warm * 0.2,
      0.78 - 0.12 * warm,
    );
    this.hemi.groundColor = new Color(
      0.36 + 0.2 * warm,
      0.33 + 0.08 * warm,
      0.26,
    );

    this.iblDirty = true;
    await this.refreshIBL();
  }

  /** probe GI active: hemisphere becomes a small safety floor only */
  dimAmbientForGI(): void {
    this.ambientScale = 0.15;
    this.hemi.intensity *= 0.15;
  }

  /** re-bake the environment cube from the sky (ToD changes only) */
  private async refreshIBL(): Promise<void> {
    if (!this.renderer || !this.iblDirty) return;
    this.iblDirty = false;
    this.iblCam.update(this.renderer as unknown as Parameters<CubeCamera['update']>[0], this.iblScene);
    // WebGPU environment pipeline PMREMs cube textures internally
    this.engine.scene.environment = this.iblCube.texture;
    this.engine.scene.environmentIntensity = 1.0;
  }
}
