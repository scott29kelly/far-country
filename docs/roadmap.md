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

**Deliverable:** A React Three Fiber layer inside the same Next.js app that procedurally renders the New Jerusalem and lets the user walk through it.

**Milestones:**

1. **M3.1 — Scene scaffolding.** *(done)* R3F + drei set up; first-person WASD + pointer-lock controls; placeholder geometry; client-only Canvas via `next/dynamic`.
2. **M3.2 — City shell.** *(done)* Procedural jasper walls (Rev 21:12–17), twelve pearl gates with tribe labels in **Ezekiel 48:30–34 order** (compass side shown in each label), a jewelled twelve-foundation course at the wall base (Rev 21:19–20, ESV gems), AABB wall/gate collision.
3. **M3.3 — Step-mountain, throne, river, tree of life.** *(done)* City rendered as Willis's **terraced step pyramid** of translucent crystalline terraces (Rev 21:11, 18) with the **aniconic throne at the summit** (ADR 0010) under a cloud-and-fire glory canopy (Isa 4:5–6); single river of life **cascading from the summit throne down the south meridian** terrace by terrace to the south gate (Rev 22:1); flanking trees of life with twelve-fruit specks at the river's base (Rev 22:2). Movement is terrain-following (fly up with Space to ascend terraces); a click-to-teleport mini-map jumps to any gate, the summit, or a tree.
4. **M3.4 — Entity interaction.** *(partial)* Proximity HUD surfaces the nearest entity's descriptor cards with tier badges + citations; click-to-open routes to `/entities/[slug]`. Direct object click-picking still pending.
5. **M3.5 — Symbolic indicators.** *(partial)* Symbolic features render in stylised, luminous, slightly-unphysical form per ADR 0009; HUD tier badges disclose symbolism. A dedicated at-a-glance literal-vs-symbolic visual key is still pending.
6. **M3.6 — Population.** *(not started)* A representative set of named/categorical non-divine persons present in the scene. Policy: figural non-divine persons permitted; divine persons remain aniconic (ADR 0010); symbolic-tier figures (four living creatures, 24 elders) deferred to `RENDERING-DECISIONS.md`. See [`adr/0011-population-rendering-policy.md`](adr/0011-population-rendering-policy.md).

> **Rendering note (city form).** The city's vertical form (step pyramid, not cube) and the gate tribe order (Ezekiel 48, not Revelation 7) are `debated`-tier rendering decisions documented in [`RENDERING-DECISIONS.md`](../RENDERING-DECISIONS.md) entries #1 and #2 per ADR 0009 rule 4. Scale stays the ~200m placeholder (ADR 0009 rule 6) — only the shape changed.

> **Rendering note (river).** The river of life is rendered as a *single* channel, not as cardinal branches. Rev 22:1 describes one river ("*a* river... flowing from the throne... through the middle of the street"); the four-headed river belongs to Eden (Gen 2:10) and divides *downstream* of the garden. The universal-scope symbolism that Eden's fourfold river carries is, in Revelation, expressed by the foursquare twelve-gate city (Rev 21:13, 16) — which the world already renders — not by multiplying the river. See `apps/web/src/lib/world/components/River.tsx` and ADR 0009.

**Done when:** A user can walk through a recognizable representation of the New Jerusalem on a mid-range laptop, click any major feature, and see a sourced descriptor for it.

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
