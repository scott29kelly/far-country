# ADR 0014 — Citywide (2–3 mile) scale for the New Jerusalem render

- **Status:** Accepted
- **Date:** 2026-06-21
- **Supersedes:** **rule 6 (scale deferral) of [`0009-symbolic-vs-literal-rendering.md`](0009-symbolic-vs-literal-rendering.md)** — the "~200m placeholder scale" working convention. Rules 1–5 and 7 of ADR 0009 still stand unchanged.
- **Superseded by:** —

## Context

ADR 0009 rule 6 deliberately rendered the city at a **~200 m placeholder scale**, treating the 12,000-stadia measurement of Rev 21:16 as *known* not-literal and recording the deferral "pending a deliberate decision." That was the right call for the React Three Fiber MVP, where the city stood on a small hand-built pad.

Two things have changed since:

1. **The engine now renders a full-size procedural new-earth landscape** ([ADR 0013](0013-fork-laas-engine-for-3d-world.md) — the vendored LAAS engine). The `?scene=newjerusalem` scene places the city on this landscape: CDLOD terrain detailed to `WORLD_SIZE=4096` (±2048 m), an analytic far-shell out to ~14 km, peaks to ~1620 m, and a camera far-plane of 30 km. Against a continent-scale landscape, a ~200 m city is a toy — it cannot read as the "holy **mountain** of God" that the chosen city form depends on ([`RENDERING-DECISIONS.md`](../../RENDERING-DECISIONS.md) entry #1; Willis's mountain-city thesis, [`willis-new-jerusalem-model.md`](../sources/willis-new-jerusalem-model.md)).

2. **The mountain reading wants vertical dominance.** Willis sites the city on an elevated plateau, rising in terraces "above the land." A placeholder-scale city on full-scale terrain inverts that relationship.

So the scale question that rule 6 explicitly left for "a future ADR" is now live. This is that ADR.

## The literal values are unviewable

Two literal readings of Rev 21:16's 12,000 stadia exist:

- **Mainstream — ~1,380–1,500 mi per side** (12,000 stadia read as a *linear* edge). MacArthur: "difficult to envision." At this size the city is larger than the renderable world; no establishing view exists.
- **Willis — ~12 mi per side** (12,000 stadia read as the *area* of the square base, √12,000 ≈ 110 stadia/side ≈ 12 mi; height ≈ base). Far smaller, but still ~12 mi tall.

Even Willis's ~12 mi is **unviewable as a whole** inside this engine: a 12-mile, ~19 km-tall structure exceeds the 30 km far-plane only marginally but, combined with froxel fog and aerial perspective, fills the entire view as a featureless near-field wall from any ground or low-air vantage. You cannot see the city *as a city* — its terraced silhouette, summit glory, and relationship to the land all disappear. The project owner reviewed this directly and **explicitly rejected the literal 12 mi** ("it becomes an unviewable sky-wall").

## Decision

Render the New Jerusalem at a **citywide but viewable scale of ~2–3 miles**, driven by a single uniform factor `NJ_SCALE` in [`apps/world-engine/src/nj/NewJerusalemScene.ts`](../../apps/world-engine/src/nj/NewJerusalemScene.ts). That one factor scales the whole composition: the Holy Allotment group, the walk-physics plateau rectangle, the procedural-scatter keep-out, and the spawn.

- **Current value: `NJ_SCALE = 20` (~2.5 mi base).** The working band is `16` (~2 mi) … `24` (~3 mi), tuned by eye against screenshots; the project owner selected ~2.5 mi (the middle of the band) as the landing value.
- This is a **deliberate symbolic-/viewable-scale rendering**, in the same spirit as ADR 0009 rule 2's treatment of `symbolic` material: it honours the *intent* of the measurement (a vast city that dominates the new earth as a holy mountain, in the direction of Willis's ~12 mi reading) while electing a value that can actually be **seen whole and explored**. It is explicitly **not** a claim that the city is literally 2–3 miles.

### Why 2–3 miles specifically

- **Large enough** that the terraced city reads as a holy mountain rising over the landscape — vertical dominance restored, the mountain thesis legible.
- **Small enough** to frame in a single establishing shot and to walk/fly through at the engine's quality bar without the city degenerating into a fog wall.
- The owner chose this band directly as art director; it is a render-craft decision, not a textual one.

## Consequences

- **No signage claim.** Consistent with the surviving clause of ADR 0009 rule 6, the world makes **no signage or HUD claim about an exact size** — it does not assert "this is a 2-mile city" any more than it asserted "200 m." The render elects a viewable scale; it does not redefine the measurement.
- **Camera follows scale.** The establishing camera distance scales with `NJ_SCALE` (≈ proportional pull-back). Spawn/walk-physics already derive from `NJ_SCALE`, so they track automatically.
- **Plateau exceeds the detailed terrain.** Above ~`NJ_SCALE 4` the lifted plateau is larger than the ±2048 m detailed terrain ring, so the surrounding forest/scatter reads on the far-shell foothills beyond it. This is **intended** at citywide scale, not a bug.
- **Couples with the glory/de-haze work.** At the distance needed to frame a 2–3 mile city, froxel fog and aerial perspective wash the city toward the sky tone — it reads pale rather than as the brightest thing (Rev 21:23). Restoring the city's glow against the haze is tracked as a **separate** render pass (city emissive in `CityMassing.ts`; atmosphere in the engine's fog/sky/post stack), not by this ADR.
- **Reversible / tunable.** `NJ_SCALE` is one constant; a future ADR may revisit the band (or true-scale rendering) if the engine's far-field handling changes.

## References

- [`0009-symbolic-vs-literal-rendering.md`](0009-symbolic-vs-literal-rendering.md) rule 6 (the deferral this ADR supersedes), rules 1–5, 7 (unchanged)
- [`0013-fork-laas-engine-for-3d-world.md`](0013-fork-laas-engine-for-3d-world.md) — the engine whose full-scale landscape motivates this decision
- [`../../RENDERING-DECISIONS.md`](../../RENDERING-DECISIONS.md) entry #1 — city as terraced mountain (the form this scale serves)
- [`../sources/willis-new-jerusalem-model.md`](../sources/willis-new-jerusalem-model.md) — size (~12 mi area reading) and mountain-city composition
- Code: [`../../apps/world-engine/src/nj/NewJerusalemScene.ts`](../../apps/world-engine/src/nj/NewJerusalemScene.ts) (`NJ_SCALE`)
