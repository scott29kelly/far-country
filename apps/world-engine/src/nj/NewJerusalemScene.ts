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

import { Vector3 } from 'three';
import { buildTerrainScene } from '../debug/TerrainScene';
import type { WorldContext } from '../debug/Scenes';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { SunSky } from '../sky/SunSky';
import type { Heightfield } from '../world/Heightfield';
import { buildHolyAllotment } from './Allotment';
import { ALLOT_ZONES } from './allotmentZones';
import { CITY_HALF, CITY_SUMMIT_Y, GATE_OFFSETS } from './cityModel';
import { wrapGroundProbeWithCityFloors, wrapMoveWithCityCollision } from './cityCollide';
import { LEVITES_RECT, PRIESTS_RECT } from './campusModel';
import { buildDwellings } from './Dwellings';
import { buildEntityPicks, nearestEntityAt, pickEntityAt } from './entityPicks';
import { keyMarkers } from './keyModel';
import { buildPopulation } from './Population';
import { anchorFallSites, buildRimFalls, findRimFallSites } from './RimFalls';
import { NJ_SCALE, PLATEAU_Y, RIM, RIM_CLIFF } from './rimModel';
import { wrapGroundProbeWithRiver } from './RiverOfLife';
import { buildTemple } from './Temple';
import { TEMPLE_SITE } from './templeModel';
import { buildTreesOfLife } from './TreesOfLife';

export async function buildNewJerusalemScene(ctx: WorldContext): Promise<void> {
  const { engine, params } = ctx;
  // ?resizeprobe=allotment — diagnostic ablation used by tools/probe-resize.ts
  // (--ablate) to bisect render-target-lifetime regressions
  const resizeProbeAblate = new Set(
    (new URLSearchParams(window.location.search).get('resizeprobe') ?? '').split(','),
  );

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
      // managed planting on the plateau top (allotmentZones.ts): crop
      // patchwork, orchard rows, hedgerow lanes, mown approach lawn —
      // consumed by scatter/grass/splat, never by the terrain synthesis
      zones: ALLOT_ZONES,
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
    // dwelling campus + temple close (north plain) — the envelope of the
    // CITED band rects (campusModel, entry #11) + margin so wild meadow
    // runs right up to the first hedgerows; the freed plateau east/west
    // reads as the prince's unbuilt portion (Ezek 48:21-22, no spatial
    // numbers). Grass still grows here — only trees/rocks stay out.
    [
      Math.min(PRIESTS_RECT.x0, LEVITES_RECT.x0) - 150,
      Math.max(PRIESTS_RECT.x1, LEVITES_RECT.x1) + 150,
      LEVITES_RECT.z0 - 150,
      PRIESTS_RECT.z1 + 150,
    ],
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
  if (!resizeProbeAblate.has('allotment')) {
    const allot = buildHolyAllotment({ gi, hf, atm: sunSky?.atmosphere ?? null });
    allot.scale.setScalar(NJ_SCALE);
    allot.position.set(0, plazaTopY, 0);
    engine.scene.add(allot);
  }

  // The hydrology underwater guard can't see the authored river — wrap the
  // terrain groundProbe with the analytic reach table so the walker's eye
  // stays above the crystal water. The wrap itself (the claim cap, the wade
  // margins, the walker-fling story) lives with the reach table in
  // RiverOfLife.ts and is shared verbatim with tools/probe-walkfling.ts —
  // no hand-mirrored copy to desync.
  const baseProbe = ctx.hooks.groundProbe;
  if (baseProbe) {
    ctx.hooks.groundProbe = wrapGroundProbeWithRiver(baseProbe, plazaTopY, NJ_SCALE);
  }

  // Wall/gate collision (lateral): the same shared-table discipline as the
  // river wrap — cityCollide derives its volumes from cityModel's tables
  // (CITY_TIERS, GATE_*, foundationCourseSpans) and exports the REAL
  // resolver; tools/probe-wallcollide.ts composes it, no mirrors. A walker
  // passes through the twelve gate openings (Ezek 48:30-34 order,
  // RENDERING-DECISIONS #2) and stops at wall segments, the gem foundation
  // course, and tier masses. Floors stay groundProbe territory.
  ctx.hooks.moveProbe = wrapMoveWithCityCollision(plazaTopY, NJ_SCALE);

  // Trees of life flanking the river's approach reach (Rev 22:2) — real
  // trees from the engine's own pipeline, placed in WORLD space (the ×20
  // allotment scale would distort them). Null when veg is ablated.
  const treesOfLife = await buildTreesOfLife(ctx);
  if (treesOfLife) engine.scene.add(treesOfLife);

  // Ezekiel's temple (Ezek 40-42 + the 43:13-17 altar): a world-space,
  // literal-cubit compound built from the cited measurement dataset
  // (ADR 0017/0018; RENDERING-DECISIONS #7) on the priests' campus band.
  engine.scene.add(buildTemple({ hf, gi }));

  // The dwelling campus (Ezek 45:4-5; 48:10-14): human-scale garden-court
  // blocks in world space — the priests' band flanking the temple inside the
  // detailed ring, the Levites' podium band marching north across the far
  // shell (RENDERING-DECISIONS #8; USER-REFS #6; delta #6).
  const dwellings = await buildDwellings({ hf, gi, renderer: engine.renderer });
  engine.scene.add(dwellings.group);

  // Beyond the heightfield mirror the terrain groundProbe clamps to the ring
  // edge while the far shell keeps rolling — wrap it with the campus far-
  // ground sampler (same idiom as the river-surface wrap above) so walk/fly
  // grounding stays sane across the Levites' band.
  const terrainProbe = ctx.hooks.groundProbe;
  if (terrainProbe) {
    ctx.hooks.groundProbe = (x, z, y) => {
      const g = terrainProbe(x, z, y);
      const far = dwellings.farGroundAt(x, z);
      if (far === null) return g;
      // the terrain probe's water term is CLAMPED to the mirror's edge row
      // out here (a wet/high edge texel would pin the walker's wade floor
      // above the rolling shell for a whole 4 km column) — there is no
      // authored water in the band, so keep water at the dry-cell
      // convention (~2 m below the bed) relative to the shell ground
      return { ground: far, water: far - 2 };
    };
  }

  // The inhabitants (roadmap M3.6): the great multitude on the plaza and
  // terrace pavements and the angelic hosts ringing the summit — the settled
  // RENDERING-DECISIONS #3 rendering under ADR 0011/0010. World-space,
  // human-scale content (the TreesOfLife convention); placements come from
  // populationModel.ts, standing on the same floors cityFloorLocalY walks.
  engine.scene.add(buildPopulation({ gi, plazaTopY }));

  // Waterfalls off the mesa rim (ADR 0016): authored crystal ribbons at the
  // seed's REAL drainage crossings (the hydrology field cannot express
  // vertical falls); anchor sites near the basin's spill side keep the
  // south-face composition on seeds that drain nothing to the rim.
  if (hf && sunSky) {
    const emergent = findRimFallSites(hf);
    const sites = emergent.length > 0 ? emergent : anchorFallSites(hf);
    engine.scene.add(buildRimFalls(sites, hf, sunSky.atmosphere, gi));
  }

  // Walkable city floors (the debt cityCollide's header used to declare):
  // the plaza slab with its gate corridors, the plinth top, the terrace-top
  // cornice rings and the crown top become real walk floors — a walker steps
  // up through a gate onto the street of gold instead of wading chest-deep
  // under the slab. Same tables as geometry + collision; y-aware claims so
  // an 840 m terrace overhang never grabs a plaza-level walker.
  if (ctx.hooks.groundProbe) {
    ctx.hooks.groundProbe = wrapGroundProbeWithCityFloors(
      ctx.hooks.groundProbe,
      plazaTopY,
      NJ_SCALE,
    );
  }

  // Walk physics: the heightfield IS the plateau now — the terrain scene's
  // own groundProbe handles everything (no special-case override).

  // Entity picking (roadmap M3.4): click a rendered structure, get its
  // canonical dataset entity. Volumes derive from the shared owner tables
  // (entityPicks.ts); occlusion uses the BASE terrain (the composed probe's
  // river surfaces would self-occlude the river's own pick volume). The
  // EntityHud (core) consumes this hook; probes may call __laas.entityPick.
  if (hf) {
    const terrainAt = (x: number, z: number): number => hf.heightAtCpu(x, z);
    const pickVolumes = buildEntityPicks(plazaTopY, terrainAt);
    const ndcV = new Vector3();
    ctx.hooks.entityPick = (nx, ny) => {
      const cam = engine.camera;
      cam.updateMatrixWorld();
      ndcV.set(nx, ny, 0.5).unproject(cam);
      const dir = ndcV.sub(cam.position).normalize();
      return pickEntityAt(
        [cam.position.x, cam.position.y, cam.position.z],
        [dir.x, dir.y, dir.z],
        pickVolumes,
        terrainAt,
      );
    };
    ctx.hooks.entityNear = (x, y, z) => nearestEntityAt([x, y, z], pickVolumes);
    // reading-key anchors (M3.5): same owner tables, one marker per cited
    // slug — VisualKeyUI (core) projects them when the key is toggled on
    ctx.hooks.entityKeyMarkers = keyMarkers(plazaTopY, terrainAt);
  }

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

  // User-facing large-world navigation. Ground destinations resolve through
  // the FINAL composed probe (terrain + river claim cap + campus far ground),
  // while city/map flights clear the authored summit rather than spawning
  // inside a vertically stacked tier. Factual labels carry their citations;
  // the meadow/overview framing is explicitly identified as art direction.
  const navigationProbe = ctx.hooks.groundProbe;
  const groundPose = (x: number, z: number, yaw: number, pitch = 0) => {
    const fallback = hf?.heightAtCpu(x, z) ?? plazaTopY;
    const sample = navigationProbe?.(x, z, fallback + 20) ?? {
      ground: fallback,
      water: fallback - 2,
    };
    return {
      p: [x, Math.max(sample.ground + 1.7, sample.water + 0.45), z] as [number, number, number],
      yaw,
      pitch,
    };
  };
  const summitClearY = plazaTopY + CITY_SUMMIT_Y * NJ_SCALE + 350;
  const southGateX = GATE_OFFSETS[2] * NJ_SCALE;
  ctx.hooks.navigationTargets = [
    {
      id: 'arrival-meadow',
      name: 'Arrival meadow',
      detail: 'Primary south approach; meadow treatment is illustrative',
      citation: 'Rev 21:2,10 (city)',
      pose: groundPose(350, 4150, 0, 0.22),
      mode: 'walk',
    },
    {
      id: 'zebulun-gate',
      name: 'Zebulun gate approach',
      detail: 'South wall passage east of the river',
      citation: 'Ezek 48:33',
      pose: groundPose(southGateX, (CITY_HALF + 14) * NJ_SCALE, 0, 0.05),
      mode: 'walk',
    },
    {
      id: 'city-overview',
      name: 'City overview',
      detail: 'Illustrative terraced rendering; twelve-gate wall',
      citation: 'Ezek 48:30-34 (gates)',
      pose: { p: [2600, plazaTopY + 900, 3000], yaw: 0.714, pitch: -0.22 },
      mode: 'fly',
    },
    {
      id: 'summit-overlook',
      name: 'Summit overlook',
      detail: 'Rainbow halo and sea of glass',
      citation: 'Rev 4:3,6',
      pose: { p: [500, summitClearY, 1500], yaw: 0, pitch: -0.22 },
      mode: 'fly',
    },
    {
      id: 'temple-east',
      name: 'Temple east approach',
      detail: 'Measurement-grounded temple complex',
      citation: 'Ezek 40-43',
      pose: groundPose(TEMPLE_SITE.x + 380, TEMPLE_SITE.z, Math.PI / 2),
      mode: 'walk',
    },
    {
      id: 'priests-campus',
      name: "Priests' dwelling campus",
      detail: 'Illustrative dwellings within the cited priestly zone',
      citation: 'Ezek 45:4; 48:10-12',
      pose: groundPose(375, -5225, Math.PI / 4),
      mode: 'walk',
    },
  ];
  ctx.hooks.navigationMap = {
    title: 'New Jerusalem',
    citation: 'Rev 21:2,10',
    minX: -7000,
    maxX: 7000,
    minZ: -11000,
    maxZ: 5200,
    safeFlyY: (x, z) => {
      const fallback = hf?.heightAtCpu(x, z) ?? plazaTopY;
      const sample = navigationProbe?.(x, z, summitClearY) ?? {
        ground: fallback,
        water: fallback - 2,
      };
      const terrainClear = Math.max(sample.ground, sample.water) + 140;
      const overCity = Math.abs(x) < 2600 && Math.abs(z) < 2600;
      return overCity ? Math.max(terrainClear, summitClearY) : terrainClear;
    },
  };

  ctx.progress(1, 'newjerusalem ready');
}
