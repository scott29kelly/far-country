# Product Requirements Document — Far Country

**Status:** Draft, Phase 0
**Owner:** Scott Kelly
**Last updated:** 2026-05-21

---

## 1. Summary

Far Country is a biblically accurate world model simulation of heaven. The end product is an explorable 3D world paired with a grounded AI Q&A interface, both backed by a canonical dataset of descriptors of heaven extracted from Scripture (ESV) and Janet Willis's *What on Earth Is Heaven Like? A Look at God's City New Jerusalem*.

Every claim the app makes about heaven is traceable to a source citation. The hermeneutic is conservative Protestant, literal-where-possible. Material that is fuzzy, debated, or symbolic is preserved with explicit tagging rather than discarded.

---

## 2. Goals

1. Produce a canonical dataset of descriptors of heaven covering people, places, things, events, and attributes, every entry sourced and tier-tagged.
2. Make the dataset browsable and queryable by a non-technical user.
3. Provide a grounded AI Q&A interface that answers only from the dataset and cites its sources.
4. Render an initial explorable 3D representation of heaven (focus: the New Jerusalem) generated from the dataset.
5. Stay honest about the limits of the source material — debated and unclear entries are surfaced as such, never papered over.

---

## 3. Non-goals

- A theological monograph. Far Country is a reference and an experience, not an argument.
- A worship simulator, devotional gamification, or "heaven game."
- A multi-tradition harmonization. The hermeneutic is conservative Protestant; other traditions are noted in the dataset but not given equal interpretive weight.
- AI-generated speculation about heaven that goes beyond the dataset.
- Real-time multiplayer or social features in the 3D world (initial release).
- Mobile-native clients (web-first; mobile browser support yes, native apps no).

---

## 4. Users

| User | Primary need | What Far Country gives them |
| --- | --- | --- |
| Lay Christian studying heaven | A concrete, sourced picture of what the Bible says | Browseable dataset, grounded Q&A, explorable 3D |
| Pastor / teacher preparing material | Verifiable citations, organized by topic | Dataset filtered by entity type, with citations exportable |
| Student / researcher | A primary-source-grounded reference | Same as above, plus a way to trace fuzzy/debated entries |
| Curious / skeptical reader | A fair presentation of what Christians believe Scripture teaches | Same UI, with the hermeneutic and sources transparent |

---

## 5. Phased delivery

Full detail in [`roadmap.md`](roadmap.md). Summary here.

### Phase 1 — Dataset + Review Tool

**Deliverable:** A Python extraction pipeline that processes the ESV (via API) and Willis (locally-held text), produces candidate descriptors with confidence tiers, and feeds them into a human-review tool. The review tool is a minimal web UI over the same SQLite store. Output: a canonical dataset (SQLite + JSON export) that the later phases consume.

**Success criteria:**
- Pipeline produces at least one descriptor for every passage explicitly about heaven in the ESV.
- Every descriptor has at least one Scripture citation; Willis citations where applicable.
- Every descriptor has a confidence tier and a review status.
- The reviewer can move a descriptor from `pending` to `approved` / `rejected` / `needs-discussion` in under 10 seconds per entry.
- JSON export is well-typed and consumed by a placeholder Next.js app without transformation logic on the consumer side.

### Phase 2 — Browse UI + Grounded Q&A

**Deliverable:** A Next.js app that reads the dataset and provides (a) a browseable interface over entities and descriptors and (b) a chat interface that answers questions strictly from the dataset, citing descriptors on every answer.

**Success criteria:**
- Every entity in the dataset has a page with its descriptors, citations, and links to ESV / Willis sources.
- The Q&A interface refuses to answer when no grounded descriptor supports the answer (and says so clearly).
- A user can filter the browse view by entity type (person / place / thing / event / attribute) and by confidence tier.
- Latency: descriptor page < 200ms p95, Q&A response < 5s p95.

### Phase 3 — Explorable 3D World

**Deliverable:** A React Three Fiber layer inside the same Next.js app that procedurally assembles a 3D representation of the New Jerusalem and surrounding heavenly material from the dataset. The user walks the space; entities surface as clickable objects with descriptions and citations.

**Success criteria:**
- Initial scene covers at least: the city walls and gates (Rev 21:12–21), the river of life and tree of life (Rev 22:1–2), the throne (Rev 4–5; Rev 22:1–3), and a representative population of named persons.
- Every interactive object in the scene maps to at least one descriptor in the dataset.
- The scene loads and is navigable on a mid-range laptop in a current browser.

---

## 6. Constraints

- **Doctrinal:** Conservative Protestant, literal-where-possible. See [`hermeneutics.md`](hermeneutics.md).
- **Sourcing:** ESV is canonical translation. Willis is the primary structuring lens. Secondary sources only as context, never as primary sources for a descriptor.
- **Licensing:** Personal-study posture for now. Public distribution requires ESV API/permissions and Willis permission. See [`adr/0006-source-licensing-posture.md`](adr/0006-source-licensing-posture.md).
- **Builder context:** Solo + AI-assisted. Architecture must support long pauses between work sessions without losing coherence — hence documentation-first.

---

## 7. Open questions

- **Q1.** How do we handle the Old Testament intermediate-state vs the New Heavens-and-New-Earth final-state? One dataset with state markers, or two distinct datasets? *(Likely: one dataset, with a `temporal_phase` field per descriptor.)*
- **Q2.** Do we extract from non-canonical-but-influential sources (Pseudepigrapha, early church fathers)? Default: no, but track the question.
- **Q3.** What is the exact extraction prompt strategy — passage-by-passage, topic-by-topic, or entity-by-entity? Spec'd in `extraction-pipeline.md` but will need empirical refinement.
- **Q4.** For the 3D layer, do we represent symbolic descriptors literally (e.g., render gates as actual pearl) or signal symbolism visually (e.g., a pearl gate that shimmers with a "symbolic" indicator)? *(Likely: render with a visual indicator; mark symbolism in the UI.)*
- **Q5.** Is the grounded Q&A constrained to a fixed model, or do we let the user choose? *(Likely: fixed Anthropic Claude model for consistency, with model identifier surfaced.)*

---

## 8. Dependencies & risks

| Item | Type | Notes |
| --- | --- | --- |
| ESV API access (Crossway) | External dependency | Required for Phase 1; free tier may suffice for development |
| Janet Willis book — local copy + permission | External dependency | Personal-study use covers Phase 1; public distribution requires explicit permission |
| Anthropic Claude API | External dependency | For LLM-assisted extraction and grounded Q&A |
| Reviewer time | Internal | The human-review step is the slowest part of Phase 1; budget realistically |
| Doctrinal drift | Risk | Mitigation: hermeneutic policy is codified and ADR-locked; deviations require a new ADR |
| Symbolism mishandled | Risk | Mitigation: explicit `symbolic` tier with required `symbolic_referent` field; review pass focuses on this |
| 3D scope creep | Risk | Mitigation: Phase 3 scope is bounded to the New Jerusalem core elements above; expansion is a separate phase |

---

## 9. Metrics

Phase 1:
- Number of approved descriptors in canonical dataset.
- Number of pending descriptors in review queue.
- Tier distribution (clear / fuzzy / debated / symbolic).
- Citation coverage (% of descriptors with both ESV and Willis citations).

Phase 2:
- Q&A grounding rate (% of answers that cite at least one descriptor).
- Q&A refusal rate (% of questions correctly refused for lack of grounding).
- Time-on-page for descriptor / entity views.

Phase 3:
- Scene completeness (number of core elements rendered).
- Interactive-object-to-descriptor coverage.
- Load time on baseline hardware.

---

## 10. Approval / sign-off

This PRD is a living document during Phase 0. It will be locked at the start of Phase 1. Material changes after lock require a new ADR or PRD revision.
