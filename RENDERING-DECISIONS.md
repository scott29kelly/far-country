# Rendering Decisions (Phase 3 — 3D world)

Per [ADR 0009](docs/adr/0009-symbolic-vs-literal-rendering.md) **rule 4**, any
`debated`-tier descriptor that gets rendered in the 3D world must have a
documented decision here recording *which side the project rendered and why* —
because geometry cannot footnote itself. This file is that record.

**Two scenes, one policy.** As of [ADR 0013](docs/adr/0013-fork-laas-engine-for-3d-world.md),
there are two implementations: the legacy React Three Fiber scene at `/world`
(retired, redirects to `/world-preview`, kept only until parity) and the
vendored LAAS WebGPU engine at `/world-preview` (the current front door,
`apps/world-engine/src/nj/`). The decisions below govern *both* — a decision
made once is not re-litigated per renderer — but the engine port is behind on
implementing several of them. Each entry's "Code" pointer now lists both
scenes and notes which has actually implemented the decision. See
`docs/roadmap.md` Phase 3 for the up-to-date per-milestone port status.

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
- Code (legacy `/world`, retired per ADR 0013): `apps/web/src/lib/world/data/world-geometry.ts`, `components/Pyramid.tsx`
- Code (current `/world-preview`, per ADR 0013): `apps/world-engine/src/nj/CityMassing.ts` re-implements the terraced-mountain form with its own hand-tuned tier table (5 tiers, not the legacy 7/12-step model) — this entry's *decision* (mountain, not cube) still governs; the specific step count/heights are, per this entry's own "rendering choice, not a textual claim" note, implementation detail that has legitimately diverged between the two scenes. `apps/world-engine/src/nj/cityModel.ts` also carries a (currently unused/dead-code) `PYRAMID`/`TERRACES` table ported from the legacy model — see `docs/roadmap.md` Phase 3 M3.2 note and `apps/world-engine/STATUS.md`.

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
- Code (legacy `/world`, retired per ADR 0013): `apps/web/src/lib/world/data/points-of-interest.ts` (`GATES`)
- Code (current `/world-preview`, updated 2026-07-01): `apps/world-engine/src/nj/cityModel.ts`'s `GATES` table (Ezekiel order preserved) is now consumed by `CityMassing.ts` to build twelve real gate portals (gold jambs + pearl arch head) as gaps cut into the base-tier wall ring, at each gate's named side/offset. Not yet: tribe-name labels legible in-scene (a HUD/wayfinding concern, `CITY-QUALITY-BAR.md` delta #10) and gate collision (a player can already walk through the gap, which is correct, but the flanking jambs have no collision either). **Not visually re-verified live this session** — see `apps/world-engine/STATUS.md`'s "PENDING USER CONFIRM" note.

---

## Entry #3 — Depicting the inhabitants (great multitude + angelic hosts)

- **Date:** 2026-06-14
- **Tier:** the inhabitants are `clear` (Rev 7:9 and Rev 5:11 state them plainly);
  the *rendering choices* below are the interpretive part this entry records
  (ADR 0009 rule 4).
- **Question:** Should the explorable world depict the redeemed and the angels —
  and if so, how — given the aniconic policy (ADR 0010) and the
  no-invented-imagery non-negotiable (CLAUDE.md)?
- **Decision:** **Yes — depict both, reverently and without invented
  iconography.**

### Chosen rendering

- **Great multitude (Rev 7:9** — "a great multitude that no one could number...
  clothed in white robes, standing before the throne"): simplified white-robed
  luminous figures with **no facial or identity features**; a subtle scale and
  warm-tone variation implies the "every nation" diversity without depicting any
  specific person. Each figure faces the throne and holds a raised palm branch
  (Rev 7:9, "with palm branches in their hands"). Placed standing throughout the
  plaza and ascending the terrace courses, gathered toward the throne.
- **Angelic hosts (Rev 5:11** — "many angels... around the throne"): **abstract
  vertical beings of light** ringing the summit, slowly rising and falling. **No
  wings and no figural form** — Scripture does not fix the hosts' appearance in
  this text, so we do not invent it.

### Rationale

Rev 7:9 and 5:11 are clear-tier: an empty city under-represents the dataset
(heaven is *full* — of the redeemed before the throne and the hosts around it)
and reads as an architectural model rather than an inhabited place. ADR 0010's
aniconic restriction governs the **divine** persons only (kept as abstract light
at the summit, see `Throne.tsx`); the redeemed and the angels are creatures and
may be shown. The no-invented-imagery rule is honoured by **withholding** detail
Scripture does not give (no faces, no wings, no harps) rather than by omitting
the inhabitants altogether.

### What is grounded vs. a rendering choice

- **Grounded:** the existence, white robes, and palm branches of the multitude
  and its placement "before the throne" (Rev 7:9); the hosts "around the throne"
  (Rev 5:11).
- **Rendering choice (not a textual claim):** the *count* rendered (a legibility/
  performance stand-in for "no one could number"), the cone-robe + head-sphere
  silhouette, the abstract light-form for the hosts, exact positions, and the
  subtle tone variation.

### Governing sources

- Rev 7:9; Rev 5:11; ADR 0009 rule 4 (this entry's mandate); ADR 0010 (aniconic
  — divine persons only).
- Code (legacy `/world`, retired per ADR 0013): `apps/web/src/lib/world/components/Inhabitants.tsx`
- Code (current `/world-preview`): **not yet ported.** No population geometry exists in `apps/world-engine/src/nj/` — this is `docs/roadmap.md` Phase 3 M3.6, not started on either scene as of 2026-07-01.

---

## Entry #4 — The rainbow around the throne: full spectrum with emerald prominence

- **Date:** 2026-06-14
- **Tier:** `debated` (Rev 4:3 — "and around the throne was a rainbow that had
  the appearance of an emerald" — is read both as a green-dominant halo and as a
  full rainbow with emerald prominence).
- **Question:** Is the rainbow rendered as a GREEN/emerald halo (taking "the
  appearance of an emerald" as the dominant colour) or as a FULL spectral
  rainbow (taking "rainbow" as primary, with emerald prominence)?
- **Decision:** **Full spectral rainbow with an emerald bias.**

### Options considered

| Option | For | Against |
| --- | --- | --- |
| **Emerald-only halo** | Takes "appearance of an emerald" as the literal colour. | Underplays "rainbow" (Gk *iris*), which normally denotes the full bow. |
| **Full rainbow + emerald prominence** *(chosen)* | Honours "rainbow" (the spectrum) while giving the emerald its stated prominence via a green bias; reads unmistakably as the iris around the throne. | The exact colour balance is our choice, not stated. |

### Rationale

"Rainbow" (*iris*) most naturally denotes the spectral bow; "the appearance of
an emerald" is honoured by biasing the spectrum toward green rather than
discarding the other colours. A green-only ring would under-render "rainbow."
The sea of glass beneath it (Rev 4:6) is `clear`-tier and simply rendered as the
figure of the vision (a reflective crystalline floor, ADR 0009 rule 2) — no
debate, so no separate entry.

### What is grounded vs. a rendering choice

- **Grounded:** a rainbow encircling the throne, with emerald prominence
  (Rev 4:3); a sea of glass before the throne (Rev 4:6).
- **Rendering choice (not a textual claim):** the two-ring halo form, the
  additive glow, and the exact amount of green bias.

### Governing sources

- Rev 4:3; Rev 4:6; ADR 0009 rule 4.
- Code (legacy `/world`, retired per ADR 0013): `apps/web/src/lib/world/components/Throne.tsx` (`RainbowHalo`, sea of glass)
- Code (current `/world-preview`, **implemented 2026-07-02** in the M3 material pass): `apps/world-engine/src/nj/CityMassing.ts` now renders a horizontal full-spectrum ring (violet → emerald-prominent green → red, the emerald band alone grazing the bloom threshold) encircling the summit glory, plus a reflective crystalline sea-of-glass disc across the crown top. The glory sphere itself remains the conflated throne/glory-light primitive (aniconic per ADR 0010); a distinct throne treatment stays open.

---

## Entry #5 — New-earth landscape: the engine's wild terrain, unchanged (not an idealized paradise)

- **Date:** 2026-07-01 (retroactively documenting the decision made in commit `747db8e`, "Rebuild New Jerusalem scene on the full procedural landscape", which reversed the "idealized paradisal terrain" direction recorded in commit `e5667ec` and `docs/specs/phase-3-engine-integration.md` §5)
- **Tier:** the surrounding landscape is explicitly **not a cited descriptor** (`docs/specs/phase-3-engine-integration.md` §5, `docs/roadmap.md` Phase 3) — it is illustrative context for the New Jerusalem, which *is* cited. This entry exists because the choice of *what kind* of illustrative landscape touches the project's eschatological framing (ADR 0012) closely enough to warrant a documented rationale, even though no individual descriptor is at stake.
- **Question:** Should the "new earth" (Rev 21:1) the city sits on be rendered as the LAAS engine's default wild terrain (eroded mountains, forests, rivers, snow) unchanged, or should it be art-directed toward an idealized/paradisal look (gentler relief, calmer water, garden-like lushness) as `phase-3-engine-integration.md` §5 originally proposed?
- **Decision:** **Keep the engine's wild terrain unchanged.**

### Rationale

Two considerations, one engineering and one theological:

1. **Engineering.** Art-directing the heightfield/erosion/water systems toward a gentler "paradisal" look would mean tuning down exactly the systems ([PROJECT_LAAS_v2.md](apps/world-engine/PROJECT_LAAS_v2.md)'s pillars) the engine was forked to get right (ADR 0013). The wild terrain is also the vendored engine's proven, verified-against-reference quality bar (`apps/world-engine/docs/DELTA.md`); a bespoke "paradise" variant would need its own reference-delta loop from scratch.
2. **Theological.** Per [ADR 0012](docs/adr/0012-eschatological-framing-premillennial.md), the land the city descends onto at the *start* of this scene's implied timeframe is the **millennial earth**, not yet the fully renewed eternal state — Willis's own geography for this period (Ezek 47's healing river, Ezek 48's tribal allotments, Zech 14) describes a real, physically normal earth with mountains, rivers, and mortal nations on it, not an already-perfected Eden. A wild, geologically ordinary landscape is therefore not a theological overclaim; an artificially smoothed "paradise" would arguably overclaim eternal-state conditions the millennial framing doesn't yet grant. (This reasoning would need revisiting if a future phase renders the *eternal state* specifically, per `docs/roadmap.md` Phase 4.)

Both reasons point the same direction, so the engine's default terrain is used as-is, with only the Holy Allotment plateau lifted above it (a local, disclosed, non-cited platform for the city) rather than the landscape itself being retextured.

### What is grounded vs. a rendering choice

- **Grounded:** none — the surrounding landscape carries no descriptor and makes no claim about the millennial or eternal earth's actual appearance.
- **Rendering choice:** using the engine's unmodified wild-terrain generation as illustrative filler, rather than a bespoke "paradisal" variant.

### Governing sources

- [`docs/adr/0012-eschatological-framing-premillennial.md`](docs/adr/0012-eschatological-framing-premillennial.md) — millennial-earth framing this entry leans on
- [`docs/adr/0013-fork-laas-engine-for-3d-world.md`](docs/adr/0013-fork-laas-engine-for-3d-world.md) — why the terrain tech is worth keeping unchanged
- `docs/specs/phase-3-engine-integration.md` §5 — the original "idealized paradisal terrain" proposal this entry reverses
- Code: `apps/world-engine/src/nj/NewJerusalemScene.ts` (`buildTerrainScene(ctx)` call, unmodified)
