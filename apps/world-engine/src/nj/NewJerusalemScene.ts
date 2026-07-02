/**
 * ?scene=newjerusalem — the New Jerusalem on the new-earth landscape.
 *
 * Builds the engine's FULL procedural world — identical to ?scene=world /
 * buildTerrainScene: CDLOD terrain, the vegetation/forest stack (scatter,
 * forests, grass ring, canopy shell), water, physical sky, irradiance probes,
 * volumetric clouds, froxel fog, particles, wind, caustics, and the HDR post
 * pipeline — and then places the New Jerusalem on that terrain as a landmark.
 *
 * TERRAIN-INTEGRATED HOLY ALLOTMENT (ADR 0015, 2026-07-01): the plain the
 * city stands on is REAL TERRAIN, not a box. This scene selects the enlarged
 * 12.3 km detailed domain (WorldConst keys WORLD_SIZE off ?scene=) and
 * injects a broad, gently-rolling plateau rise into the heightfield +
 * far-shell via ctx.macroPatch — so the splat material, micro-displacement,
 * grass ring, debris, scatter, hydrology, probes and fog all treat the
 * Holy Allotment as land. Willis's hero composition drives the art
 * direction: "elevated green land… verdant and gently rolling, with
 * scattered trees and meadow", ringed by distant mountains.
 *
 * The surrounding world is the "new earth" (Rev 21:1) rendered at the
 * engine's full quality bar — illustrative context, not a cited descriptor.
 */

import { buildTerrainScene } from '../debug/TerrainScene';
import type { WorldContext } from '../debug/Scenes';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { SunSky } from '../sky/SunSky';
import type { Heightfield } from '../world/Heightfield';
import { buildHolyAllotment } from './Allotment';
import { NJ_SCALE, PLATEAU_Y, RIM, RIM_CLIFF } from './rimModel';
import { riverSurfaceLocalY } from './RiverOfLife';
import { buildTreesOfLife } from './TreesOfLife';

export async function buildNewJerusalemScene(ctx: WorldContext): Promise<void> {
  const { engine, params } = ctx;

  // Front-light the city. The sun arcs east → south → west across the day, so
  // only in the AFTERNOON does it swing into the south and rake the city's
  // south face — which is the face the primary spawn/establishing view looks
  // at (the walker spawns south of the city, looking north). T=17 keeps the
  // bright "high-key daytime" mood (Willis's establishing note) while lighting
  // the gold faces and arches so the city reads as glowing. A user ?T= wins.
  // Set BEFORE buildTerrainScene so probes, sky LUTs, and sun bake at this sun.
  if (!new URLSearchParams(window.location.search).has('T')) {
    params.timeOfDay = 17.0;
  }

  // --- the Holy Allotment as authored geography (ADR 0015 + 0016) -------------
  // A broad rise whose flat core carries the city + forecourt; the open plain
  // rolls gently; the RIM is a stratified mesa edge (ADR 0016, USER-REFS
  // directive #2) dropping to the wild terrain. The whole footprint
  // (compressed Willis proportions — placeholder per ADR 0009 rule 6) fits
  // inside the far shell; the city + approach + the south rim's whole cliff
  // band sit inside the detailed ring. Geometry constants live in
  // rimModel.ts, shared with the CPU rim scanner so they cannot drift.
  ctx.macroPatch = (mp) => {
    mp.plateau = {
      c: [RIM.cx, RIM.cz],
      half: [RIM.hx, RIM.hz],
      cornerR: RIM.cornerR,
      y: PLATEAU_Y,
      falloff: 1900, // unused while cliff is set; kept for the no-cliff path
      // flat core: city (±2000) + gold forecourt (±2320) + margin
      flatC: [0, 150],
      flatHalf: [2750, 2850],
      flatFalloff: 950,
      rollAmp: 13,
      // Willis directive #2 — water at the approach: a shallow basin SE of
      // the spawn that the hydrology fills as a meadow pond
      basin: { c: [1150, 3550], r: 520, depth: 9 },
      cliff: { ...RIM_CLIFF },
    };
  };

  // Keep-out rects for the procedural scatter: only where BUILT content
  // stands. The meadow, groves and treelines claim everything else —
  // "scattered trees and meadow" (Willis) instead of a blanket exclusion.
  ctx.scatterExclude = [
    // city + gold forecourt (spawn meadow begins just south of the plaza)
    [-2600, 2600, -2600, 2380],
    // processional approach: open meadow sightline from the spawn to the
    // south gate (grass still grows here — only trees/rocks stay out)
    [-450, 450, 2380, 3300],
    // dwelling grid + temple campus (north plain)
    [-6300, 6300, -10400, -5000],
  ];

  // The new earth: the engine's complete, detailed procedural landscape.
  await buildTerrainScene(ctx);

  // De-haze the city MODERATELY. With a real landscape restored, keep more
  // of the atmosphere's depth layering than the old box-plateau tuning did
  // (0.08/0.55 flattened the world); the city's raised emissives still read
  // through. See ADR 0014/0015.
  const sunSky = (engine as unknown as { sunSky?: SunSky }).sunSky;
  if (sunSky) {
    sunSky.atmosphere.aerialFogK.value = 0.12;
    sunSky.atmosphere.aerialClarity.value = 0.35;
  }

  // Place the built content ON the terrain plateau. The flat core makes the
  // city trivial; outlying content (dwellings, temple) snaps per-object to
  // the rolling ground via the sampler.
  const hf = (engine as unknown as { heightfield?: Heightfield }).heightfield ?? null;
  const gi = (engine as unknown as { gi?: ProbeGI }).gi ?? null;
  const coreY = hf ? hf.heightAtCpu(0, 0) : PLATEAU_Y;
  // the gold plaza rides 2.8 m proud of the meadow: covers the flat core's
  // residual roll (±2 m) + terrain micro-displacement, and reads as a raised
  // street-of-gold platform
  const plazaTopY = coreY + 2.8;
  const allot = buildHolyAllotment(
    hf
      ? (lx, lz) => (hf.heightAtCpu(lx * NJ_SCALE, lz * NJ_SCALE) - plazaTopY) / NJ_SCALE
      : undefined,
    { gi, hf, atm: sunSky?.atmosphere ?? null },
  );
  allot.scale.setScalar(NJ_SCALE);
  allot.position.set(0, plazaTopY, 0);
  engine.scene.add(allot);

  // The hydrology underwater guard can't see the authored river — wrap the
  // terrain groundProbe with the analytic reach table so the walker's eye
  // stays above the crystal water (same wade clearance as terrain water).
  const baseProbe = ctx.hooks.groundProbe;
  if (baseProbe) {
    ctx.hooks.groundProbe = (x, z) => {
      const g = baseProbe(x, z);
      const local = riverSurfaceLocalY(x / NJ_SCALE, z / NJ_SCALE);
      if (local <= -1e5) return g;
      return { ground: g.ground, water: Math.max(g.water, local * NJ_SCALE + plazaTopY) };
    };
  }

  // Trees of life flanking the river's approach reach (Rev 22:2) — real
  // trees from the engine's own pipeline, placed in WORLD space (the ×20
  // allotment scale would distort them). Null when veg is ablated.
  const treesOfLife = await buildTreesOfLife(ctx);
  if (treesOfLife) engine.scene.add(treesOfLife);

  // Walk physics: the heightfield IS the plateau now — the terrain scene's
  // own groundProbe handles everything (no special-case override).

  // Spawn on the meadow south of the city, grounded and free to roam (V
  // toggles fly), looking north up the meridian at the terraced holy
  // mountain rising over the plain.
  if (params.cam === null && hf) {
    // east bank of the river, ~2.2 km out on the approach meadow: far enough
    // that the whole terraced mountain-city fits the view rising over the
    // plain (Willis's hero composition), with the river and approach pond
    // leading the eye to the south gate
    const spawnX = 350;
    const spawnZ = 4150;
    const pose = {
      p: [spawnX, hf.heightAtCpu(spawnX, spawnZ) + 1.7, spawnZ] as [number, number, number],
      yaw: 0, // 0 = looking -Z (north); the gate reads slightly left
      pitch: 0.22, // up-tilt to the summit glory
    };
    ctx.hooks.initialPose = pose;
    ctx.hooks.initialPoseMode = 'walk';
    engine.camera.position.set(...pose.p);
  }

  ctx.progress(1, 'newjerusalem ready');
}
