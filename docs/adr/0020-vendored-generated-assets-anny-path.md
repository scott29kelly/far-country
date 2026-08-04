# ADR 0020 — Vendored generated assets: the Anny path for the redeemed's near tier

- **Status:** Accepted
- **Date:** 2026-08-04
- **Resolves:** the open engineering consequence of
  [ADR 0019](0019-photorealistic-redeemed-humans.md) (photorealism is
  *permitted* there; this decision fixes *how* it is authored)
- **Supersedes:** — (ADR 0019, 0010, 0011 all remain in force)
- **Superseded by:** —

## Context

ADR 0019 re-scoped the great multitude (Rev 7:9) to photorealistic,
generic, anonymous human beings. The 2026-08-03 rebuild delivered the
fork-independent scaffolding — a GPU crowd LOD and a seeded procedural
figure generator — but its near-ring faces are deliberately featureless:
true photoreal faces, skin and hair are not honestly reachable as
runtime-procedural geometry. On 2026-08-04 Scott answered the gated
authoring question: **vendored offline-generated assets** (recorded in
`docs/plans/procedural-asset-authoring.md` §8 item 5), the same posture the
audio layer adopted — generate offline through our own pipeline, commit the
output, run nothing generative and fetch nothing at runtime.

The generation source is decided with it: **Anny**
([github.com/naver/anny](https://github.com/naver/anny), paper
arXiv:2511.03589), an open-source differentiable parametric human body
model. Code Apache-2.0; assets CC0 1.0 (derived from the MakeHuman
community's **artist-authored** morph targets — no scans of real people
anywhere upstream); 13,380-vertex quad topology; 163-bone rig; phenotype
parameters (age, gender, height, weight, muscle, local traits) on
continuous [0, 1] ranges driving piecewise-multilinear blendshape
interpolation; PyTorch.

Alternatives considered and rejected for this use:

- **Runtime-procedural sculpting** — quality caps far short of photoreal
  faces; every hour spent approaches an asset pipeline anyway.
- **AI mesh generators** (Meshy, Tripo, TRELLIS, Hunyuan3D, and kin) —
  non-deterministic outputs, training-data provenance that cannot be
  audited, and therefore an unanswerable portrait risk: a generated face
  cannot be shown NOT to resemble a real person in the training set. That
  fails ADR 0019 rule 2 at the root.
- **Photogrammetry / scan libraries** — likeness of real individuals by
  construction; categorically excluded by ADR 0019 rule 2.

## Decision

1. **Generate offline, vendor the output.** Near-tier figure geometry is
   produced by a seeded pipeline in `pipeline/figures/` (Python 3.12, uv)
   using Anny, and the output is committed to the repo as generated data —
   the `templeMeasurements.gen.ts` posture: the generator is committed, the
   output is committed, and regeneration is reproducible from the recorded
   seeds. The runtime engine never generates, never fetches externally, and
   never depends on the pipeline being installed.

2. **Provenance guards.** Only Apache-2.0 code and CC0 assets may enter the
   pipeline. Only Anny's default **"anny" topology** is used — the SMPL-X
   interoperability mode is licensed non-commercial and is **banned** from
   this repo, as is any other non-commercial or unclear-license input.
   Every vendored artifact carries a provenance header: source project and
   version (pinned in `pipeline/figures/uv.lock`), generation seed and
   parameters, generation date, and the licenses of everything upstream.

3. **Anonymity is a property of the recipe, not a review step**
   (ADR 0019 rule 2 made structural). Identities are synthesized from
   seeded phenotype parameters over artist-authored CC0 morph spaces; no
   real person's geometry exists upstream, so no output can be a likeness.
   Seeds derive from the archetype tables (`figureModel.ts`), never tuned
   toward a person. Future skin/hair/texture sources must pass the same
   test: artist-authored or procedurally generated — never scan-derived,
   never likeness data. Rendering a *named* or *real* person's face remains
   out of scope per ADR 0019 regardless of source.

4. **One material per LOD tier.** All per-figure variety rides on
   per-instance parameters and texture arrays inside a single material per
   tier — draw calls scale with material switches, not with figure count.
   (This is the discipline the 2026-08-03 crowd build already follows; the
   vendored tier inherits it.)

5. **Animation posture (forward-looking, binding when it lands).** Crowd
   animation is baked offline into textures and read back in the vertex
   shader (the GPU-crowds idiom) — no CPU per-instance updates, per the
   engine's hard rule. Mixamo-sourced clips may be *used* in the project
   but never redistributed standalone; acquiring them requires Scott's own
   Adobe login (agents never log in or create accounts).

6. **Posture alignment.** This is the audio layer's generate-offline /
   vendor-output posture applied to geometry. ADR 0006's personal-study
   licensing stance is unaffected: CC0 and Apache-2.0 inputs redistribute
   freely, unlike ESV/Willis text.

## Consequences

- `pipeline/figures/` becomes a repo component (uv project; plain CPU
  PyTorch suffices — warp-lang is optional upstream and not required).
  Vendored geometry lives under `apps/world-engine` (binary payload +
  `.gen.ts` manifest) and ships inside the vendored engine bundle.
- The engine's "zero external assets" ethos is **refined, not dropped**:
  self-generated, provenance-headed, CC0/Apache-derived vendored data is
  in-posture; third-party runtime fetches and unauditable blobs remain out.
- `Crowd.ts`'s near ring consumes the vendored geometry; the seeded
  procedural generator (`FigureMesh.ts`) remains the mid/far LODs and the
  single source of truth for identity/diversity parameters — the vendored
  tier is keyed to the same archetypes and per-figure axes.
- Probe coverage extends to the vendored artifacts: budget ceilings,
  provenance-header presence, and regeneration determinism become
  CPU-probe assertions.
- Any future asset class proposed for vendoring (textures, hair, audio)
  is judged against rules 2–3 of this ADR before it enters the repo.

## References

- [ADR 0019](0019-photorealistic-redeemed-humans.md) — permission + the
  anonymity rule this ADR operationalizes
- [ADR 0010](0010-aniconic-policy.md) / [ADR 0011](0011-population-rendering-policy.md) — untouched
- [ADR 0006](0006-source-licensing-posture.md) — licensing posture context
- [ADR 0017](0017-scripture-as-grounding-data.md) — the generated-data
  discipline this extends to geometry
- `docs/plans/procedural-asset-authoring.md` §8 item 5 — Scott's answer,
  2026-08-04 (session record)
- Anny: [github.com/naver/anny](https://github.com/naver/anny) ·
  [arXiv:2511.03589](https://arxiv.org/abs/2511.03589) — code Apache-2.0,
  assets CC0 1.0 (MakeHuman-derived)
