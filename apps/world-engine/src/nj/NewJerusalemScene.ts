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

  // Front-light the city. The sun arcs east → south → west across the day, so
  // only in the AFTERNOON does it swing into the south and rake the city's
  // south face — which is the face the primary spawn/establishing view looks
  // at (the walker spawns south of the city, looking north). The engine
  // default (T=11, late-morning ESE sun) TOP-lights the terraces into a flat,
  // washed silhouette that dissolves into the bright sky. T=17 keeps the bright
  // "high-key daytime" mood (Willis's establishing note) while lighting the
  // gold faces and arches so the city reads as glowing — the single biggest
  // lever on the wash. A user ?T= still wins. Set BEFORE buildTerrainScene so
  // the probe GI, sky LUTs, and sun all bake consistently at this sun.
  if (!new URLSearchParams(window.location.search).has('T')) {
    params.timeOfDay = 17.0;
  }

  // Citywide scale ramp toward Willis's ~12-mile New Jerusalem (she reads Rev
  // 21:16's 12,000 stadia as the AREA of the square base → ~12 mi/side, height
  // ≈ base). The whole composition scales uniformly from this one factor; tuned
  // by eye against screenshots. At citywide scale the plateau dominates the
  // detailed terrain and the forest reads on the far-shell foothills beyond.
  // The user deliberately targets ~2-3 mi (NOT the literal 12 mi, which becomes
  // an unviewable sky-wall); 16 ~= 2 mi base, 24 ~= 3 mi. See ADR 0014.
  const NJ_SCALE = 20; // ~2.5 mi base (mid of the 2-3 mi band, art-director call)

  // Keep the procedural forest/rock scatter off the Holy Allotment footprint so
  // the city sits on a clean plain rather than in a pine forest. Must be set
  // BEFORE buildTerrainScene runs the scatter; scaled to the enlarged plateau.
  ctx.scatterExclude = [
    -ALLOT_X * NJ_SCALE,
    ALLOT_X * NJ_SCALE,
    ALLOT_Z_NORTH * NJ_SCALE,
    ALLOT_Z_SOUTH * NJ_SCALE,
  ];

  // The new earth: the engine's complete, detailed procedural landscape.
  // Reused unchanged so the world here is exactly the ?scene=world quality bar.
  await buildTerrainScene(ctx);

  // De-haze the city. At citywide distance the boundary-layer aerial haze
  // washes the New Jerusalem toward the sky tone, so it reads pale instead of
  // as the brightest thing (Rev 21:23 — "the glory of God gives it light").
  // Pull that humid term back HARD for this scene only; ?scene=world keeps the
  // tuned default (0.22). The thinner air lets the city's self-glow (raised in
  // CityMassing) and its saturated gold read THROUGH the atmosphere — the part
  // of the wash the per-frame auto-exposure cannot compensate for. See ADR 0014.
  const sunSky = (engine as unknown as {
    sunSky?: { atmosphere: { aerialFogK: { value: number }; aerialClarity: { value: number } } };
  }).sunSky;
  if (sunSky) {
    sunSky.atmosphere.aerialFogK.value = 0.08; // thin the humid valley haze
    sunSky.atmosphere.aerialClarity.value = 0.55; // de-haze ALL aerial terms 55%
  }

  // Place the Holy Allotment (the lifted plain carrying the city) at the origin.
  // buildTerrainScene stashes the generated heightfield on the engine; read it
  // back for ground height, then lift the plateau above the local terrain.
  const hf = (engine as unknown as { heightfield?: Heightfield }).heightfield ?? null;
  const baseY = hf ? hf.heightAtCpu(0, 0) : 0;
  const PLAIN_LIFT = 12;
  const plainTopY = baseY + PLAIN_LIFT;
  const allot = buildHolyAllotment();
  allot.scale.setScalar(NJ_SCALE);
  allot.position.set(0, plainTopY, 0);
  engine.scene.add(allot);

  // Walk physics: clamp to the plateau top while standing on the allotment, else
  // fall back to the procedural terrain probe buildTerrainScene installed.
  const baseProbe = ctx.hooks.groundProbe;
  ctx.hooks.groundProbe = (x, z) => {
    const base = baseProbe ? baseProbe(x, z) : { ground: baseY, water: baseY - 100 };
    const onPlain =
      x >= -ALLOT_X * NJ_SCALE &&
      x <= ALLOT_X * NJ_SCALE &&
      z >= ALLOT_Z_NORTH * NJ_SCALE &&
      z <= ALLOT_Z_SOUTH * NJ_SCALE;
    return onPlain ? { ground: plainTopY, water: base.water } : base;
  };

  // Spawn on the plain, south of the city, grounded and free to roam (V toggles
  // fly), looking north up the meridian toward the city, fields, and temple.
  if (params.cam === null && hf) {
    // Stand on the plain south of the now city-scale New Jerusalem, looking
    // north and up at the terraced holy mountain rising above the land.
    const cityHalf = 100 * NJ_SCALE;
    const pose = {
      p: [0, plainTopY + 1.7, cityHalf + 500] as [number, number, number],
      yaw: 0, // 0 = looking -Z (north), toward the city
      pitch: 0.32, // steeper up-tilt — the summit is far overhead now
    };
    ctx.hooks.initialPose = pose;
    ctx.hooks.initialPoseMode = 'walk';
    engine.camera.position.set(...pose.p);
  }

  ctx.progress(1, 'newjerusalem ready');
}
