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
- Code (current `/world-preview`, **implemented 2026-07-18** — M3.6 first pass): `apps/world-engine/src/nj/populationModel.ts` (CPU-pure placements: 40 worship assemblies on the plaza ring + tier 1–3 terrace pavements, every figure on a real walk floor; 12 host clusters ringing the summit off the cardinal meridians) and `apps/world-engine/src/nj/Population.ts` (instanced robe/head/palm figures with per-instance warm-tone/scale variation; core+halo light-pillar hosts with a shader-time rise/fall). Pick registry anchors the assemblies to `great-multitude` (Rev 7:9) and the host ring to `myriads-of-angels` (Rev 5:11 — this entry's own citation; the similar `angels-around-throne` entity is Rev 7:11). Verification: `apps/world-engine/STATUS.md` 2026-07-18 later-5 entry.

### Addendum (2026-08-03) — the multitude re-rendered under ADR 0019

[ADR 0019](docs/adr/0019-photorealistic-redeemed-humans.md) (2026-08-01,
Scott's directive on Rev 7:13–14) supersedes this entry's "no facial or
identity features" clause **for the redeemed only**: the multitude is
explicitly identified as redeemed *humans*, so rendering them as visibly
unhuman abstractions under-claimed the text. The chosen rendering is now
**generic, anonymous, visibly diverse human beings** — six seeded body
archetypes spanning age and build, skin and hair tones drawn uniformly
across full palette ramps ("from every nation… all tribes and peoples and
languages", Rev 7:9), white robes and raised palm branches kept, every
figure still facing the summit light (ADR 0010 pattern unchanged).

What withholding remains is now an *engineering* state, not the policy:
faces are currently featureless (a nose hint, no eyes or mouth) because the
near-ring photoreal tier awaits the authoring-posture decision recorded in
`apps/world-engine/STATUS.md` (2026-08-03). The policy ceiling is ADR 0019
itself: photoreal is permitted; portraits and named-person likenesses are
not. **The hosts are unchanged** — ADR 0019 rule 5 leaves the abstract
light-pillar rendering above exactly as this entry settled it.

- Code (2026-08-03 rebuild): `apps/world-engine/src/nj/figureModel.ts`
  (archetypes, palettes, per-figure seeded params — diversity as data),
  `FigureMesh.ts` (one parametric generator, both LOD meshes),
  `Crowd.ts` (GPU compute-cull → per-ring indirect draws; far ring as
  captured atlas impostors). Placements unchanged
  (`populationModel.multitudePlacements()`), so every 2026-07-18 floor/
  clearance/pick verification carries over; new budget/diversity probe:
  `apps/world-engine/tools/probe-crowd.ts`.

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

### Addendum (2026-07-25) — the rainbow is no longer depicted

Scott saw the ring in-scene and called it: removed. Nothing is now built above
the crown. The glory sphere had already gone the same way on 2026-07-20, so the
summit carries **no discrete object at all** — ADR 0010's aniconic posture,
previously a statement about *how* the throne is depicted, is now total.

The reasoning above is untouched and stands: **if** the rainbow is rendered, it
is a full spectrum with emerald prominence. What changed is the prior question
of *whether* to render it. That is a rendering choice, not a claim about the
text: Rev 4:3 remains in the dataset with its `debated` tier, and the browse UI
and the HUD still surface it. This entry now records that the world declines to
depict it — the honest position when a depiction reads as an artifact rather
than as glory.

Consequences carried through in the same pass, since geometry and analytic
volumes must agree:

- The `throne-of-god` **pick volume** was a sphere centred 10 local above the
  crown, sized to enclose the ring. It now sits on the crown (`CITY_SUMMIT_Y +
  2`, r 12 local) — the emissive crown and the sea of glass are what carry
  Rev 21:23's light now. A pick floating in empty sky would pop a card for a
  click on nothing.
- The **reading-key marker** dropped with it, for the same reason: a marker
  points at something.
- The `summit-overlook` navigation target reads "Sea of glass before the
  throne" (Rev 4:6); its old copy advertised the halo.

Do not reintroduce a summit object without Scott's word.

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
  6. **(Amended 2026-08-02) The counted flights are rendered and walkable,
     and the courts stand at their heads:** the outer court rises the seven
     steps its gates are climbed by (Ezek 40:22, 26 — 40:6 climbs the east
     one), the inner terrace the inner gates' eight (40:31, 34, 37). The
     text gives the counts; the riser stays point 3's ~0.22 m, and the
     ~0.45 m tread depth, parapet cheeks with pale caps, and tread nosing
     bands are interpretive stair dressing in point 4's posture.

### What is grounded vs. a rendering choice

- **Grounded:** every dimension in `measurements.json` (plans of gates,
  courts, house, chambers, west building, precinct, altar — Ezek 40:5–47;
  40:48–41:15; 42:1–20; 43:13–17), gate/steps counts, eastward altar steps
  (43:17), three outer + three inner gates (E/N/S; none on the west).
- **Rendering choice:** house/gatehouse heights, step risers and tread
  depth, the stair parapet dressing, red-sandstone palette, crenellations
  and corner towers, window glow intensity, and the plinth that seats the
  literal-scale compound on the rolling meadow.

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
- **Addendum (2026-07-21):** the "queued follow-up" above is partially
  discharged. Track A seeded the Ezek 45/48 allotment measurements into the
  canonical store (`priests-portion`, `levites-portion` among the new zone
  entities), and the campus now PICKS at zone level: two pick volumes and two
  reading-key markers derive from the band tables (extracted to
  `campusModel.ts` so builder, picks, and key share one owner table), and the
  HUD card renders the zones' cited measurement records. The guardrail holds
  — the zones are cited, individual buildings still assert nothing. What
  remains of the follow-up: the builder itself does not yet consume the
  generated `allotmentMeasurements.gen.ts` (EZA) module, so the band split's
  proportions are STILL uncited art direction; the resolver-driven proportion
  pass (Phase B config work) is the point at which this entry gets its
  successor. **Discharged 2026-07-22: entry #11 is that successor** — the
  band extents are now resolver-driven from EZA; this entry's content-level
  postures (kit, counts, guardrails) remain in force.

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

---

## Entry #9 — Arrival audio: procedural illustrative ambience, no cited soundscape

- **Date:** 2026-07-06
- **Tier:** none — this is wholly ILLUSTRATIVE context (the entry #5 posture
  applied to sound), recorded because `docs/roadmap.md`'s audio ground rule 3
  requires a decision entry when score/ambience ships.
- **Question:** How does the arrival experience gain sound (boot bed, spawn
  meadow ambience, an approach score cue) without making any uncited claim
  about heaven's soundscape and without external assets or licensing risk?
- **Decision:** synthesize everything at runtime with WebAudio
  (`apps/world-engine/src/audio/Ambience.ts`): a preparation drone under the
  boot rite, a wind/river/birdsong bed for the spawn meadow, and one slow
  gold-chord cue on the first south-approach crossing (a softer voicing marks
  ready). No audio files exist, so the engine's zero-external-assets rule and
  ADR 0006's licensing posture are untouched (nothing is redistributed), and
  the roadmap's suggested ElevenLabs first deliverable is superseded by this
  zero-asset equivalent for the same two deliverables.
- **Guardrails:** no voiced Scripture of any kind without the Crossway
  licensing check (roadmap ground rule 2); no sound is presented as a
  descriptor or cited content — it is mood, exactly like the wild landscape;
  `?audio=0` disables construction entirely and `M` mutes, so every probe and
  capture path is silent by default (tooling passes `rite=0`, which also
  skips audio).

### Governing sources

- None (illustrative). Posture: entry #5; `docs/roadmap.md` Operational
  backlog "Audio layer" ground rules 1–3.
- Code: `apps/world-engine/src/audio/Ambience.ts`,
  `apps/world-engine/src/main.ts` (NJ-only literal branch, arrive/update
  wiring)

## Entry #10 — Processional ascent: interpretive ramps within the step-mountain form

- **Date:** 2026-07-21
- **Tier:** none — ILLUSTRATIVE architecture inside the entry #1
  `debated`-tier step-mountain form. Recorded because the ramps add visible
  massing to the city and must never be mistaken for a cited feature.
- **Question:** A walker could reach the street-of-gold plaza through the
  gates (M3.2) but every higher pavement — plinth top, terrace rings, the
  crown's sea of glass — was reachable only by switching to fly. How does
  the city become traversable on foot without inventing a cited stair?
- **Decision:** two mirrored boustrophedon chains of solid ivory wedge
  ramps (east and west faces), five climbs each, plaza → plinth → terraces
  → crown (`apps/world-engine/src/nj/ascentModel.ts`). Scripture describes
  the city's height (Rev 21:16) but no stair or ramp; ziggurat-style
  processional ramps are the natural circulation of the step-pyramid form
  entry #1 already adopted from Willis's artwork, so the ascent is carried
  as part of that same interpretive decision. The ramps are deliberately
  UNPICKABLE — clicking one cites nothing (the dwelling-campus precedent:
  no canonical entity may be invented for them) — and the reading key
  (M3.5) ignores them for the same reason.
- **Guardrails:** every placement derives from the shared cityModel tables
  and dodges the gate corridors and every worship assembly
  (probe-asserted, `tools/probe-ascent.ts`, including a simulated full
  walk from the southeast gate to the sea of glass); no new emissive
  material (ivory pavement — the bloom contract is untouched); the sloped
  tops are single-owner planes under the later-6 z-fight rule.
- **Correction shipped with this entry:** the jasper wall was previously
  modelled (and collided) as a solid 12-local-deep fill from the plinth to
  the wall line, which entombed all sixteen plaza-ring worship assemblies
  in masonry — invisible and unreachable. The wall is now a slab at the
  wall line (`WALL_INNER`), opening the covered street-of-gold gallery
  where those assemblies stand; Rev 21:18 gives the wall's material and
  Rev 21:17 its height-or-thickness measure (144 cubits, held per entry
  #6's scale posture), but Scripture does not give the wall's depth
  profile, so the slab-vs-fill choice is illustrative massing.

### Governing sources

- Entry #1 (step-mountain form, `debated`); entry #8 (uncited-content
  precedent). Rev 21:16-18 for what IS cited about the structure.
- Code: `apps/world-engine/src/nj/ascentModel.ts`,
  `src/nj/CityMassing.ts` (wedges, pads, cornice stairwell slots, wall
  slab), `src/nj/cityCollide.ts` (surface claims, flank blocks, gallery),
  `src/nj/populationModel.ts` (plaza ring recentred into the gallery),
  `tools/probe-ascent.ts`

---

## Entry #11 — Campus proportions: resolver-driven from the Ezek 45/48 measurements

- **Date:** 2026-07-22
- **Tier:** mixed — the band EXTENTS are now grounded (`clear` measurement
  records); the district-scale factor and everything built inside the bands
  remain interpretive. This entry is the successor entry #8 promised for its
  "knowingly not honoured yet" clause.
- **Question:** How do the dwelling bands consume the seeded Ezek 45/48
  allotment measurements (`allotmentMeasurements.gen.ts`, EZA) so their
  proportions stop being uncited art direction (ADR 0017 decision 3)?
- **Decision:** a declared district-scale resolver mode,
  `compressed-district` at `0.1 m per long cubit`, in the new Phase B
  `NewJerusalemConfig` (`apps/world-engine/src/nj/config.ts`); the campus
  owner table (`campusModel.ts`) now derives its band rects from EZA through
  it, and the block grids are FITTED inside those cited rects instead of
  defining them.

### What is grounded vs. a rendering choice

- **Grounded (via EZA at the declared scale):** the priests' portion is
  25,000 × 10,000 long cubits (`eza-priests-portion-length/-breadth`, Ezek
  45:3; 48:10) → 2500 × 1000 m; the Levites' portion is its EQUAL alongside
  (`eza-levites-portion-length/-breadth`, Ezek 45:5; 48:13) → the bands now
  render at the text's own proportions — equal breadths (previously the
  Levites' band was 3.76× the priests', contradicting the text), the shared
  2.5:1 length, adjacency (Ezek 48:13), and the sanctuary centered in the
  priests' breadth ("in their midst," Ezek 48:10; the band straddles
  `TEMPLE_SITE.z` symmetrically).
- **Rendering choice (documented interpretation):** the factor 0.1 itself —
  derived from the engine constraint that priests'-band houses must ground
  on the detailed-terrain heightfield mirror (|z| ≤ 6144): centering 10,000
  cubits of breadth on the temple's z = -5600 against that edge gives
  ~1000 m, i.e. a 5.25× compression of the literal cubit (ADR 0018
  decision 4 mode; ADR 0009 rule 6 placeholder geography; the ADR 0014
  precedent). Also interpretive, unchanged from entry #8: the block kit and
  pitches, the grid fit inside the rects, the meridian lane and east
  processional clearings, and the Levites' 350 m meadow break past the
  tile/far-shell seam (the ZONE starts at the cited boundary; the podium
  regime needs the far shell).
- **Deliberate consequences:** (1) the campus shrinks — the freed plateau
  east and west of the district square reads as the prince's portion, which
  Scripture places "on both sides of the holy district and the property of
  the city" but never measures spatially (Ezek 48:21-22) — deliberately
  unbuilt, no records invented; wild scatter reclaims it (the exclusion
  envelope now derives from the cited rects). (2) The 45:2 sanctuary-plot
  records (500 cubits + 50 open) are NOT consumed at district scale: the
  temple compound renders literal-cubit (entry #7, ADR 0018 decision 2) and
  overflows the 60 m district-scale plot — the two-regime honesty, same
  posture as the literal temple beside the interpreted-scale city.
- **Guardrails:** entry #8's hold — zones cited, individual buildings
  assert nothing; no entity invented for the prince's portion or tribal
  strips (no spatial numbers exist to seed). Pick volumes and reading-key
  anchors keep deriving from the same owner table (`campusModel.ts`), so
  HUD citations and rendered extents cannot desync.

### Governing sources

- Ezek 45:1-6; 48:8-22 (via the seeded EZA measurement records — ESV text
  not stored, ADR 0006)
- [ADR 0017](docs/adr/0017-scripture-as-grounding-data.md) decisions 2-4,
  [ADR 0018](docs/adr/0018-units-and-scale-resolution.md) decision 4,
  [ADR 0009](docs/adr/0009-symbolic-vs-literal-rendering.md) rules 4/6
- Code: `apps/world-engine/src/nj/config.ts` (NewJerusalemConfig + district
  resolver), `src/nj/campusModel.ts` (cited rects, fitted grids),
  `src/nj/Dwellings.ts` (consumer), `src/nj/NewJerusalemScene.ts` (scatter
  envelope), `tools/probe-entitypick.ts` / `probe-campus-live.ts`

## Entry #12 — City footprint: the cited 12,000 stadia through a declared resolver

- **Date:** 2026-07-22
- **Tier:** mixed — the city SIDE is grounded (`rev-city-side`, tier
  `clear`); the compression factor, the interior massing, and the wall's
  dimensions remain interpretive. Companion to entry #11: the same
  resolver pattern, city side.
- **Question:** Rev 21:15-17 is the one place John's vision gives numbers
  (the measuring-rod passage). How does the rendered city consume them so
  its footprint stops being an uncited placeholder (ADR 0017 decision 3)?
- **Decision:** seed the two Revelation records (`rev-city-side` 12,000
  stadia, Rev 21:16; `rev-city-wall` 144 cubits, Rev 21:17 — slug prefix
  `rev-`, book Revelation, generated `cityMeasurements.gen.ts`, const
  `REV`) and add a declared `compressed-city` mode to `NewJerusalemConfig`:
  literal meters from the ESV's own footnote glosses (a stadion ~607 ft →
  185 m; a cubit ~18 in → 0.457 m), divided by ONE whole-city compression
  factor, 555. `cityModel.CITY_HALF` now derives from `rev-city-side`
  through that resolver — landing exactly on ADR 0014's declared
  experiential footprint (4000 m side, walls ±2000 world).

### What is grounded vs. a rendering choice

- **Grounded (via REV at the declared scale):** the city's foursquare
  footprint consumes the cited side — 12,000 stadia, "its length and width
  and height are equal" (Rev 21:16) — and the walker-facing HUD card for
  `new-jerusalem` now shows both records with their citations and tiers.
- **Rendering choice (documented interpretation):** the factor 555 itself —
  back-derived from ADR 0014's ~2.5-mile experiential footprint, exactly as
  entry #11's 0.1 m/cubit was back-derived from the heightfield-mirror
  constraint; a literal 12,000-stadia city is a future resolver mode, not a
  different dataset. The Revelation records carry NO long-cubit realization:
  Revelation declares no internal unit standard (there is no Ezek 40:5 in
  John's vision), so the generated module is purely text-native and the unit
  glosses live in the resolver.
- **Deliberately NOT consumed:** (1) `rev-city-wall` (144 cubits) — the
  text does not say whether height or thickness is measured (tier `fuzzy`;
  21:12's "great, high wall" suggests height, many interpreters read
  thickness); the rendered wall keeps its proportional-art height and
  asserts nothing. (2) The equal HEIGHT of 21:16 — the engine's terraced
  ziggurat massing is a documented harmonization (entry #2, Willis), not a
  12,000-stadia cube; the record preserves the equality in its subject line
  so the dataset says what the render does not. (3) The 12,000-stadia
  height/width equality against the interior tier table — tiers stay
  proportional art keyed to the footprint.
- **Guardrails:** no records for the gates or foundations (Rev 21:12-21
  names and orders them but the rod numbers only the city and its wall);
  the minority perimeter reading of 12,000 stadia (3,000 per side) is
  preserved in `rev-city-side`'s notes, not silently dropped.

### Governing sources

- Rev 21:15-17 (via the seeded REV measurement records — ESV text not
  stored, ADR 0006)
- [ADR 0017](docs/adr/0017-scripture-as-grounding-data.md) decisions 2-4,
  [ADR 0018](docs/adr/0018-units-and-scale-resolution.md) (resolver
  pattern; ESV-footnote unit glosses), [ADR 0014](docs/adr/0014-citywide-scale-rendering.md)
  (the declared footprint the compression preserves)
- Code: `apps/world-engine/src/nj/config.ts` (city mode + `cityMeters`),
  `src/nj/cityModel.ts` (derived `CITY_HALF`), `src/nj/cityMeasurements.gen.ts`
  (generated), `pipeline/src/far_country/measure/city.py` (authored records)
