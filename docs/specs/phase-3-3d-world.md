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

- **Rendering stack superseded.** The R3F-on-Next approach below was superseded by [`../adr/0013-fork-laas-engine-for-3d-world.md`](../adr/0013-fork-laas-engine-for-3d-world.md): Phase 3 now builds on the vendored WebGPU engine (`apps/world-engine/`). The concrete port plan is [`phase-3-engine-integration.md`](phase-3-engine-integration.md). The goals and content scope on this page still hold; only the renderer changed.
- Original stack (now legacy, retired at engine parity): React Three Fiber + drei + zustand, inside the existing Next.js app. See [`../adr/0002-tech-stack.md`](../adr/0002-tech-stack.md).
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

## Backlog — adopted from Persepolis Reimagined (added 2026-08-31)

Source: [`../research/2026-08-30-persepolis-reimagined-getty.md`](../research/2026-08-30-persepolis-reimagined-getty.md)
(§6, notes 1–4) — Getty/Media.Monks' guided browser reconstruction of
Persepolis. Four patterns were approved for adoption on 2026-08-31. None are
scheduled; each becomes real work only when picked up and scoped against the
current milestone state in [`../roadmap.md`](../roadmap.md).

1. **Evidence lens ("show the text").** At any cited entity, one interaction
   crossfades the rendered interpretation into its evidence layer — the
   descriptor statement, tier badge, citations, and symbolic referent (the
   data `src/core/EntityHud.ts` already fetches) — and/or dims what the
   render adds *beyond* the citations (the interpretive architecture
   `RENDERING-DECISIONS.md` already flags as uncited, e.g. the ramp chains).
   Persepolis' camera-matched "click to reveal present-day view" is the
   reference interaction. Composes with the M3.5 reading key rather than
   replacing it; governed by ADR 0009.
2. **Index-to-world deep links.** From each entity page in the browse UI, a
   "See it in the world" link that opens `/world-preview` and flies to that
   entity on arrival. Both halves exist — the browse UI and
   `src/nj/entityPicks.ts` consume the same `/data/entities/*.json`; the
   missing piece is a fly-to-entity arrival parameter. Persepolis' Art Index
   "See it in [location]" is the reference. Low risk, and it strengthens the
   citation-per-claim posture: the dataset becomes the index of the world.
3. **Authored pilgrimage tour (optional mode).** A fixed camera rail through
   the gates, up the processional ramps, to the summit — advancing on scroll
   or a single key, pausing at cited entities, with explicit "scroll to
   continue" prompts and a progress indicator. Free roam is untouched; the
   rail is one more mode beside walk/fly/quick-travel in
   `core/NavigationUI.ts`, and it satisfies the approachable-navigation
   requirement (mouse-driven, visible cursor, no pointer lock) with zero
   tutorial. Because visibility on a rail is authored, the tour may run a
   heavier visual tier than free roam allows. On-screen tour text stays
   inside cited descriptors ([`../hermeneutics.md`](../hermeneutics.md));
   role-framing may cast the visitor as entering with the pilgrim nations
   (Rev 21:24–26) as a narrative device, not a content claim.
4. **District streaming behind a masked transition.** Engine-side work;
   specced in [`phase-3-engine-integration.md`](phase-3-engine-integration.md)
   §10.

---

## Done-when

To be defined at the start of Phase 3. Initial sketch in [`../prd.md`](../prd.md) §5.
