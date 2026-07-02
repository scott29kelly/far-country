# ADR 0016 — Stratified mesa rim for the Holy Allotment

- **Status:** Accepted (2026-07-02)
- **Supersedes:** the rim art-direction clause of [ADR 0015](0015-terrain-integrated-holy-allotment.md)
  ("a broad rise, **not** a cliffed mesa"). Everything else in ADR 0015 —
  scene-selected domain, terrain-integrated plateau, scatter footprints,
  removal of the box platform — stands unchanged.

## Context

ADR 0015 gave the Holy Allotment a kilometers-wide smooth rim falloff,
reading Willis's "elevated green land… verdant and gently rolling" as
governing the whole landform. Scott's reference set (cataloged 2026-07-01 in
`apps/world-engine/reference-city/USER-REFS.md`) resolved the ambiguity the
other way: **every aerial in the set draws a mesa** — the gently-rolling
green TOP runs to a hard lip, then stratified near-vertical rock walls with
waterfalls pouring off the rim, talus and canyon country below
(holy-allotment.png, new-jerusalem-1.png, gemini-render-1.jpg). USER-REFS
directive #2 records this as approved art direction: "the plateau EDGE is
stratified cliff with waterfalls… the TOP stays gently rolling green." The
Willis text governs the top; the references govern the edge. The rim is
illustrative context, not a cited descriptor (same posture as
RENDERING-DECISIONS #5's landscape).

## Decision

1. **`PlateauParams` gains an optional `cliff` block** (lip, face, wallH,
   benches, talus — `apps/world-engine/src/world/MacroMap.ts`). When present,
   the plateau's profile becomes piecewise: rolling top → a noise-meandered
   lip (±70 m, so the edge is geology rather than a machined rounded rect) →
   a stepped near-vertical face carrying an ABSOLUTE `wallH` (260 m at ship)
   across a ~170 m band with a monotone staircase curve → a talus tail that
   blends the wall foot into the wild terrain (rising into a carved canyon
   rim where the fringe runs high, descending where it runs low). The wall
   height is absolute rather than a fraction of the local rise — the first
   build used a fraction and the mesa vanished wherever the wild fringe ran
   close to the plateau top. Absent `cliff`, the original smooth falloff
   runs — and wild scenes never set `plateau` at all, so their compiled
   terrain is bit-identical (the untaken JS branch emits no shader nodes).

2. **The face band gets a strata-modulated hardness boost** in the same
   function: hard beds clamp to 0.97 (the karst-tower survival regime, ~72°
   repose under the thermal-erosion law) while soft interbeds stay ~0.72, so
   the 640 erosion iterations CARVE LEDGES into the face instead of shedding
   it — stratification comes from the erosion system itself, not a texture.

3. **Rim geometry constants live once, in `apps/world-engine/src/nj/rimModel.ts`**,
   consumed by the scene's `macroPatch` (GPU) and by the CPU rim scanner that
   places the rim waterfalls (authored crystal ribbons — the hydrology field
   cannot express vertical falls by construction; its cliff-cut kernel
   deletes wet cells above 0.35 gradient).

## Consequences

- Only the SOUTH rim (lip ≈ z 4400) plus the SE/SW corner arcs lie inside
  the ±6144 m detailed/eroded domain; east, west and north rims render on
  the analytic far shell, which gets the same profile but cannot resolve the
  benches at its ~292 m vertex pitch. Accepted: the south rim is the only
  edge the spawn/approach compositions ever frame, and the compressed cliff
  band (~720 m total vs the old 1900 m tail) now fits entirely inside the
  detailed ring.
- Waterfall sites are seed-dependent (hydrology is emergent) and must be
  scanned at runtime per boot, never baked as constants.
- The spawn meadow, approach channel, basin pond and city flat core all sit
  ≥ 240 m inside the lip band — untouched by the profile change.
