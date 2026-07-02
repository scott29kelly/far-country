# ADR 0015 — Terrain-integrated Holy Allotment on a scene-selected world domain

- **Status:** Accepted (2026-07-01)
- **Relates to:** ADR 0013 (fork LAAS engine), ADR 0014 (citywide scale), ADR 0009 rule 6 (placeholder scale)

## Context

ADR 0014 scaled the New Jerusalem to ~2.5 mi (`NJ_SCALE = 20`), making the
city (±2,000 m) as large as the engine's entire detailed terrain domain
(`WORLD_HALF = 2048 m`). The Holy Allotment was implemented as a flat
`BoxGeometry` platform lifted 600 m above the heightfield, with a blanket
scatter exclusion over its ±9.6 km footprint.

The compound effect (user-reported as "8-bit graphics… OOMs below the bar"):
the front-door scene hid **every** detail system the engine was forked for.
The box covered the sculpted/eroded/textured terrain; the exclusion zeroed
all vegetation (`veg.trees: 0` in every capture); the 600 m lift put the
grass clipmap, debris, streams and caustics — which follow the real
heightfield — permanently out of sight; the scene's de-haze overrides
flattened what remained. The phase-3 spec's premise that "the engine's ~4 km
world gives ample room" was silently invalidated by the scale-up.

## Decision

1. **The world domain is scene-selected.** `WorldConst.ts` keys `WORLD_SIZE`
   off `?scene=` (with a `?worldsize=` override): the New Jerusalem scene
   runs **12,288 m** (detailed ring ±6,144 m, ~3 m/texel macro at the fixed
   4096² heightfield); the wild demo scenes keep **4,096 m** at 1 m/texel so
   their tuned look is untouched. `FAR_RADIUS` and the far-shell band anchors
   derive from `WORLD_HALF` (the historical constants are reproduced exactly
   at the original domain). Shader-side detail (splat, micro-displacement,
   grass, debris) is texel-density independent.

2. **The Holy Allotment is authored geography inside `macroTerrain`, not a
   box.** `MacroParams` gains an optional `plateau` (rounded-rect footprint,
   nominal top height, kilometers-wide rim falloff, a flat core for the city
   and forecourt, gentle roll elsewhere, optional approach basin). Because
   both the 4096² bake and the analytic far shell evaluate the same
   function, the plateau exists in both with seam continuity for free.
   Scenes inject it via `ctx.macroPatch` (Heightfield applies the patch
   before any kernel reads `mp`, so erosion, hydrology, biomes, scatter,
   probes and fog all treat the plateau as land). Art direction per the
   Willis source model: "elevated green land… verdant and gently rolling,
   with scattered trees and meadow" — a broad rise, **not** a cliffed mesa.
   The flat core rides near the roll's crest so it drains (a low core became
   a city-ringing lake on the first boot).

3. **Scatter excludes only built footprints.** `ctx.scatterExclude` is now a
   rect LIST (city + forecourt, processional approach sightline, dwelling/
   temple campus); the rest of the plain gets the engine's own meadows,
   groves and stones. Larger domains thin scatter acceptance per class
   (unbiased, budget-derived) so fixed instance caps can't truncate in
   dispatch order and empty geographic bands.

4. **The box platform, skirt, rock chunks, box crop-fields/hedges, and the
   19 km perimeter wall are removed.** Dwellings and temple snap per-object
   to the rolling ground. Field plots, hedgerows and orchard planting return
   properly with a follow-up allotment **zone-map** milestone (managed
   planting driven through the scatter/grass kernels), not as floating boxes.

## Consequences

- The approach plain, rim slopes and the city forecourt are real detailed
  terrain again (first verified boot: 508k trees, 597k understory, 1.2M
  stones, 137k flowers/ferns; grass underfoot at the spawn).
- Erosion runs at ~6 m/texel on the large domain (vs 3 m): softer carving on
  the wild fringe of the NJ world; the plateau top is gentle by design and
  unaffected. Accepted; revisit only if the rim reads soft.
- The allotment layout is compressed (ALLOT extents trimmed) to fit the far
  shell — placeholder proportions per ADR 0009 rule 6, not the Ezekiel 45/48
  measures. The dwelling grid and temple sit 5–10 km out, mostly on the
  analytic far shell: fine as distant content, coarse if walked to. The
  walkable-detail domain remains the ±6.1 km ring.
- `RiverOfLife`'s channel width now comes from the shared `cityModel.RIVER`
  (the tier-scaled width put an 800 m sheet of water across the spawn view);
  the tier table itself is still hand-mirrored — unify in the M3 pass.
- The old `PLAIN_LIFT`/groundProbe plateau special-cases are gone; walk
  physics reads the heightfield everywhere.
