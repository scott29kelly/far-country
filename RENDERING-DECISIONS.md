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

---

## Entry #6 — Ezekiel's city and John's city: held `debated`, rendered per Willis's harmonization

- **Date:** 2026-07-02
- **Tier:** `debated` — whether the city of Ezekiel 48:30–35 (4,500 cubits per
  side plus suburbs, twelve tribal gates) and the New Jerusalem of Rev 21–22
  (12,000 stadia, twelve tribal gates) are the **same** structure, **nested**
  structures, or **distinct** cities is a genuine interpretive dispute; the
  dataset commits to no position (plan §4 answer h, 2026-07-02).
- **Question:** When the 3D world renders one city with twelve tribe-named
  gates on the Holy Allotment, whose identification is it depicting?
- **Decision:** **Render Willis's harmonization** — one city, Ezekiel's and
  John's descriptions mutually interpreting (her signature move: Ezekiel's
  ~11-mi city compatible with John's ~12-mi under her area reading of Rev
  21:16), sited at the south-centre of the allotment with Ezekiel's gate
  order (Entry #2). The **dataset stays uncommitted**: descriptors for the
  identification question remain `debated`, and no descriptor asserts the
  cities are identical.

### What is grounded vs. a rendering choice

- **Grounded:** each city's own measured description (Ezek 48:30–35; Rev
  21:12–17); the twelve tribal gates in both; the allotment siting
  (Ezek 48:15–19).
- **Rendering choice:** depicting them as one structure (Willis), rather
  than two cities or an agnostic omission.

### Governing sources

- [`docs/sources/willis-new-jerusalem-model.md`](docs/sources/willis-new-jerusalem-model.md) (size/harmonization sections; 4Q554 corroboration)
- [`docs/plans/world-tooling-and-scriptural-grounding.md`](docs/plans/world-tooling-and-scriptural-grounding.md) §4 answer h
- [ADR 0017](docs/adr/0017-scripture-as-grounding-data.md) consequences; ADR 0009 rule 4
- Code: `apps/world-engine/src/nj/CityMassing.ts` (one city, Ezekiel gate order), `apps/world-engine/src/nj/Allotment.ts` (south-centre siting)

---

## Entry #7 — Ezekiel's temple: literal-cubit compound; the interpretive remainder

- **Date:** 2026-07-02
- **Tier:** mixed — the dimensions are mostly `clear` measurements
  ([`data/exports/measurements.json`](data/exports/measurements.json), ADR
  0017); this entry records the `debated`/`fuzzy` readings rendered and the
  dimensions Ezekiel does not give, which are rendering choices.
- **Question:** How is the Ezek 40–42 temple complex realized as geometry
  where the text is contested or silent?
- **Decision:**
  1. **Precinct at 500 cubits per side (ESV), not 500 reeds (MT/NASB).**
     Ezek 42:16–20 is a genuine translation dispute (`ezt-precinct-side`,
     tier `debated`). The ESV's 500 cubits is rendered; it also closes the
     survey's own east–west arithmetic exactly (gate 50 + court 100 + gate
     50 + inner court 100 + house 100 + yard/building 100 = 500, Ezek
     40:15, 19, 47; 41:13).
  2. **ESV's Septuagint readings render as printed** (vestibule breadth 12,
     Ezek 40:49; gate breadth 14, Ezek 40:48; ten steps, 40:49) — each
     recorded `fuzzy` with the Hebrew variant in its notes.
  3. **Heights Ezekiel omits are interpretive:** the house walls render at
     ~30 cubits (the 1 Kgs 6:2 Solomonic-temple analogy — an analogy, not a
     citation), gatehouses tower over the one-reed perimeter wall
     (fortified-gatehouse massing implied by their 50×25 guardroom plans),
     step risers ~0.22 m. Explicit verticals ARE grounded: the one-reed
     outer wall (Ezek 40:5), the six-cubit house platform (41:8), the
     eleven-cubit altar stack (43:13–15), three-story chamber blocks
     (41:6; 42:3–6).
  4. **Materials and fortress dressing are art direction:** warm red
     sandstone, crenellations, and corner towers come from the approved
     reference set (USER-REFS #5), not the text — same illustrative posture
     as Entry #5's landscape. The text's own dressing that IS rendered:
     windows (40:16), palm-tree jamb motifs (40:16; 41:18–20, simplified),
     the glowing sanctuary interior (glory imagery, Ezek 43:4–5).
  5. **Placement stays compressed placeholder geography** (ADR 0009 rule 6,
     ADR 0015): the compound's *dimensions* are literal (ADR 0018), its
     *location* on the allotment (north of the city, in the priests' band)
     is proportional, not surveyed. The Ezek 47 river issuing from under
     the threshold is deferred to the Millennial-Kingdom milestone
     (roadmap M4) and not yet rendered.

### What is grounded vs. a rendering choice

- **Grounded:** every dimension in `measurements.json` (plans of gates,
  courts, house, chambers, west building, precinct, altar — Ezek 40:5–47;
  40:48–41:15; 42:1–20; 43:13–17), gate/steps counts, eastward altar steps
  (43:17), three outer + three inner gates (E/N/S; none on the west).
- **Rendering choice:** house/gatehouse heights, step risers, red-sandstone
  palette, crenellations and corner towers, window glow intensity, and the
  plinth that seats the literal-scale compound on the rolling meadow.

### Governing sources

- ESV Ezekiel 40–43 (via the ESV API; text not stored, ADR 0006)
- [ADR 0017](docs/adr/0017-scripture-as-grounding-data.md), [ADR 0018](docs/adr/0018-units-and-scale-resolution.md), [ADR 0012](docs/adr/0012-eschatological-framing-premillennial.md)
- `apps/world-engine/reference-city/USER-REFS.md` directive #5 (temple identity)
- Code: `apps/world-engine/src/nj/Temple.ts` (world-space literal-cubit build), `apps/world-engine/src/nj/templeModel.ts` (resolver), `apps/world-engine/src/nj/templeMeasurements.gen.ts` (generated dataset module)

---

## Entry #8 — The dwelling campus: cited zone, illustrative content

- **Date:** 2026-07-02
- **Tier:** mixed — the *zone* is grounded (`clear`); everything built *in* it
  is interpretive art direction this entry records (ADR 0009 rule 4). This is
  a third posture class alongside entry #5 (wholly non-cited landscape) and
  entry #7 (measured structure with an interpretive remainder): a zone
  Scripture names and even measures at district scale, filled with content
  Scripture does not describe.
- **Question:** How is the dwelling zone of the holy district realized as
  geometry when the text grounds its existence and band structure but gives
  no house dimensions, counts, or village layouts?
- **Decision:** render TWO named bands of world-space, human-scale
  garden-court blocks (`apps/world-engine/src/nj/Dwellings.ts`), replacing
  the ×20-frame placeholder slab grid.

### What is grounded vs. a rendering choice

- **Grounded (zone level only):** the holy district contains a portion for
  the ministering priests, the sons of Zadok, which is "a place for their
  houses" beside the sanctuary (Ezek 45:4; 48:10–12); the Levites have their
  own adjacent, equally-sized portion (Ezek 45:5; 48:13–14); the sanctuary
  stands within the priests' portion, "in the midst" of it (Ezek 48:8, 10) —
  rendered by placing the temple among the priests' band rows, flanked north
  and south. The city strip lies to the south (Ezek 45:6; 48:15–19 — the
  siting entry #6 already governs).
- **Rendering choice (not a textual claim):** every dimension and count —
  108 m court blocks on a 150 m pitch (priests' band), 190 m podium-ring
  blocks on a 300 m pitch (Levites' band), house plans (5.5–13 m footprints,
  1–2 stories), attached row-house perimeters with stepped rooflines, hedges,
  court wells, gate posts, gable/hip clay roofs, limewash/sandstone/whitewash
  palettes, warm window glow, the temple close and east processional widths,
  the meridian lane on the city→temple axis, and the northward thinning of
  the Levites' band. House counts are a legibility stand-in for an inhabited
  district, not a census (the entry #3 multitude precedent). Art direction
  sources: the approved reference set (gemini-render-1 garden-court blocks;
  USER-REFS directives #3 hedgerows / #6 inhabited ordinary-scaled villages)
  — the same illustrative posture as entry #7 point 4. Houses render at
  literal human scale inside the compressed district geography (the ADR 0018
  two-regime honesty; placement remains ADR 0009 rule 6 placeholder).
- **Knowingly not honoured yet:** the district's own measured proportions
  (Ezek 45:1–6; 48:8–22 — the 25,000 × 10,000-cubit strips). ADR 0017's
  scope table lists these, but the canonical store carries no allotment-strip
  measurement records yet, and hand-typing their ratios into the builder is
  the exact failure mode ADR 0017 decision 3 forbids. The band split rendered
  here is therefore explicitly UNCITED art direction echoing the two-band
  structure, until the allotment measurements are seeded (queued follow-up)
  and consumed through a generated module per ADR 0017 — at which point the
  campus proportions become resolver-driven and this entry gets a successor.
- **Guardrails:** no POI/HUD card may anchor a Scripture citation to a
  specific house, hedge, or well — the zone-level descriptor cites Ezek
  45:4–5; individual buildings assert nothing. Wayfinding signposts and
  invented place-names (USER-REFS #6 shows "ZADOKSBURG / LEVITESVILLE") are
  EXCLUDED from this milestone; invented proper names are a materially larger
  posture risk needing their own decision when M3.4 wayfinding lands.

### Governing sources

- Ezek 45:1–6; 48:8–22 (zone structure; ESV via API at authoring time, text
  not stored — ADR 0006)
- [ADR 0009](docs/adr/0009-symbolic-vs-literal-rendering.md) rules 4/6,
  [ADR 0017](docs/adr/0017-scripture-as-grounding-data.md) decisions 3–4,
  [ADR 0018](docs/adr/0018-units-and-scale-resolution.md)
- `apps/world-engine/reference-city/USER-REFS.md` directives #3/#6;
  gemini-render-1 (local reference set)
- Code: `apps/world-engine/src/nj/Dwellings.ts` (both bands, kit, podium
  footings), `apps/world-engine/src/nj/NewJerusalemScene.ts` (mount + far
  groundProbe wrap), `apps/world-engine/src/nj/Allotment.ts` (megabox grid
  removed)
