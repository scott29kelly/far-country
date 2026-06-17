/**
 * ?scene=newjerusalem — Phase 3, Stage 3, Milestone 1 (boot parity).
 *
 * Reuses the engine's terrain, sky, irradiance probes, shadows, water,
 * volumetrics, and post pipeline UNCHANGED, with the procedural forest
 * removed. This proves the vendored renderer drives our content path before
 * any New Jerusalem geometry exists. See docs/specs/phase-3-engine-integration.md.
 *
 * Intentionally NOT here (vs. buildTerrainScene): vegetation scatter, Forests,
 * GroundRing, canopy maps/shell, wind, particles. The New Jerusalem geometry
 * (crystal step-pyramid, jasper wall, twelve pearl gates, jewelled foundations,
 * throne glory, river of life, trees of life, the multitude) is added in M2,
 * on a leveled pad at the origin. The surrounding terrain is the "new earth"
 * landscape (Rev 21:1) — illustrative context, not a cited descriptor.
 *
 * Kept vendored modules are imported from their original paths; this file is
 * the only New Jerusalem code, kept under src/nj/ to ease upstream diffs.
 */

import { Froxels } from '../gpu/passes/Froxels';
import { ProbeGI } from '../gpu/passes/ProbeGI';
import { Heightfield } from '../world/Heightfield';
import { buildTerrainShadowProxy } from '../world/ShadowProxy';
import { TerrainTiles } from '../world/TerrainTiles';
import { WaterSurface } from '../world/WaterSurface';
import { PostStack } from '../render/PostStack';
import { setupSunShadows } from '../render/ShadowSetup';
import { Clouds } from '../sky/Clouds';
import { SunSky } from '../sky/SunSky';
import type { WorldContext } from '../debug/Scenes';
import { CITY_HALF } from './cityModel';
import { buildCityMassing } from './CityMassing';

export async function buildNewJerusalemScene(ctx: WorldContext): Promise<void> {
  const { engine, params, seed } = ctx;
  const ablate = new Set(
    (new URLSearchParams(window.location.search).get('ablate') ?? '').split(','),
  );

  // Terrain (the new earth). Reused unchanged; probes/tiles read its buffers.
  ctx.progress(0.1, 'newjerusalem: generating terrain');
  const hf = await Heightfield.generate(
    engine.renderer,
    params,
    seed,
    (p, m) => ctx.progress(p * 0.6, m),
  );
  (engine as unknown as { heightfield?: Heightfield }).heightfield = hf;

  // Physical sky first — the probe field needs the atmosphere LUTs.
  ctx.progress(0.6, 'newjerusalem: baking sky');
  const sunSky = new SunSky(engine, params.timeOfDay);
  await sunSky.init(engine.renderer);
  (engine as unknown as { sunSky?: SunSky }).sunSky = sunSky;

  // Irradiance probes with NO canopy: the city has no tree crowns, so probes
  // gather against the bare heightfield.
  ctx.progress(0.65, 'newjerusalem: gathering irradiance probes');
  const gi = new ProbeGI(hf, sunSky.atmosphere, null);
  await gi.init(engine.renderer);
  sunSky.dimAmbientForGI();
  engine.onUpdate(() => gi.tick(engine.renderer));

  // CDLOD terrain tiles + far shell (+ a shadow caster proxy).
  ctx.progress(0.72, 'newjerusalem: building terrain tiles');
  const tiles = new TerrainTiles(hf, null, { gi });
  engine.scene.add(tiles.mesh);
  engine.scene.add(tiles.farShell);
  if (!ablate.has('proxy')) engine.scene.add(buildTerrainShadowProxy(hf));
  engine.onUpdate(() => {
    tiles.update(engine.camera);
    engine.stats.counters['terrain.tiles'] = tiles.activeTiles;
  });

  // Stream/lake water clipmap (?ablate=water to A/B). No canopy.
  if (!ablate.has('water')) {
    const water = new WaterSurface(
      hf,
      sunSky.atmosphere,
      null,
      ablate.has('gi') ? null : gi,
    );
    engine.scene.add(water.group);
    engine.onUpdate(() => water.update(engine.camera));
  }

  // Volumetric clouds (noise bake + sun-shadow map), drifting on world time.
  ctx.progress(0.8, 'newjerusalem: baking clouds');
  const clouds = new Clouds(sunSky.atmosphere);
  await clouds.init(engine.renderer);
  let lastWt = 0;
  engine.onUpdate((_dt, wt) => {
    clouds.tick(engine.renderer, wt - lastWt);
    lastWt = wt;
  });

  // 4-cascade CSM + PCSS; cloud shadows gate the sun term.
  const shadowRig = setupSunShadows(sunSky.sun, engine.camera, (wxz) =>
    clouds.shadowAt(wxz),
  );
  (window as unknown as { __laasDbg?: Record<string, unknown> }).__laasDbg = {
    engine,
    sunSky,
    shadowRig,
  };

  // Froxel volumetrics: valley fog / light shafts (?ablate=froxels). No canopy.
  let froxels: Froxels | null = null;
  if (!ablate.has('froxels')) {
    froxels = new Froxels(hf, sunSky.atmosphere, null, clouds);
    const fx = froxels;
    engine.onUpdate(() => fx.update(engine.renderer, engine.camera));
  }

  // HDR post: aerial perspective, clouds, GTAO, TRAA, bloom, exposure, grade.
  ctx.progress(0.9, 'newjerusalem: building post pipeline');
  const post = new PostStack(engine, sunSky.atmosphere, params.timeOfDay, clouds, froxels);
  engine.post = post;

  ctx.hooks.setTimeOfDay = (t: number) => {
    void (async () => {
      await sunSky.setTimeOfDay(t);
      await clouds.refreshShadow(engine.renderer);
      gi.invalidate();
      post.setTimeOfDay(t);
    })();
  };

  ctx.hooks.groundProbe = (x, z) => ({
    ground: hf.heightAtCpu(x, z),
    water: hf.waterYAtCpu(x, z),
  });

  // New Jerusalem geometry (M2). Placed at the origin; the city's local y = 0
  // sits on the base-platform top, resting on the new-earth terrain.
  ctx.progress(0.95, 'newjerusalem: building the city');
  const cityGroundY = hf.heightAtCpu(0, 0);
  const city = buildCityMassing();
  city.position.set(0, cityGroundY, 0);
  engine.scene.add(city);

  // Camera spawn: an establishing view from south of the wall, looking north up
  // the cascade meridian toward the throne, lifted to take in the pyramid.
  if (params.cam === null) {
    const camPose: { p: [number, number, number]; yaw: number; pitch: number } = {
      p: [0, cityGroundY + 46, CITY_HALF + 110],
      yaw: 0, // 0 = looking -Z (north), toward the city
      pitch: -0.05,
    };
    ctx.hooks.initialPose = camPose;
    ctx.hooks.initialPoseMode = 'fly';
    engine.camera.position.set(...camPose.p);
  }

  ctx.progress(1, 'newjerusalem ready');
}
