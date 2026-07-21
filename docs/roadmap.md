# Roadmap

This is the phased delivery plan. Dates are deliberately absent — this is a solo, AI-assisted build, and shipping the right thing matters more than shipping by a date.

---

## Phase 0 — Documentation scaffolding *(in progress)*

**Deliverable:** This documentation set.

**Done when:**

- [x] `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE` exist.
- [x] `docs/vision.md`, `docs/prd.md`, `docs/hermeneutics.md`, `docs/data-model.md`, `docs/extraction-pipeline.md`, `docs/sources.md`, `docs/roadmap.md`, `docs/glossary.md` exist.
- [x] ADRs `0001`–`0006` exist.
- [x] Spec stubs exist for Phases 1, 2, 3.
- [x] Committed and pushed; draft PR opened on the development branch.

After Phase 0 lands, the PRD is locked. Subsequent changes require a new ADR.

---

## Phase 1 — Extraction pipeline + review tool + canonical dataset

**Deliverable:** A working Python pipeline that processes the ESV and Willis, plus a human-review UI, plus a canonical dataset of at least the New Jerusalem core entities reviewed and approved.

**Milestones:**

1. **M1.1 — Pipeline skeleton.** Python project bootstrapped with `uv`, SQLite schema created, Anthropic SDK wired up. Smoke test: extract candidates from Revelation 21 and print them.
2. **M1.2 — Review tool MVP.** FastAPI + HTMX page over the SQLite. Keyboard-driven approval workflow.
3. **M1.3 — Initial extraction pass.** Process the Phase 1 priority passages from [`extraction-pipeline.md`](extraction-pipeline.md) §2.
4. **M1.4 — Willis pass.** Extract candidates from Willis chapter-by-chapter.
5. **M1.5 — First reviewed dataset.** Reviewer (the user) processes the entire pending queue; output is a non-empty `approved` dataset.
6. **M1.6 — Export.** `canonical.json` and per-entity exports generated and validated against the schema.

**Done when:** A consumer (placeholder Next.js page) can load `canonical.json` and render the New Jerusalem entity with its descriptors and citations — entirely from the pipeline output, no manual fixup.

**Spec:** [`specs/phase-1-dataset.md`](specs/phase-1-dataset.md).

---

## Phase 2 — Browse UI + grounded AI Q&A

**Deliverable:** A Next.js app that gives the user (a) a browsable interface over entities and descriptors and (b) a grounded chat interface.

**Milestones:**

1. **M2.1 — App shell.** Next.js + TypeScript + Tailwind set up on Vercel. Reads `canonical.json` from the repo or a CDN.
2. **M2.2 — Entity browse.** Per-entity pages with descriptors, citations, and inter-entity links via the relation graph.
3. **M2.3 — Search + filter.** Search by entity name, filter by entity_type and tier.
4. **M2.4 — Q&A v1.** RAG over the canonical dataset. Every answer cites at least one descriptor; refuses to answer when no descriptor supports the question.
5. **M2.5 — Citation drill-down.** Click a citation to see the verse in context (ESV API at runtime; not stored).

**Done when:** A non-technical user can read about an entity, follow citations to verses, and ask the Q&A interface a question and trust the answer to be grounded.

**Spec stub:** [`specs/phase-2-browse-ui.md`](specs/phase-2-browse-ui.md).

---

## Phase 3 — Explorable 3D world *(in progress)*

**Deliverable:** An explorable New Jerusalem the user can walk through.

**Status as of 2026-07-01 — two implementations coexist, per [ADR 0013](adr/0013-fork-laas-engine-for-3d-world.md):**

- **`/world`** — the original React Three Fiber scene (`apps/web/src/lib/world/`). **Legacy, superseded, retained only until the engine below reaches parity** (ADR 0013). It carries every feature milestone M3.1–M3.5 originally describes: jasper walls, tribe-labelled pearl gates, jewelled foundations, AABB collision, throne, mini-map, proximity HUD with descriptor cards + citations, symbolic tier badges. Root `next.config.ts` now redirects `/world` to `/world-preview` — **`/world`'s code is no longer reachable by a normal visit**, only by disabling the redirect or hitting the route directly in dev.
- **`/world-preview`** — the vendored LAAS WebGPU engine (`apps/world-engine/`, ADR 0013), now the front door (root `/` redirects here too). This is where active content work happens. Its terrain/atmosphere/vegetation quality is far above the legacy scene's (see `apps/world-engine/STATUS.md`), but **the New Jerusalem content itself (`src/nj/`) is well behind the milestone list below** — it was rebuilt from scratch on the new engine and has not yet reabsorbed most of what `/world` already had. The gap is the subject of this session's Task 1/2/3 work; see `apps/world-engine/STATUS.md`'s "New Jerusalem scene" section for the current inventory.

**Milestones (status reflects `/world-preview`; `(legacy only)` marks a feature that exists on the retired `/world` scene but has not been ported):**

1. **M3.1 — Scene scaffolding.** *(done, re-platformed)* The engine's own walk/fly rig (`core/FlyCamera.ts`) replaces R3F + drei. As of 2026-07-01, mouse look is the legacy scene's mouse-steer-without-pointer-lock scheme (commit `e94c3c1`), ported into `FlyCamera.ts` — not yet visually re-verified live, see `apps/world-engine/STATUS.md`. Client-hosted via an `<iframe>` at `/world-preview` (`apps/web/app/world-preview/page.tsx`), not `next/dynamic`.
2. **M3.2 — City shell.** *(partial — updated 2026-07-01)* The engine renders a 5-tier box massing with arched-window facades and a river/tree pass (`src/nj/CityMassing.ts`, `Allotment.ts`, `RiverOfLife.ts`), plus a Holy-Allotment plateau, crop fields, a dwelling grid, and a standalone temple — most of that is new content **ahead of** M3.2 scope (Phase 4 territory, arriving early). The M3.2 checklist itself: the base tier is now a real jasper wall built from `cityModel.ts`'s tables, with genuine gaps at the twelve named gates in Ezekiel 48:30–34 order and a twelve-stone jewelled foundation course girdling its base (closing the `cityModel.ts` dead-code gap this line used to flag). Gate tribe names are now inscribed in-scene on the cornice frieze over each gate (Rev 21:12; 2026-07-18), wall/gate collision is built (`hooks.moveProbe` + `cityCollide.ts`, 2026-07-06), and the city pavements are walk floors (2026-07-18). As of 2026-07-21 the city is also **climbable on foot**: mirrored processional ramp chains on the east and west faces connect plaza → plinth → terraces → crown (interpretive architecture, [RENDERING-DECISIONS entry #10](../RENDERING-DECISIONS.md) — uncited and unpickable), and the jasper wall is a true slab at the wall line, opening the covered street-of-gold gallery inside it (this also fixed the M3.6 plaza-assembly entombment — see that milestone). **Not visually re-verified live** this session — see `apps/world-engine/STATUS.md`'s "PENDING USER CONFIRM" note before treating this as done.
3. **M3.3 — Step-mountain, throne, river, tree of life.** *(largely done, re-platformed — updated 2026-07-13)* The M3 material/geometry pass replaced the box massing with translucent gold-glass tiers over glowing interiors, instanced architectural relief (arch frames, fluted piers, ivory cornice/arcade courses), faceted foundation gems, and iridescent pearl gates; the river is real crystal water (refraction/SSR/foam, ribbon cascades, caustic gold beds, walk-guard); the trees of life are real pipeline-built hero trees with wind, GI and glowing fruit; and the summit now carries RENDERING-DECISIONS #4's rainbow halo + sea of glass (no longer `(legacy only)`). The throne remains conflated with the glory-light as one aniconic primitive (ADR 0010). The mini-map/click-to-travel gap is now closed in `/world-preview`: `core/NavigationUI.ts` adds a visible world map with safe click-to-fly placement, cited New Jerusalem quick-travel destinations, walk/fly mode controls, stepped ground/flight speeds, boost, and auto-cruise; the legacy map is no longer the only navigation surface. City renders at **citywide scale (~2.5 mi, `NJ_SCALE=20`)** per [ADR 0014](adr/0014-citywide-scale-rendering.md), which supersedes this milestone's original ~200 m-placeholder framing entirely. Inventory + verification: `apps/world-engine/STATUS.md` "New Jerusalem scene" 2026-07-13 entry.
4. **M3.4 — Entity interaction.** *(largely done, re-platformed — updated 2026-07-18)* `/world-preview` now has click-picking and a citation-grounded descriptor HUD: a scene-owned pick registry (`src/nj/entityPicks.ts`) derives analytic volumes from the shared owner tables (gates with tribe+compass labels in Ezekiel order, gate-notched foundation gem bands, wall, tiers, street, river reaches, trees of life, summit throne/glory, sea of glass, and the temple compound as one measured zone), and `src/core/EntityHud.ts` renders the canonical entity's descriptors — statement, tier badge, citation chips, symbolic referent — fetched from the SAME `/data/entities/*.json` exports the browse UI consumes. Verified by a 32-case CPU contract probe + a 13-case live browser probe (`apps/world-engine/STATUS.md` 2026-07-18 entries). Proximity auto-cards landed 2026-07-18 (walk-mode-only; pinned click cards win; Escape latch). Still open: a dwelling-campus pick (blocked on Track A seeding the Ezek 45:4-5 zone entities — no canonical entity exists to cite yet).
5. **M3.5 — Symbolic indicators.** *(done, re-platformed — updated 2026-07-20)* The descriptor cards carry the four confidence-tier badges and surface `symbolic_referent` for symbolic descriptors, and the in-scene literal-vs-symbolic visual key independent of the inspector is now built: a toggleable reading key (K, the KEY chip, or `?key=1`; off by default) floats one marker per cited entity — canonical name plus one colored dot per confidence tier among its descriptors, fetched from the same `/data/entities` exports the cards consume — with a legend explaining the four tiers, and occlusion-dims markers whose feature is behind something from the current view (`apps/world-engine/src/nj/keyModel.ts`, `src/core/VisualKeyUI.ts`; CPU + live probes in `apps/world-engine/STATUS.md` 2026-07-20 later-9 entry). Scott's subjective styling pass still owed.
6. **M3.6 — Population.** *(first pass built on `/world-preview`, 2026-07-18)* The settled RENDERING-DECISIONS #3 rendering is live under ADR 0011/0010: ~12,700 white-robed faceless figures with raised palm branches (Rev 7:9, `great-multitude`) in forty worship assemblies on the plaza ring and terrace pavements, all facing the summit light, plus forty-eight abstract light-pillar hosts (Rev 5:11, `myriads-of-angels`) ringing the summit in twelve slowly rising-and-falling clusters — both clickable/walk-discoverable as zone-level cited entities (`src/nj/populationModel.ts`, `Population.ts`; 13-case CPU probe). The four living creatures and twenty-four elders stay omitted per ADR 0011 rule 4. Still open: figure idle motion, M4.4's nations/pilgrimage dynamism, and Scott's subjective pass. Correction (2026-07-21): the sixteen plaza-ring assemblies had been stationed inside the wall's solid massing — entombed, invisible, unreachable; the wall-slab/gallery fix (RENDERING-DECISIONS entry #10) recentres them into the covered street-of-gold gallery, walkably reachable through the gates for the first time. Inventory: `apps/world-engine/STATUS.md` 2026-07-18 later-5 entry + 2026-07-21 entry.

> **Rendering note (city form).** The city's vertical form (step pyramid, not cube) and the gate tribe order (Ezekiel 48, not Revelation 7) are `debated`-tier rendering decisions documented in [`RENDERING-DECISIONS.md`](../RENDERING-DECISIONS.md) entries #1 and #2 per ADR 0009 rule 4. Scale: the legacy `/world` scene stays at the ~200m placeholder (ADR 0009 rule 6); `/world-preview` has since moved to the citywide ~2.5 mi scale of ADR 0014, which is the current governing decision for future work.

> **Rendering note (river).** The river of life is rendered as a *single* channel, not as cardinal branches. Rev 22:1 describes one river ("*a* river... flowing from the throne... through the middle of the street"); the four-headed river belongs to Eden (Gen 2:10) and divides *downstream* of the garden. The universal-scope symbolism that Eden's fourfold river carries is, in Revelation, expressed by the foursquare twelve-gate city (Rev 21:13, 16) — which the world already renders — not by multiplying the river. Implemented in both scenes: `apps/web/src/lib/world/components/River.tsx` (legacy) and `apps/world-engine/src/nj/RiverOfLife.ts` (current). See ADR 0009.

> **Rendering note (new-earth landscape).** `/world-preview` sites the city on the engine's full wild procedural terrain (mountains, forests, rivers) unchanged, rather than an idealized/paradisal art-directed variant — see `RENDERING-DECISIONS.md` entry #5. This is illustrative context, not a cited descriptor.

**Done when:** A user can walk through a recognizable representation of the New Jerusalem on a mid-range laptop, click any major feature, and see a sourced descriptor for it. **Substantially met by `/world-preview` as of 2026-07-18** — every major grounded feature (city, wall, gates, foundations, street, river, trees of life, throne/glory, sea of glass, temple zone) is clickable with a sourced descriptor card; the dwelling campus stays uncited until Track A seeds its zone entities, and Scott's subjective acceptance pass is still owed.

**Spec stub:** [`specs/phase-3-3d-world.md`](specs/phase-3-3d-world.md).

---

## Phase 4 — Millennial-Kingdom surroundings *(planned)*

**Deliverable:** The premillennial *setting* around the New Jerusalem, built out in the same `/world` scene. Phase 3 rendered the descended city; Phase 4 renders the millennial earth it descends onto.

This phase exists because of the eschatological pivot in [`adr/0012-eschatological-framing-premillennial.md`](adr/0012-eschatological-framing-premillennial.md). Under the prior amillennial framing ([ADR 0008](adr/0008-eschatological-framing.md)) these features were out of scope ("one heaven, no millennial earth"); ADR 0012 adopts Willis's premillennial New Creationism in full and puts them on the roadmap. The four milestones follow Willis's harmonization of Ezekiel with Revelation — see [`sources/willis-new-jerusalem-model.md`](sources/willis-new-jerusalem-model.md).

**Milestones:**

1. **M4.1 — Ezekiel 40–48 temple complex.** The literal future millennial temple as a structure **distinct from and adjacent to** the city (Willis's "Washington D.C." adjacency; Rev 21:22 — no temple *inside* the New Jerusalem; Ezek 48:10 priestly allotment). Outer/inner courts, gates, and the sanctuary per Ezekiel's measurements, rendered aniconically where divine presence is in view (ADR 0010 still controls). Genuinely contested sub-questions (e.g. the function of the temple sacrifices, Ezek 40–46) are `debated`-tier and get a `RENDERING-DECISIONS.md` entry before geometry lands (ADR 0009 rule 4).
2. **M4.2 — Holy Allotment + tribal geography.** The Ezekiel 48 land division — the holy district, the prince's portion, and the twelve tribal strips — as legible landscape around the temple and city. This is the macro-geography the city and temple sit within.
3. **M4.3 — Ezekiel 47 healing river.** The river issuing **from the temple** (Ezek 47:1–12), flowing east toward the Arabah and healing the waters, with trees on its banks. This is a **second, distinct** water feature from the Rev 22:1 city river already built in M3.3 (which cascades from the summit throne). The two rivers must read as distinct in-scene — different source (temple vs. throne), different course — and the dataset/HUD must not conflate them.
4. **M4.4 — Mortal nations + pilgrimage dynamism.** The millennial earth is inhabited by mortal nations alongside resurrected saints; the city's perpetually-open gates (Rev 21:25) take on their premillennial meaning — nations and kings bring their glory in (Rev 21:24–26) and make pilgrimage to worship (Zech 14:16). A representative, non-static depiction of that movement. Figural non-divine persons follow [`adr/0011-population-rendering-policy.md`](adr/0011-population-rendering-policy.md); divine persons remain aniconic (ADR 0010).

> **Dependency note.** Phase 4 assumes the descriptors for these features have been extracted and reviewed (Phase 1) under the premillennial rubric of ADR 0012 — which inverts ADR 0008's rubric polarity (a literal Ezekiel temple, first resurrection, and intermediate state are now *approvable*). The Phase-3 city does not need to be rebuilt; Phase 4 is additive.

**Done when:** A user can walk out from the New Jerusalem into a recognizable millennial landscape — see the adjacent temple, the tribal land division, the healing river distinct from the city river — with every major feature sourced.

**Spec stub:** *(to be written)*.

---

## What's deliberately not on the roadmap

- Multiplayer / social.
- Native mobile apps.
- VR/AR (interesting future direction, not now).
- Audio narration / TTS.
- User-contributed descriptors.
- Multi-tradition harmonization (Orthodox, Catholic, etc.) — see [`hermeneutics.md`](hermeneutics.md).
- Public distribution at scale — requires the licensing work in [`adr/0006-source-licensing-posture.md`](adr/0006-source-licensing-posture.md).

---

## Re-prioritization

This roadmap is reviewed at the end of each phase. Material reshuffling (e.g., promoting the 3D layer before Q&A, or splitting Phase 2) is captured in a new ADR.

**2026-05-29 — eschatological pivot.** [ADR 0012](adr/0012-eschatological-framing-premillennial.md) superseded the amillennial framing of [ADR 0008](adr/0008-eschatological-framing.md) with premillennial (pre-wrath) New Creationism. This **added Phase 4 (Millennial-Kingdom surroundings)**, which the prior framing had ruled out of scope. The earlier phases are unchanged in deliverable; only the extraction/review rubric polarity shifts (per ADR 0012's consequences) and the Phase-3 city gains a millennial *setting* rather than being modified.

---

## Operational backlog (repository/deployment and cross-cutting tasks, not product phases)

- **Audio layer (score, ambience, voices, SFX) via ElevenLabs** *(added
  2026-07-02, open)*. An `ELEVENLABS_API_KEY` lives in the local `.env`
  (untracked and gitignored; verified 2026-07-02 never committed on any ref —
  no rotation needed). Ground rules, settled 2026-07-02:
  1. **The key must never reach the browser** — no `VITE_` prefix, no
     client-side ElevenLabs calls. Audio is generated OFFLINE (or server-side
     in `apps/web`) and the output vendored into the app, exactly like the
     `/laas` engine bundle.
  2. **Voiced ESV Scripture requires a Crossway audio-licensing check before
     shipping** — the [ADR 0006](adr/0006-source-licensing-posture.md)
     personal-study posture governs audio just as it does text.
  3. **Score/ambience is illustrative context, not cited content** (the
     `RENDERING-DECISIONS.md` entry #5 posture) — record a short decision
     entry when it is built.
  Suggested first deliverable (no licensing questions involved): an
  offline-generated ambient bed for the spawn meadow + one score cue for the
  south approach.
  **First deliverable done 2026-07-06, procedurally** — the spawn-meadow
  ambient bed and south-approach score cue shipped as runtime WebAudio
  synthesis (`apps/world-engine/src/audio/Ambience.ts`, RENDERING-DECISIONS
  entry #9) instead of ElevenLabs generation: zero assets, zero key exposure,
  ground rules 1 and 3 satisfied by construction. ElevenLabs remains the
  path for voices/SFX that synthesis can't reach (ground rule 2 still gates
  any voiced Scripture).

- **Establish an official `main` branch at origin** *(added 2026-07-02;
  **done 2026-07-02**)*. Executed with one surprise: `origin/main` turned out
  to already exist as a stale pointer from the June PR #22 merge (no unique
  content — both parents of its tip were ancestors of the de-facto main), so
  step 1 became a lease-guarded force-update of `main` to the de-facto tip
  (`f3e91a8`) rather than a branch creation. GitHub default branch switched
  to `main` via `gh repo edit`; Vercel's Production environment tracked the
  repo default branch, so it followed automatically (verified showing `main`
  in Settings → Environments). This entry's own commit is the verification
  push — a production deployment from `main` confirms the cut-over. The old
  `claude/setup-far-country-docs-dbpMh` branch is retired (or parked) at the
  owner's discretion once that deploy is green.
