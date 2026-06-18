/**
 * ?scene=newjerusalem — the New Jerusalem on the new-earth landscape.
 *
 * Builds the engine's FULL procedural world — identical to ?scene=world /
 * buildTerrainScene: CDLOD terrain, the vegetation/forest stack (scatter,
 * forests, grass ring, canopy shell), water, physical sky, irradiance probes,
 * volumetric clouds, froxel fog, particles, wind, caustics, and the HDR post
 * pipeline — and then places the New Jerusalem on that terrain as a landmark.
 *
 * This deliberately reverses the earlier milestone, which stripped the
 * vegetation down to a bare pad. The surrounding world is the "new earth"
 * (Rev 21:1) rendered at the engine's full quality bar — illustrative context,
 * not a cited descriptor.
 *
 * The city geometry (buildCityMassing) is still placeholder massing — a gold
 * base plaza + crystal step-pyramid. Detailing it (jasper wall, twelve pearl
 * gates, jewelled foundations, throne glory, river of life, trees of life, the
 * multitude) follows in later increments. The landscape it sits in now matches
 * ?scene=world.
 */

import { buildTerrainScene } from '../debug/TerrainScene';
import type { WorldContext } from '../debug/Scenes';
import type { Heightfield } from '../world/Heightfield';
import { CITY_HALF } from './cityModel';
import { buildCityMassing } from './CityMassing';

export async function buildNewJerusalemScene(ctx: WorldContext): Promise<void> {
  const { engine, params } = ctx;

  // The new earth: the engine's complete, detailed procedural landscape.
  // Reused unchanged so the world here is exactly the ?scene=world quality bar.
  await buildTerrainScene(ctx);

  // Place the New Jerusalem at the origin, resting on the terrain. buildTerrainScene
  // stashes the generated heightfield on the engine; read it back for ground height.
  const hf = (engine as unknown as { heightfield?: Heightfield }).heightfield ?? null;
  const cityGroundY = hf ? hf.heightAtCpu(0, 0) : 0;
  const city = buildCityMassing();
  city.position.set(0, cityGroundY, 0);
  engine.scene.add(city);

  // Spawn the explorer out in the landscape, south of the city, grounded and
  // free to roam (V toggles fly), looking north toward the crystal city.
  // buildTerrainScene's default walk spawn spirals out from the origin and could
  // land inside the city footprint, so override it with a clear approach pose.
  if (params.cam === null && hf) {
    const sx = 0;
    const sz = CITY_HALF + 180;
    const groundY = hf.heightAtCpu(sx, sz);
    const pose = {
      p: [sx, groundY + 1.7, sz] as [number, number, number],
      yaw: 0, // 0 = looking -Z (north), toward the city
      pitch: 0.12, // up-tilt to take in the terraced summit on its rock mount
    };
    ctx.hooks.initialPose = pose;
    ctx.hooks.initialPoseMode = 'walk';
    engine.camera.position.set(...pose.p);
  }

  ctx.progress(1, 'newjerusalem ready');
}
