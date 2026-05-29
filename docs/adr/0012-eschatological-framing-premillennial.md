# ADR 0012 — Eschatological framing (premillennial New Creationism)

- **Status:** Accepted
- **Date:** 2026-05-29
- **Supersedes:** [`0008-eschatological-framing.md`](0008-eschatological-framing.md) in full. ADR 0008 locked the project to Reformed amillennialism, a collapsed intermediate state, and a two-age cosmology. This ADR replaces all three with a premillennial framing. The conservative-Protestant, literal-where-possible base policy of [`0005-hermeneutic-policy.md`](0005-hermeneutic-policy.md) is unchanged and still stands; this ADR re-locks the eschatology inside it.
- **Superseded by:** —

## Context

ADR 0008 adopted Reformed amillennialism as the project's eschatological framing. That choice was explicitly a **temporary simplification**, not a settled conviction. The owner is personally premillennial; the amillennial lock was taken to reach the 3D world faster (one heaven, no two-state branching, the Ezekiel temple read typologically) with the stated intent to reconcile the doctrine later once the world proved compelling. The research notes in [`docs/sources/willis-new-jerusalem-model.md`](../sources/willis-new-jerusalem-model.md) recorded this tension directly: Janet Willis — the project's primary structuring lens (per [hermeneutics.md §2](../hermeneutics.md)) — is premillennial, and her framework was therefore only partially adopted (architecture adopted, eschatology "quarantined").

The world is now built and compelling. The simplification has served its purpose, and carrying an amillennial framing the owner does not hold introduces a standing contradiction between the project's doctrine docs and its primary source. This ADR resolves that contradiction by **adopting Willis's premillennial "New Creationism" in full** and discarding the amillennial framing.

This is a change to interpretive stance and therefore requires an ADR superseding the prior one (per [hermeneutics.md §9](../hermeneutics.md) and ADR 0005). It does **not** change the base hermeneutic (conservative-Protestant, literal-where-possible), the four-tier confidence system, ESV canonicity, or the aniconic policy of [ADR 0010](0010-aniconic-policy.md) — all of which remain in force.

## Decision

Far Country adopts **premillennial New Creationism** as the project's eschatological framing — the position held and argued by Janet Willis and branded by her publisher (Alan Kurschner / Eschatos Ministries). The specific lock-downs:

1. **Premillennialism, pre-wrath.** Revelation 20 is read as a **literal future millennium** — a 1,000-year reign of Christ following his return, distinct from both the present age and the eternal state. The **first resurrection** (Rev 20:4–6) is a real bodily resurrection of the redeemed at the millennium's start, distinct from the general resurrection. Amillennial, postmillennial, and the prior "no future literal millennium" readings are no longer the project's framing. Where the timing of the church relative to the tribulation is in view, the project prefers the **pre-wrath** position (the church passes through the earlier tribulation and is gathered to Christ before the outpouring of God's wrath / the Day of the Lord) over pretribulational, midtribulational, or posttribulational alternatives. This is the view Willis holds and her publisher (Alan Kurschner / Eschatos Ministries) advances. The pre-wrath distinctive bears mainly on tribulation/rapture-timing descriptors, which are tangential to the heaven/New-Jerusalem focus but are locked here so the framing is unambiguous if such descriptors arise.

2. **New Jerusalem descends at the beginning of the millennium.** The city descends from heaven onto the renewed earth (Rev 21:2, 10) at the millennium's *start* and persists through the millennium and on into eternity. The load-bearing argument: the tree of life's leaves are "for the healing of the nations" (Rev 22:2), which requires **mortal nations present** — a condition that obtains during the millennium, not in the final sinless eternal state. The city is therefore the capital of the millennial earth before it is the eternal city, without discontinuity.

3. **Ezekiel 40–48 is a literal future millennial temple.** Ezekiel's temple, its ordinances, and its **functioning priesthood** describe a literal future sanctuary in **restored national Israel** during the millennium — not a typological/symbolic foreshadowing already fulfilled, and not the eternal New Jerusalem (which has "no temple", Rev 21:22). This directly reverses ADR 0008's typological reading. Willis's distinction holds: the temple/priestly district (Ezek 48:10) is **distinct from and adjacent to** the New Jerusalem city, and "the Father's house" (John 14:2) is the city itself, not the temple.

4. **Renewal over annihilation.** "New heavens and new earth" (Isa 65:17; 2 Pet 3:13; Rev 21:1) is read as the **renewal/transformation** of the present physical creation, in continuity with it — not its annihilation and replacement from nothing. The redeemed inherit an embodied, physical, located new creation.

5. **The intermediate state is a live category.** ADR 0008 collapsed the distinction between death-to-Christ and resurrection-to-glory. This ADR restores the classic distinction, which premillennialism makes load-bearing: because the **first resurrection** is a future event, believers who die before it are consciously with Christ in the interim (2 Cor 5:8; Phil 1:23; Luke 23:43) while awaiting bodily resurrection (1 Cor 15; 1 Thess 4:16). The disembodied believer with Christ now and the resurrected believer reigning in the millennium are the same person in two successive states, not two readings of one state.

6. **Three phases, not two ages.** The cosmology is no longer "this age / eternity." There are at least three distinguishable phases the dataset must be able to locate a descriptor within: the **present age**; the **millennial kingdom** (Christ reigning, New Jerusalem descended, restored Israel and its temple, mortal nations alongside resurrected saints); and the **eternal state** (the new creation in its final, deathless form). Some descriptors hold across all three; the schema must not force a descriptor into a single age when the text spans them.

## Consequences

### Data-model and schema

- ADR 0008 disabled `intermediate` as a valid `temporal_phase` value and re-tagged existing `intermediate` rows to `either`. This ADR **re-enables `intermediate`** as a valid value (per lock-down 5).
- The existing `temporal_phase` enum (`intermediate | final | either | unspecified`) does not cleanly express the **millennial** phase (lock-down 6). The schema likely needs either a new `millennial` value or a separate age-spanning field. This is a schema decision deferred to the Phase 1 data-model pass — Phase 1's canonical dataset is not yet built, so the cost of deferring is low. `docs/data-model.md` is not edited by this ADR; the change is noted here and will be applied when the schema is next touched.
- The two re-tags ADR 0008 performed (Heb 11:5 and Heb 12:23, `intermediate → either`) are to be **revisited** under the restored intermediate state; whether they return to `intermediate` or remain `either` is a reviewer call, not auto-reverted by this ADR.

### Extraction prompt

- The passage-extraction prompt must be updated to (a) re-add `intermediate` to the valid `temporal_phase` menu, (b) state the **premillennial** reading of Rev 20 and the first resurrection, (c) state that Ezekiel 40–48 is a literal future millennial temple, and (d) replace the single-heaven / two-age assumptions with the three-phase framing of lock-down 6. This is a prompt-version bump and must precede any extraction over Rev 19–22, Ezekiel 40–48, Isaiah 65–66, and the resurrection texts.

### Reviewer rubric

- The polarity of ADR 0008's rubric is **inverted**. Descriptors positing a future literal millennium, a literal future Ezekiel temple with a functioning priesthood, a real first resurrection, or a distinct intermediate state are **now approvable** under the project's framing rather than rejected. Descriptors that flatten the millennium into the church age, read Ezekiel's temple as already-fulfilled typology, or deny the intermediate state are the ones that now fall outside the framing.
- The `_review_help.html` partial in the review UI should be updated to reflect this framing when the review tool is built (Phase 1, M1.2).

### Phase 3 (3D world)

- ADR 0008 closed off the millennial design space (it explicitly simplified to "one heaven, not two phases"). This ADR **reopens it.** The premil-specific surroundings that the Willis source doc previously quarantined — the adjacent Ezekiel 40–48 temple + priestly district, the Holy Allotment landscape and tribal geography (Ezek 48), the Ezekiel 47 healing river issuing from the temple (distinct from the Rev 22:1 city river already built), and the dynamism of mortal nations making pilgrimage (Zech 14:16) — are now in-scope build targets. They are organized into a dedicated **Millennial-Kingdom milestone** in [`docs/roadmap.md`](../roadmap.md).
- The **existing pyramid city is unaffected.** Its architecture (terraced step-pyramid, summit aniconic throne, twelve gem foundations, Ezekiel-48 gate order, crystalline materials, glory-light, single Rev 22:1 river) was always framework-portable and did not depend on amillennialism — see [`RENDERING-DECISIONS.md`](../../RENDERING-DECISIONS.md) entry #1. No geometry is invalidated by this pivot; the pivot only adds surroundings the prior framing forbade.

### Q&A behavior (Phase 2)

- Questions like "is there a millennium?", "what is the intermediate state like?", "is the Ezekiel temple literal?" are now answerable **from the framing** (grounded in descriptors that pass the inverted rubric) rather than refused-with-pointer. The grounding contract is unchanged: every answer still cites descriptors, and questions with no grounded descriptor are still refused.

### Project readers outside this framing

- Amillennialists, postmillennialists, and Reformed Protestants who hold the collapsed intermediate state will now read the project's output as committed to a premillennial position they may not share. This is accepted and symmetric to ADR 0008's own caveat: ADR 0005 already established that any single hermeneutic excludes alternatives. The exclusion has simply moved.

## Migration

Concrete actions at this ADR's acceptance:

1. **ADR 0008** is marked `Superseded by: 0012` (its single permitted append; its body is left intact as the historical record per the append-only convention).
2. **`docs/hermeneutics.md`** is updated to reflect the premil stance wherever it leaned on the amil framing — the tier-table millennium/intermediate rows (§4), the symbolism treatment of Ezekiel 40–48 (§3), and the Phase-3 references (§8). The base posture, source ranking, and tier system are unchanged.
3. **`docs/sources/willis-new-jerusalem-model.md`** §"Eschatology" is rewritten: Willis's framework is now adopted in full, not quarantined. The "quarantine the premil-specific surroundings / tag debated" language is removed.
4. **`docs/roadmap.md`** gains a Millennial-Kingdom milestone (Ezekiel 40–48 temple complex; Holy Allotment + tribal geography; Ezekiel 47 healing river; mortal nations + pilgrimage dynamism).
5. **`RENDERING-DECISIONS.md`** entry #1 is verified to no longer imply the pyramid was a quarantine-bounded choice (it reads as framework-portable; confirmed accurate).

Deferred (not done by this ADR, recorded for the responsible later phase):

- The `temporal_phase` schema change (re-enable `intermediate`; express the millennial phase) — Phase 1 data-model pass.
- The extraction-prompt re-bump — before Stage B extraction.
- Revisiting the Heb 11:5 / Heb 12:23 tags — next reviewer pass.
- The `_review_help.html` rubric copy — Phase 1, M1.2.

## References

- [`0005-hermeneutic-policy.md`](0005-hermeneutic-policy.md) — base hermeneutic (unchanged, still in force)
- [`0008-eschatological-framing.md`](0008-eschatological-framing.md) — the amillennial framing this ADR supersedes
- [`0009-symbolic-vs-literal-rendering.md`](0009-symbolic-vs-literal-rendering.md) — rendering policy; its rules are tier-keyed and framework-independent, unaffected by this pivot
- [`0010-aniconic-policy.md`](0010-aniconic-policy.md) — divine-person depiction; absolute and unaffected
- [`../hermeneutics.md`](../hermeneutics.md)
- [`../sources/willis-new-jerusalem-model.md`](../sources/willis-new-jerusalem-model.md)
- [`../roadmap.md`](../roadmap.md)
- [`../../RENDERING-DECISIONS.md`](../../RENDERING-DECISIONS.md) entry #1
- [`../data-model.md`](../data-model.md) §`descriptor.temporal_phase` (schema change deferred)
