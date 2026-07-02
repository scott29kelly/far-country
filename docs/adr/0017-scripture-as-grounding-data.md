# ADR 0017 — Scripture as grounding data for parametric geometry

- **Status:** Accepted (2026-07-02)
- **Relates to:** [ADR 0009](0009-symbolic-vs-literal-rendering.md) (rule 4:
  geometry cannot footnote itself), [ADR 0012](0012-eschatological-framing-premillennial.md)
  (Ezekiel 40–48 as a literal future millennial temple),
  [ADR 0014](0014-citywide-scale-rendering.md) (citywide viewable scale),
  [ADR 0018](0018-units-and-scale-resolution.md) (the units/scale resolver this
  ADR requires)
- **Origin:** [`docs/plans/world-tooling-and-scriptural-grounding.md`](../plans/world-tooling-and-scriptural-grounding.md)
  §3 (Scott's reframe, 2026-06-22; §4 answers recorded 2026-07-02)

## Context

The 3D world's built content is dimensioned by hand-tuned constants (`NJ_SCALE`,
tier tables, placeholder temple boxes). Yet the project's own source text
contains a dimensional survey: **Ezekiel 40–42 is a measured walkthrough** of a
temple complex — a man with a measuring reed calls out exact cubit dimensions
for every gate, court, and chamber (with the unit itself defined in the text:
a reed of six long cubits, each "a cubit and a handbreadth," Ezek 40:5) — and
Ezekiel 45/48 and Revelation 21:15–17 measure the allotment and the city. The
analogy that surfaced this (a procedural-city pipeline that derives geometry
from open survey data rather than hand-tuning it) holds exactly: the inspired
text is the survey; geometry should be *derived from it, measured not
hand-tuned*. This is the strongest available expression of the project's #1
non-negotiable — every claim carries a citation — extended to geometry, which
otherwise "cannot footnote itself" (ADR 0009 rule 4).

What Scripture actually measures:

| Source | Gives |
| --- | --- |
| Ezekiel 40–42 | The temple complex, exhaustively (gates, courts, house, chambers, precinct) in long cubits |
| Ezekiel 43:13–17 | The altar |
| Ezekiel 45:1–6, 48:8–22, 30–35 | The holy allotment strips; the city 4,500 cubits/side + suburbs; twelve named gates |
| Revelation 21:15–21 | The city: 12,000 stadia (length = width = height), the 144-cubit wall, gates and foundations |

Two interpretive layers stand between these numbers and meters: (1) **units
are contested** (long vs common cubit; stadia; Willis's "12,000 stadia is the
area" reading vs the mainstream linear reading), and (2) **not everything
rendered is measured** (Ezekiel gives no height for the house; Revelation
gives no tier subdivision). A third layer is positional: whether Ezekiel's
city and John's city are the same, nested, or distinct is itself a `debated`
question.

## Decision

1. **Measurements become a first-class record type in the canonical store.**
   A `measurement` row carries the value and unit *as given in the text*
   (cubits, reeds, spans, stadia, counts) — never a metric conversion — under
   the same citation, tier (`clear`/`fuzzy`/`debated`/`symbolic`), and review
   discipline as descriptors. Schema: [`docs/data-model.md`](../data-model.md)
   §2a. Text-critical variants (e.g. ESV's LXX readings at Ezek 40:48–49, the
   cubits-vs-reeds question at 42:16–20) are recorded in the measurement's
   notes and tiered honestly, not smoothed over.

2. **Metric realization is a documented interpretation, applied at
   consumption.** A units/scale resolver (ADR 0018) converts text-native
   values to meters. Changing the interpretation (e.g. Willis's ~12-mi city vs
   the mainstream ~1,380-mi vs the viewable ~2.5-mi) changes the resolver, not
   the dataset — you restyle by changing the *reading*, never the recorded
   numbers.

3. **Geometry references measurements by ID.** Measurement records carry
   stable slugs (e.g. `ezt-precinct-side`), and builder code consumes them
   through a generated, citation-annotated module — so a reviewer can trace a
   wall's thickness in code back to Ezek 40:5 without leaving the editor.
   Hand-typed dimension literals in builders are the failure mode this ADR
   exists to eliminate.

4. **Every rendered dimension is either grounded or documented.** Grounded =
   backed by a measurement record (cited). Interpretive = an explicit
   rendering choice (heights Ezekiel omits, materials, step risers) recorded
   in `RENDERING-DECISIONS.md` per ADR 0009 rule 4. Nothing in between.

5. **The temple (Ezek 40–42 + the 43:13–17 altar) is the proof of concept.**
   It is the most exhaustively measured structure in the dataset, viewable at
   literal scale, and free of the city's interpretive baggage. The city's
   `NewJerusalemConfig` (plan §1 Phase B) becomes the later bridge for
   city-side measurements; Rev 21's records stay in the dataset under their
   existing tiers meanwhile.

## Consequences

- The dataset grows a table whose rows drive geometry directly; dataset review
  becomes, in part, geometry review. The review tool surfaces measurements
  like descriptors.
- The Ezekiel-city/John-city harmonization stays `debated` in the dataset (no
  committed position); the *render* follows Willis's harmonization, recorded
  in `RENDERING-DECISIONS.md` (plan §4 answer h).
- ESV text is still never redistributed: measurement rows carry numbers,
  references, and short notes — not passage text (ADR 0006 posture unchanged).
- The extraction pipeline gains a measurement seeding/export path; the
  LLM-assisted descriptor extractor is not reused for measurements (numeric
  precision demands human/agent authorship against the ESV text, verified
  citation-by-citation).
