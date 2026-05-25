# ADR 0008 — Eschatological framing (amillennial, no intermediate state, single eternal heaven)

- **Status:** Accepted
- **Date:** 2026-05-25
- **Supersedes:** Partially supersedes [`0005-hermeneutic-policy.md`](0005-hermeneutic-policy.md) — specifically the implicit treatment of the intermediate state and the millennium as live interpretive options. The conservative-Protestant, literal-where-possible policy of ADR 0005 still stands as the base; this ADR locks the eschatological framing inside it.
- **Superseded by:** —

## Context

ADR 0005 locked the project to a conservative-Protestant, literal-where-possible hermeneutic, but conservative Protestantism is not monolithic on eschatology. The same hermeneutic is used by:

- **Dispensational premillennialists** — who read Revelation 20 as a literal future 1,000-year earthly kingdom of Christ, distinct from the eternal state.
- **Historic premillennialists** — same literal millennium, different mechanics.
- **Postmillennialists** — millennium as a future age of gospel triumph before Christ returns.
- **Amillennialists** — "thousand years" of Rev 20 is symbolic of the current church age between Christ's first and second comings; there is no future literal millennial kingdom distinct from the eternal state.

Each reading produces materially different descriptors when the extractor encounters Rev 19–22, the resurrection texts, the temple visions, and the intermediate-state passages. Without locking a position, the dataset will drift between readings.

A parallel question: **the intermediate state.** Classic Reformed eschatology (e.g. WCF 32.1) holds that the believer's soul is consciously with Christ between death and bodily resurrection, while the body lies in the grave — a phase distinct from the final state. Other Reformed Protestants collapse this distinction and treat death-to-Christ and resurrection-to-glory as one place ("heaven") even if temporally separated.

The data model already has a `temporal_phase` field (`intermediate | final | either | unspecified`) that bakes the distinction into the schema. Whether the project actually uses `intermediate` as a live category depends on this ADR.

## Decision

Far Country adopts the **Reformed amillennial** position as the project's eschatological framing.

The specific lock-downs:

1. **Amillennialism.** The "thousand years" of Revelation 20 is read symbolically as the current age between Christ's first and second comings. There is **no future literal millennial kingdom distinct from the eternal state.** Premillennial and postmillennial readings are not the project's framing.

2. **No separable intermediate state.** When a believer dies, they are with Christ in heaven. The classic intermediate-state / final-state distinction is collapsed: the disembodied believer in 2 Cor 5:8 and Phil 1:23 is in the same heaven as the resurrected believer in Rev 21. The bodily resurrection (1 Cor 15) glorifies the believer who is already there; it does not transport them between two heavens.

3. **One heaven.** All Scripture about heaven refers to a single place — variously called eternal heaven, the New Jerusalem, the heavenly Mount Zion, the Father's house. References across the canon describe the same locus.

4. **Two ages.** There are only two ages: the current age (the world as it is now, including the church-age "millennium") and the Age of Eternity (the new heavens and new earth). There is no third age.

## Consequences

### Data-model and schema

- The `temporal_phase` enum (`intermediate | final | either | unspecified`) in `docs/data-model.md` is retained for backward compatibility, but **`intermediate` is no longer a valid value to assign** in new extraction or review. Existing rows tagged `intermediate` are re-tagged to `either` (per "one heaven": what is true at death-to-Christ is also true at resurrection-to-glory).
- `final` is the canonical tag for descriptors that pertain specifically to the post-resurrection, post-new-creation state in cases where that distinction within the single heaven matters (e.g., the bodily resurrection itself, the new earth motif, the absence of death).
- `either` is the canonical tag for descriptors true of any believer in heaven regardless of whether their body has been resurrected yet.
- `unspecified` remains as a soft fallback for descriptors where the source text doesn't pin a phase.

### Extraction prompt

- The passage-extraction prompt must be updated to (a) drop `intermediate` from the menu of valid temporal_phase values, (b) state the amillennial reading of Rev 20 explicitly, and (c) state the single-heaven assumption so descriptors don't bifurcate the locus across the canon. This is a prompt-version bump (next: `0.2.0`) and must be applied before Stage B extraction (which includes Rev 19, 20).

### Reviewer rubric

- Descriptors that posit a future literal millennium, or that distinguish "intermediate heaven" from "final heaven" as separate places or substantially different conditions, are not approvable under this ADR. They become `rejected` with a reviewer note pointing to ADR 0008, or `needs-discussion` if the descriptor's wording is ambiguous.
- The `_review_help.html` partial in the review UI should reflect this framing so reviewers don't approve descriptors that violate it.

### Phase 3 (3D world)

- Phase 3 renders one heaven, not two phases. The 3D scene does not need to represent a "now" pre-resurrection heaven and a "later" post-resurrection heaven as distinct environments. This materially simplifies the world model: ADR 0008 → no two-state branching → the inner-region geometry of the future ADR 0009 is a single scene.
- This also closes off a Phase 3 design space (a "time-flip" between intermediate and final states inside the world). That space is not lost — it just is not the project's framing.

### Q&A behavior

- The `/api/ask` endpoint will inherit this framing by virtue of grounding in descriptors that pass the rubric. Questions like "is there a millennium?" or "what is the intermediate state like?" should refuse-with-pointer per the grounding contract: "The project's framing (ADR 0008) treats Rev 20 amillennially and does not posit a separable intermediate state — here are the descriptors closest to your question."

### Project readers outside this framing

- Premillennialists, dispensationalists, and Reformed Protestants who hold to the classic intermediate-state distinction will read the project's output as omitting or flattening positions they hold dear. This is accepted: ADR 0005 already noted that any single hermeneutic excludes alternatives. ADR 0008 just makes the exclusion specific.

## Migration

Concrete actions taken at the time of this ADR's acceptance (in `data/canonical.sqlite`):

1. Two descriptors currently tagged `intermediate` are re-tagged to `either` with reviewer note `"amillennial re-tag per ADR 0008: no separable intermediate phase"`:
   - Hebrews 11:5 — "Enoch was taken up by God so that he did not see death, having pleased God by faith."
   - Hebrews 12:23 — "The spirits of the righteous have been made perfect in the heavenly assembly."

2. The extraction prompt template (`pipeline/src/far_country/extract/prompts/passage.md` and equivalents) is updated to drop `intermediate` from the valid `temporal_phase` set and to add an explicit amillennial-framing paragraph. Prompt version moves to `0.2.0`.

3. The data-model and hermeneutics docs are annotated with a reference to this ADR where `intermediate` and the millennium are discussed.

The prompt update and doc annotations are deferred to a follow-up phase since Stage A extraction is already complete; this ADR captures the lock so Stage B starts under the new framing.

## References

- [`docs/adr/0005-hermeneutic-policy.md`](0005-hermeneutic-policy.md)
- [`docs/hermeneutics.md`](../hermeneutics.md)
- [`docs/data-model.md`](../data-model.md) §`descriptor.temporal_phase`
- [`docs/extraction-pipeline.md`](../extraction-pipeline.md) §3.1, §3.2
