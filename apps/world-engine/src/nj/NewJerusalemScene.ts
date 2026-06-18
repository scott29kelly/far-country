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
import { ALLOT_X, ALLOT_Z_NORTH, ALLOT_Z_SOUTH, buildHolyAllotment } from './Allotment';

export async function buildNewJerusalemScene(ctx: WorldContext): Promise<void> {
  const { engine, params } = ctx;

  // The new earth: the engine's complete, detailed procedural landscape.
  // Reused unchanged so the world here is exactly the ?scene=world quality bar.
  await buildTerrainScene(ctx);

  // Place the Holy Allotment (the lifted plain carrying the city) at the origin.
  // buildTerrainScene stashes the generated heightfield on the engine; read it
  // back for ground height, then lift the plateau above the local terrain.
  const hf = (engine as unknown as { heightfield?: Heightfield }).heightfield ?? null;
  const baseY = hf ? hf.heightAtCpu(0, 0) : 0;
  const PLAIN_LIFT = 12;
  const plainTopY = baseY + PLAIN_LIFT;
  const allot = buildHolyAllotment();
  allot.position.set(0, plainTopY, 0);
  engine.scene.add(allot);

  // Walk physics: clamp to the plateau top while standing on the allotment, else
  // fall back to the procedural terrain probe buildTerrainScene installed.
  const baseProbe = ctx.hooks.groundProbe;
  ctx.hooks.groundProbe = (x, z) => {
    const base = baseProbe ? baseProbe(x, z) : { ground: baseY, water: baseY - 100 };
    const onPlain =
      x >= -ALLOT_X && x <= ALLOT_X && z >= ALLOT_Z_NORTH && z <= ALLOT_Z_SOUTH;
    return onPlain ? { ground: plainTopY, water: base.water } : base;
  };

  // Spawn on the plain, south of the city, grounded and free to roam (V toggles
  // fly), looking north up the meridian toward the city, fields, and temple.
  if (params.cam === null && hf) {
    const pose = {
      p: [0, plainTopY + 1.7, 120] as [number, number, number],
      yaw: 0, // 0 = looking -Z (north), toward the city
      pitch: 0.1, // up-tilt to take in the terraced summit
    };
    ctx.hooks.initialPose = pose;
    ctx.hooks.initialPoseMode = 'walk';
    engine.camera.position.set(...pose.p);
  }

  ctx.progress(1, 'newjerusalem ready');
}
