# Spec — Phase 3: Explorable 3D world

**Status:** Stub (filled out at the start of Phase 3)
**Phase:** 3

This spec is a placeholder. Its purpose right now is to record the goals, the things we already know, and the open questions that should be resolved before implementation.

---

## Goals

1. Render an initial explorable 3D representation of the New Jerusalem and surrounding heavenly material.
2. Procedurally assemble the scene from the canonical dataset — no hand-built geometry untraceable to a descriptor.
3. Let the user walk the space and inspect entities by clicking them.
4. Visually distinguish literal from symbolic features.

---

## What we already know

- Stack: React Three Fiber + drei + zustand, inside the existing Next.js app. See [`../adr/0002-tech-stack.md`](../adr/0002-tech-stack.md).
- Data source: the same JSON exports the browse UI consumes.
- Scope is bounded to the New Jerusalem core elements (city walls, gates, foundations, throne, river of life, tree of life, representative population) for the initial release. See [`../prd.md`](../prd.md) §5 Phase 3.
- The 3D layer does not invent geography or populate the city with un-cited beings.

---

## Open questions

- Camera model — first-person walk vs orbit vs hybrid? (Probably hybrid: orbit overview + a "ground level" walk mode.)
- How do we render `symbolic` descriptors? Render the surface image with a subtle indicator (a glow, an icon on hover, a sidebar note)?
- Procedural generation parameters — Rev 21 gives explicit measurements (1,500 miles cubic). Do we scale to user-comprehensible size, render at "skybox" scale with a smaller walkable region, or attempt 1:1?
- Asset strategy — purely procedural vs lightweight authored assets (rock textures, foliage for the river bank) vs AI-generated assets?
- Performance budget — target hardware (mid-range laptop, current browser); LOD strategy.
- Audio — silence vs subtle ambient? (Default: silence; ambient is a future option.)

---

## Done-when

To be defined at the start of Phase 3. Initial sketch in [`../prd.md`](../prd.md) §5.
