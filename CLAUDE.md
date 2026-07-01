# CLAUDE.md — Orientation for AI-assisted sessions

This file exists so an AI agent (Claude or otherwise) can pick this project up cold and act usefully within minutes. Keep it short. Update it when project conventions change.

---

## What this project is

**Far Country** — a biblically accurate world model simulation of heaven. Eventual experience: explorable 3D world + grounded AI Q&A. Foundation: a ground-truth dataset of descriptors of heaven extracted from the ESV Bible and Janet Willis's *What on Earth Is Heaven Like? A Look at God's City New Jerusalem*.

Full vision: [`docs/vision.md`](docs/vision.md). Product spec: [`docs/prd.md`](docs/prd.md).

---

## Current phase

**Phase 3 — Explorable 3D world, in progress.** Phases 0–2 (docs, dataset/pipeline, browse UI + grounded Q&A) are built. Active work is the 3D world: two implementations coexist per [ADR 0013](docs/adr/0013-fork-laas-engine-for-3d-world.md) — the legacy React Three Fiber scene (`apps/web/src/lib/world/`, retired, reachable only via its old route) and the vendored LAAS WebGPU engine at `/world-preview` (`apps/world-engine/`), now the front door. The engine's terrain/atmosphere quality is well ahead of the legacy scene's, but its New Jerusalem content (`apps/world-engine/src/nj/`) is well behind the legacy scene's feature set — see [`docs/roadmap.md`](docs/roadmap.md) Phase 3 for the current per-milestone status.

Phase ordering: 0 docs → 1 dataset + review tool → 2 browse UI + grounded Q&A → 3 explorable 3D world. See [`docs/roadmap.md`](docs/roadmap.md).

---

## Non-negotiables

1. **Hermeneutic policy.** Conservative Protestant, literal-where-possible. Symbolic readings are flagged explicitly when text genre signals them. Do not silently smooth over difficult passages, do not import unsupported speculation, do not flatten symbolism into literalism or vice versa. Detail: [`docs/hermeneutics.md`](docs/hermeneutics.md).
2. **Every claim about heaven carries a citation.** Scripture (book/chapter/verse) and, where applicable, Willis (chapter/page). No descriptor enters the canonical dataset without one.
3. **Fuzzy / debated / symbolic material is preserved, not dropped.** It goes into a review queue with a confidence tier. Tiers: `clear`, `fuzzy`, `debated`, `symbolic`. Tier definitions: [`docs/data-model.md`](docs/data-model.md).
4. **ESV is the canonical translation.** Do not substitute KJV/NIV/NASB unless explicitly asked to compare.
5. **Personal-study licensing posture.** Do not ship public artifacts that redistribute ESV text or Willis excerpts in bulk. See [`docs/adr/0006-source-licensing-posture.md`](docs/adr/0006-source-licensing-posture.md).

---

## Where things live

| You need… | Look at… |
| --- | --- |
| The vision in one read | `docs/vision.md` |
| The product spec | `docs/prd.md` |
| The interpretive stance | `docs/hermeneutics.md` |
| The dataset schema | `docs/data-model.md` |
| How extraction works | `docs/extraction-pipeline.md` |
| Sources and their licensing | `docs/sources.md` |
| Why a tech choice was made | `docs/adr/` |
| What "descriptor" / "entity" / "grounded answer" mean | `docs/glossary.md` |
| Phase ordering and milestones | `docs/roadmap.md` |

---

## Tech direction (locked in, not yet implemented)

- **Pipeline:** Python 3.12, `uv` for env, Anthropic SDK, Pydantic, SQLite as canonical store, JSON exports.
- **Review tool:** Minimal FastAPI + HTMX (or small Next.js page) over the SQLite store.
- **App shell (Phase 2+):** Next.js (App Router) + TypeScript + Tailwind, Vercel.
- **3D (Phase 3):** React Three Fiber + drei + zustand.
- **AI Q&A:** Retrieval over the canonical dataset; every answer cites descriptors; refuse to answer if no grounded descriptor exists.

Rationale: [`docs/adr/0002-tech-stack.md`](docs/adr/0002-tech-stack.md).

---

## Common pitfalls to avoid

- **Don't invent descriptors.** Every entry must trace to a source. If you find yourself paraphrasing what heaven "must be like" without a citation, stop.
- **Don't collapse symbolism.** Streets of gold (Rev 21:21) is in an apocalyptic vision — mark it `symbolic` with a note about its referent (purity, value, glory) rather than asserting literal metallurgy.
- **Don't collapse the literal either.** Bodily resurrection (1 Cor 15) is not metaphorical in this hermeneutic. Don't flatten it into "spiritual continuation."
- **Don't smuggle in extra-biblical imagery.** Cherubim with wings on clouds playing harps is not in the dataset unless Scripture or Willis cites it.
- **Don't assume.** If a passage is ambiguous, mark the descriptor `fuzzy` or `debated` and route it to review.

---

## Working style for this repo

- Prefer editing existing docs over creating new ones unless the plan explicitly calls for a new file.
- ADRs are append-only — never edit a `Status: Accepted` ADR in place; supersede it with a new one.
- Commit messages: present tense, what changed and why (one line summary, blank line, body).
- No emoji in committed files unless specifically requested.
- When in doubt about hermeneutics or doctrine, surface the question to the user — do not resolve theological disputes silently.
