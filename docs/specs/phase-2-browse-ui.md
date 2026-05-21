# Spec — Phase 2: Browse UI + grounded AI Q&A

**Status:** Draft — awaiting sign-off before any Phase 2 code lands
**Phase:** 2
**Goal:** Ship a Next.js app that (a) makes the canonical dataset browseable by a non-technical user and (b) provides a chat interface that answers strictly from approved descriptors and refuses when no grounded answer exists.

This spec is the implementation contract for Phase 2. It is intentionally concrete. It replaces the Phase 0 stub that lived at this path.

---

## 1. Scope

In scope:

- A real Next.js (App Router) + TypeScript + Tailwind app, replacing the Phase 1 placeholder at `apps/web/`.
- Entity index and entity detail pages reading the canonical JSON export shipped by the pipeline.
- Filter and search over entities and descriptors.
- ESV citation drill-down via a server-side proxy to the ESV API (no key in the browser).
- A grounded Q&A chat interface backed by retrieval over the approved descriptor set, per [`../adr/0004-llm-grounding-strategy.md`](../adr/0004-llm-grounding-strategy.md).
- A versioned Q&A system prompt held under source control.
- Tests: route-level smoke tests, retrieval unit tests, grounding-contract tests for the Q&A path (including refusal).
- Deployable to Vercel from the existing repo with no operational overhead.

Out of scope (this phase):

- 3D world (Phase 3).
- Multi-user accounts, auth, comments, contributions.
- Mutating the canonical dataset from the web app — the app is strictly read-only over the export.
- Multi-tradition harmonization or any departure from [`../hermeneutics.md`](../hermeneutics.md).
- Public-scale distribution (the licensing posture in ADR 0006 still constrains this; see §10).

Phase 2 ships in two PR series — **2A: Browse**, then **2B: Q&A**. Mixing them in one PR is forbidden.

---

## 2. Repository structure (Phase 2)

```
far-country/
├── apps/
│   ├── review/                       ← unchanged from Phase 1
│   └── web/                          ← REPLACED in Phase 2
│       ├── app/
│       │   ├── page.tsx              ← landing
│       │   ├── entities/
│       │   │   ├── page.tsx          ← entity index + filters
│       │   │   └── [slug]/page.tsx   ← entity detail
│       │   ├── ask/
│       │   │   └── page.tsx          ← Q&A chat UI
│       │   ├── about/
│       │   │   ├── hermeneutics/page.tsx
│       │   │   └── sources/page.tsx
│       │   └── api/
│       │       ├── ask/route.ts      ← streaming Q&A endpoint
│       │       └── esv/route.ts      ← ESV API proxy (server-side key)
│       ├── src/
│       │   └── lib/
│       │       ├── data/             ← canonical-data loaders + types
│       │       ├── retrieval/        ← embedding index + search
│       │       ├── qa/
│       │       │   ├── system-prompt.md   ← versioned, per ADR 0004
│       │       │   ├── prompt.ts          ← prompt assembly
│       │       │   └── grounded.ts        ← grounded answer pipeline
│       │       └── ui/               ← shared components
│       ├── public/
│       │   └── data/                 ← canonical.json + entities/*.json (copied from pipeline)
│       ├── scripts/
│       │   └── build-index.ts        ← builds search + embedding indices at build time
│       └── tests/
└── docs/                             ← existing docs from earlier phases
```

The pipeline's exports are copied (or symlinked at build time) into `apps/web/public/data/`. The web app never reads from the SQLite store directly.

---

## 3. Components

### 3.1 Data layer (`apps/web/src/lib/data/`)

- `types.ts`: TypeScript types derived from the schema in [`../data-model.md`](../data-model.md) and the JSON Schema shipped with the export. Source of truth is the schema; types are regenerated, not hand-edited.
- `load.ts`: server-side loaders that read `public/data/canonical.json` and `public/data/entities/<slug>.json`. Loaders cache in memory across requests.
- `manifest.ts`: reads `manifest.json` to check `schema_version` at boot. App refuses to start on a major-version mismatch.

### 3.2 Browse UI

Pages:

- `GET /` — landing. One-paragraph description of Far Country, dataset stats (entity count, descriptor count, tier distribution), links to `/entities` and `/ask`.
- `GET /entities` — entity index. Server-rendered list with filters for `entity_type` and `tier`, plus a text search box that filters client-side using a prebuilt MiniSearch index.
- `GET /entities/[slug]` — entity detail. Shows: name, summary, descriptors grouped by tier, citations with one-click drill-down, related entities from `entity_relation`.
- `GET /about/hermeneutics` and `GET /about/sources` — static pages mirroring the docs; these are *public-facing summaries*, not raw doc copies.

Behavioral rules:

- A `symbolic` descriptor is always rendered with its `symbolic_referent` visible — never as a bare image.
- A `debated` descriptor must surface all its citations, not just the first.
- `temporal_phase` is shown as a small badge on every descriptor (`intermediate` / `final` / `either` / `unspecified`).
- Only `review_status='approved'` descriptors appear (already true in the export, but the UI must not bypass this).

### 3.3 ESV citation drill-down (`apps/web/app/api/esv/route.ts`)

- A Next.js route handler that proxies the ESV API. The ESV API key lives in a Vercel env var, never in the browser bundle.
- Accepts `{ book, chapter, verse_start, verse_end? }` matching the citation shape.
- Caches responses in-memory with a TTL (cold-start friendly).
- Returns the verse text plus the canonical reference. The client renders this in a popover next to the citation.
- Rate-limited per IP (simple sliding window). On rate-limit the UI says so plainly; it does not silently retry.

### 3.4 Retrieval (`apps/web/src/lib/retrieval/`)

Two indices are built at deploy time by `scripts/build-index.ts`:

1. **Lexical index** — MiniSearch over descriptor `statement`, entity `name`, and entity `summary`. Used for the `/entities` search box and as a fallback for Q&A retrieval. Serialized to `public/data/search-index.json`.
2. **Semantic index** — embeddings over descriptor `statement`. Used as the primary retrieval surface for Q&A. Serialized to `public/data/embeddings.json` plus a small metadata file. **Embedding provider choice is open (§5 Open question E1); spec'd as a pluggable interface so the choice is reversible.**

Retrieval API:

- `retrieve(query, { k, minScore })` returns up to `k` descriptors with `{ descriptor, score, citations }`.
- Tier-aware scoring: a tier filter can be passed (e.g., exclude `symbolic` from a question that demands literal facts). Default: include all tiers.
- The retriever never reads the SQLite store, never reads ESV/Willis text. Only the export.

### 3.5 Q&A (`apps/web/src/lib/qa/` and `apps/web/app/api/ask/route.ts`)

- `system-prompt.md` is the versioned system prompt per ADR 0004. It encodes the grounding contract: cite at least one descriptor, refuse if retrieval is empty, surface tier when answers rest on `symbolic` or `debated` descriptors, never supplement from model training. Version is in the file's frontmatter and surfaced in the response metadata.
- `prompt.ts` assembles the final prompt: system prompt + retrieved descriptors (with their citations and tiers) + conversation history + the user's question.
- `grounded.ts` is the orchestrator. Steps: (1) retrieve, (2) if no descriptors above `minScore`, return an explicit refusal without calling the LLM, (3) otherwise call Claude (default `claude-sonnet-4-6` per ADR 0004), (4) post-process to enforce the citation contract — any answer that fails to cite ≥1 descriptor from the retrieved set is rewritten or refused.
- `/api/ask` streams tokens to the browser using server-sent events. Returns the grounded answer plus a structured `citations` array the UI renders below the answer text.
- The chat UI surfaces: the model identifier, the prompt version, the retrieved descriptors that grounded the answer, and the refusal state when applicable.

### 3.6 Build pipeline integration

- The pipeline export step (`far-country export`) is unchanged.
- A repo-root script `scripts/sync-web-data.{sh,ps1}` copies `data/exports/` into `apps/web/public/data/` and runs the web app's `scripts/build-index.ts`. CI runs this and verifies no drift.
- Vercel build command: `npm --prefix apps/web run build` after the sync script. Deploy time embeddings are computed once per deploy, not per request.

---

## 4. Acceptance criteria

The phase is complete when all of:

1. The web app loads `public/data/canonical.json` at deploy time and renders every entity in the export at `/entities/[slug]` with its approved descriptors, citations, and `symbolic_referent` / `temporal_phase` shown.
2. `/entities` supports filtering by `entity_type` and `tier` and free-text search across descriptor statements and entity names.
3. Clicking any scripture citation opens the cited ESV passage in a popover, fetched server-side through `/api/esv` (no ESV key in the browser bundle).
4. `/ask` answers a grounded question (e.g., "What are the gates of the New Jerusalem made of?") citing at least one descriptor, surfacing its tier, and identifying the model and prompt version.
5. `/ask` refuses a question with no grounded answer (e.g., "What color are the chairs in heaven?") without calling the LLM if retrieval is empty. The refusal must satisfy ADR 0004's contract — decline clearly and point at the closest relevant material in the dataset — but the user-facing wording is friendly, plain English (not the ADR's verbatim sentence). The exact wording is defined in `apps/web/src/lib/qa/system-prompt.md` and frozen by the grounding-contract tests once approved.
6. `/ask` correctly surfaces tier on answers that rest on `symbolic` or `debated` descriptors.
7. Unit tests cover: retrieval shape, refusal path, the citation-enforcement post-processor, and the grounded-answer contract under at least three canned questions (one clear-tier, one symbolic-tier, one no-grounding).
8. Schema-version mismatch refuses to start the app (loud failure) rather than rendering stale data.
9. Latency budget: entity detail page < 200ms p95 (warm), Q&A response start-of-stream < 5s p95.
10. CI (lint + typecheck + tests) passes on every commit. Phase 1's CI is not regressed.

---

## 5. Open questions to resolve during Phase 2

These need a decision before the relevant PR opens. Resolved decisions land as ADRs.

- **E1. Embedding provider.** Anthropic does not currently ship a first-party embedding model. Candidates: OpenAI `text-embedding-3-small`, Voyage AI `voyage-3` (Anthropic-recommended), or a local model (e.g., `bge-small`) at build time. **Default: OpenAI `text-embedding-3-small`** — reuses the maintainer's existing OpenAI subscription, and the quality gap vs. Voyage is in the noise on a dataset of this size (hundreds to low thousands of descriptors). The retrieval interface is pluggable; swapping providers is a single-file change if a future measurement justifies it. Locks via new ADR (`0007-embedding-provider.md`).
- **E2. Refusal threshold.** Below what retrieval score do we refuse without calling the LLM? Empirical; set initially to a conservative value and tune from real questions.
- **E3. Citation enforcement on the LLM output.** If the LLM returns an answer that fails to cite a retrieved descriptor, do we (a) rewrite by re-prompting with a stricter instruction, (b) reject and surface a refusal, or (c) both with a retry budget? Recommend (c) with a single retry.
- **E4. Search index strategy.** MiniSearch client-side is recommended for the dataset size we expect through Phase 2. If the dataset exceeds ~5 MB serialized, move to a server-side route. Decide at first real measurement.
- **E5. ESV proxy caching.** In-memory only, or write-through to a small KV (e.g., Vercel KV)? In-memory is fine for personal-study scale; KV is a Phase 2.5 upgrade if traffic warrants.
- **E6. Telemetry.** What do we record to measure grounding rate, refusal rate, and answer quality? Must respect the PRD's "privacy-respecting only" constraint. Recommend: structured server logs only, no user identifiers, no question content stored by default; opt-in for the developer to capture transcripts locally.
- **E7. Rate-limiting on `/api/ask`.** Per-IP sliding window for the personal-study deployment; revisit if/when we widen access.
- **E8. Auth.** Stays open per the stub's read posture. Q&A endpoint protected only by rate-limiting in Phase 2. Auth becomes interesting if/when public distribution is unlocked (post-ADR 0006).

---

## 6. Non-functional requirements

- **Grounding contract is load-bearing.** The system prompt is versioned; changes require a version bump and a passing grounding-contract test. The contract is the product.
- **Determinism on the data path.** Same export + same prompt version + same model → answers are stable modulo LLM nondeterminism. Build the embedding index from the export, not from a live query against the pipeline.
- **No source leakage.** The deployed bundle and the public data directory never contain ESV verse text or Willis text. ESV is fetched at runtime through the proxy; Willis is referenced by citation only. This is enforced by a CI check that greps the build output for known ESV phrasing of a sentinel verse and fails if found.
- **Read-only.** The web app cannot mutate the dataset. Any reviewer-style action goes through the Phase 1 review tool.
- **Observability.** Every Q&A response carries `{ model, prompt_version, schema_version, retrieved_descriptor_ids, refused: bool }` in its metadata. Logs include the same.
- **Cost discipline.** Default model is Sonnet per ADR 0004. Opus is available for opt-in higher-fidelity answers but not the default. Per-response token usage is logged.

---

## 7. Hermeneutic and licensing guardrails (non-negotiable)

These are in CLAUDE.md and ADRs 0005/0006 already; restating because Phase 2 is the first phase where these guardrails meet a user-facing surface.

- The Q&A interface must never silently smooth over difficult passages or import unsupported speculation. If retrieval surfaces only `symbolic` material, the answer must say so. If retrieval is empty, the answer must refuse.
- `tier` is rendered on every descriptor and every grounded answer. Symbolism is never flattened into literalism, and the literal is never flattened into the symbolic.
- The Q&A interface answers in a conservative-Protestant, literal-where-possible voice. It does not adjudicate between Christian traditions; it answers from the dataset.
- The repo and the deployed bundle never carry ESV or Willis source text in bulk. ESV text reaches the user only via the proxy at view time.

A Phase 2 PR that violates any of the above is blocked, regardless of test status.

---

## 8. Tests to write

- **Unit:** type-narrowing over the export, retrieval scoring shape, refusal path (no LLM call when retrieval is empty), citation-enforcement post-processor.
- **Contract:** grounded-answer contract under canned questions covering clear / symbolic / debated / no-grounding cases; refusal phrasing matches ADR 0004 verbatim.
- **Integration:** route smoke tests for `/`, `/entities`, `/entities/[slug]`, `/ask`, `/api/esv`, `/api/ask` (mocked Anthropic + ESV).
- **Build-time:** schema-version-mismatch test (synthetic bad manifest fails the build).
- **Bundle:** the "no source leakage" CI check above.

The Phase 1 pytest suite continues to run; no test from Phase 1 is allowed to regress.

---

## 9. Milestone mapping

Maps the roadmap milestones (M2.1–M2.5) onto PR-sized chunks:

- **PR 2A.1 — App shell + data layer.** Tailwind, types from the schema, loaders, manifest check, replaces the Phase 1 placeholder at `apps/web/`. Renders a minimal landing and `/entities`.
- **PR 2A.2 — Entity detail + relations.** `/entities/[slug]` with descriptors, citations, related-entity links, tier and temporal_phase badges, symbolic-referent rendering.
- **PR 2A.3 — Filters, search, ESV proxy.** Filter/search on `/entities`, MiniSearch index built at deploy time, `/api/esv` route with rate limiting, citation popover.
- **PR 2B.1 — Retrieval + index build.** Embedding interface, default provider wired in, `scripts/build-index.ts`, retrieval unit tests. No UI yet.
- **PR 2B.2 — Q&A endpoint.** `/api/ask`, grounded-answer pipeline, refusal path, citation enforcement, streaming. Tests cover the contract.
- **PR 2B.3 — Q&A UI.** `/ask` chat surface, descriptor rendering under each answer, model+prompt-version surfacing, rate-limit messages.

Each PR ships with its own tests and does not depend on uncommitted work in another branch.

---

## 10. References

- [`../prd.md`](../prd.md) §5 (Phase 2) and §9 (metrics).
- [`../roadmap.md`](../roadmap.md) Phase 2 milestones.
- [`../data-model.md`](../data-model.md) — schema is the source of truth.
- [`../hermeneutics.md`](../hermeneutics.md) — interpretive non-negotiables.
- [`../adr/0002-tech-stack.md`](../adr/0002-tech-stack.md) — Next.js + Tailwind locked.
- [`../adr/0004-llm-grounding-strategy.md`](../adr/0004-llm-grounding-strategy.md) — Q&A grounding contract; system prompt lives at `apps/web/src/lib/qa/system-prompt.md`.
- [`../adr/0005-hermeneutic-policy.md`](../adr/0005-hermeneutic-policy.md).
- [`../adr/0006-source-licensing-posture.md`](../adr/0006-source-licensing-posture.md) — no bulk source text in the bundle.
- [`./phase-1-dataset.md`](./phase-1-dataset.md) — the export this phase consumes.
