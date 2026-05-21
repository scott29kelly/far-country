# Spec — Phase 2: Browse UI + grounded AI Q&A

**Status:** Stub (filled out at the start of Phase 2)
**Phase:** 2

This spec is a placeholder. Its purpose right now is to record the goals, the things we already know, and the open questions that should be resolved before implementation.

---

## Goals

1. Make the canonical dataset browseable by a non-technical user.
2. Provide a grounded chat interface that answers strictly from the dataset and cites descriptors.
3. Be deployable on Vercel with no operational overhead.

---

## What we already know

- Stack: Next.js (App Router) + TypeScript + Tailwind. See [`../adr/0002-tech-stack.md`](../adr/0002-tech-stack.md).
- Q&A is RAG over **approved descriptors only**. See [`../adr/0004-llm-grounding-strategy.md`](../adr/0004-llm-grounding-strategy.md).
- Data source: `canonical.json` and per-entity JSON exports from the pipeline.
- ESV text is fetched at runtime via the ESV API when the user clicks into a citation. Not stored in the repo.
- Every Q&A answer must cite at least one descriptor; refusals are explicit when no descriptor supports the question.

---

## Pages (sketch)

- `/` — landing. What Far Country is, current dataset stats, link to browse and to Q&A.
- `/entities` — paginated/filterable entity list. Filter by `entity_type` and `tier`.
- `/entities/[slug]` — entity page: descriptors, citations, related entities, ESV-text peek.
- `/ask` — chat interface. Conversation, grounded answers, descriptor citations, model identifier surfaced.
- `/about/hermeneutics` — public-facing version of [`../hermeneutics.md`](../hermeneutics.md).
- `/about/sources` — public-facing version of [`../sources.md`](../sources.md).

---

## Open questions

- Auth — open access vs gated? (Likely open for read; the Q&A might need rate limiting.)
- Search — full-text search across descriptors. Lunr/MiniSearch in the browser vs server-side.
- Embedding store — when we add semantic retrieval for Q&A, where does the embedding index live? (Initial: in-memory at build time. Later: pgvector / Turso / similar.)
- ESV runtime fetching — direct from browser (CORS), through a Next.js route handler, or pre-fetched at build for the most-cited verses?
- Telemetry — what do we measure on refusal rate / answer quality? (Privacy-respecting only.)

---

## Done-when

To be defined at the start of Phase 2. Initial sketch in [`../prd.md`](../prd.md) §5.
