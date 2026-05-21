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

## Phase 3 — Explorable 3D world

**Deliverable:** A React Three Fiber layer inside the same Next.js app that procedurally renders the New Jerusalem and lets the user walk through it.

**Milestones:**

1. **M3.1 — Scene scaffolding.** R3F + drei set up; camera controls (orbit + WASD/touch); placeholder geometry.
2. **M3.2 — City shell.** Procedural city walls (Rev 21:12–17) with twelve gates and twelve foundations.
3. **M3.3 — Throne, river, tree of life.** Core central features (Rev 22:1–2).
4. **M3.4 — Entity interaction.** Click an object → see its descriptor card (tier, citations, links).
5. **M3.5 — Symbolic indicators.** Visual treatment that distinguishes literal from symbolic features at a glance.
6. **M3.6 — Population.** A representative set of named persons/categorical persons present in the scene.

**Done when:** A user can walk through a recognizable representation of the New Jerusalem on a mid-range laptop, click any major feature, and see a sourced descriptor for it.

**Spec stub:** [`specs/phase-3-3d-world.md`](specs/phase-3-3d-world.md).

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
