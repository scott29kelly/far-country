# Rendering Decisions (Phase 3 — /world)

Per [ADR 0009](docs/adr/0009-symbolic-vs-literal-rendering.md) **rule 4**, any
`debated`-tier descriptor that gets rendered in the 3D world must have a
documented decision here recording *which side the project rendered and why* —
because geometry cannot footnote itself. This file is that record.

Entries are append-only in spirit: when a decision is reversed, add a new entry
that supersedes the old one rather than rewriting history. Each entry names the
question, the options, the choice, the rationale, and the governing source.

---

## Entry #1 — City vertical form: step pyramid (not cube)

- **Date:** 2026-05-29
- **Tier:** `debated` (the overall *shape* of the New Jerusalem is not stated
  plainly; Rev 21:16 gives equal length/width/height but not a solid form).
- **Question:** Is the city rendered as a **cube** (the common reading, drawn
  from the Holy of Holies, 1 Kgs 6:20, applied to "its length and width and
  height are equal", Rev 21:16) or as a **step pyramid / terraced mountain**
  (Janet Willis's reading)?
- **Decision:** **Step pyramid (terraced ziggurat), throne at the summit.**

### Options considered

| Option | For | Against |
| --- | --- | --- |
| **Cube** | Most common popular reading; simplest reconciliation of Rev 21:16's equal dimensions; echoes the cubic Holy of Holies. | A solid 1,380-mi (or even ~12-mi) cube is hard to inhabit/envision (MacArthur: "difficult to envision"); leaves the throne with no natural apex; doesn't engage the "holy mountain of God" texts. |
| **Step pyramid** *(chosen)* | The dwelling of God is repeatedly "the holy **mountain**" (Isa 2:2; Zech 8:3; Ps 48:1–2; Ex 15:17); Isa 2:2 "a mountain on top of the mountains"; Amos 9:6 stepped "upper chambers" (*maʿalah* = stairway); the twelve gem foundations read naturally as decreasing-width terraces / "great step-backs" (Alva McClain); throne/glory at the apex (Paul Enns); equal length/width/height still satisfied by a square-base pyramid bounded by an equal-sided box. | The pyramid shape is *argued*, not stated; Willis herself hedges it as "a plausible conception"; the stepped specifics (riser count, summit width) are not in the text and are our rendering choice. |

### Rationale for choosing the pyramid

The project **defers to Willis for the architecture of the 3D world** (her book
is the primary structuring lens, per [hermeneutics.md §2](docs/hermeneutics.md)).
Her mountain model is *framework-portable* — it does not depend on the
premillennial eschatology at all, which is why the pyramid was safe to build
before the eschatology question was settled. That question is now settled:
[ADR 0012](docs/adr/0012-eschatological-framing-premillennial.md) adopts Willis's
premillennial New Creationism in full, superseding
[ADR 0008](docs/adr/0008-eschatological-framing.md) — and the pyramid stands
unchanged either way (it was never quarantine-bounded; only the premil-specific
*surroundings* were, and they are now in scope per Phase 4 of the roadmap).
Rendering the
city as a luminous crystal mountain with the aniconic throne at its summit
engages the "holy mountain of God" texts the cube reading leaves on the table,
and gives the foundations, the river, and the throne their natural vertical
relationship (foundations as stepped courses; river cascading from the summit
throne down to the gates).

### What is text-grounded vs. a rendering choice

- **Grounded:** equal length/width/height (Rev 21:16, satisfied by a
  square-based pyramid in an equal-sided bounding box); twelve foundations
  (Rev 21:19–20); throne (Rev 22:1, 3); glory as light at the centre/top
  (Rev 21:23). The mountain identification rests on the texts cited above.
- **Rendering choice (not a textual claim):** `steps = 7`, `stepHeight = 12 m`,
  `summitHalf = 18 m`, the linear terrace taper, and the placeholder ~200 m
  scale. Scale stays deferred per **ADR 0009 rule 6** — only the *shape*
  changed here; the 12,000-stadia measurement is still not honoured, and the
  world makes no signage claim about its size.

### Cube alternative — preserved

The cube reading is **not discarded**, only not rendered. A future phase (or a
different hermeneutic lens) could render the same dataset as a cube; the dataset
itself commits to neither. This entry exists so the rendered pyramid is read as
*a decision*, not an accidental graphical convenience.

### Governing sources

- [`docs/sources/willis-new-jerusalem-model.md`](docs/sources/willis-new-jerusalem-model.md) — "Shape — a step pyramid / mountain (NOT a cube)"
- [`docs/adr/0009-symbolic-vs-literal-rendering.md`](docs/adr/0009-symbolic-vs-literal-rendering.md) rule 4 (this file's mandate) and rule 6 (scale deferral)
- Code: `apps/web/src/lib/world/data/world-geometry.ts`, `components/Pyramid.tsx`

---

## Entry #2 — Tribe → gate ordering: Ezekiel 48:30–34 (not Revelation 7)

- **Date:** 2026-05-29
- **Tier:** `debated` (Scripture names the twelve tribes on the gates, Rev
  21:12, but does not assign tribes to specific sides; the two candidate
  orderings differ in *which* tribes appear).
- **Question:** Which tribal list and side-assignment do the twelve gates use?
- **Decision:** **Ezekiel 48:30–34.**

### Options considered

| Option | Notes |
| --- | --- |
| **Revelation 7:5–8** (the world's previous, illustrative order) | The 144,000 sealing list. Substitutes **Manasseh for Dan** and lists **Joseph** (not Ephraim). Does not assign tribes to compass sides; the previous `/world` assignment was admittedly arbitrary. |
| **Ezekiel 48:30–34** *(chosen)* | Explicitly assigns three named gates to each compass side, and is the only passage that *does* so. Keeps **Dan** and **Joseph** (no Rev 7 substitution). Willis harmonises the New Jerusalem's gates to this list. |

### Chosen assignment

- **North:** Reuben, Judah, Levi
- **East:** Joseph, Benjamin, Dan
- **South:** Simeon, Issachar, Zebulun
- **West:** Gad, Asher, Naphtali

### Rationale

Ezekiel 48 is the only text that fixes tribes to sides, so it removes the
arbitrariness of the previous Rev 7 placement; and it matches Willis's
harmonisation of Ezekiel's city with John's. The gate **labels in `/world`
carry the compass side** (e.g. "Reuben Gate · N") so the assignment is legible
in-scene. The dataset descriptor for the gates remains the plain Rev 21:12–13
statement; this entry governs only the *placement*.

### Governing sources

- [`docs/sources/willis-new-jerusalem-model.md`](docs/sources/willis-new-jerusalem-model.md) — "Tribe → gate ordering (Ezekiel 48:30–34)"
- Code: `apps/web/src/lib/world/data/points-of-interest.ts` (`GATES`)
