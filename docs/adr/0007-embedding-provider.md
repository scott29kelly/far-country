# ADR 0007 — Embedding provider

- **Status:** Accepted
- **Date:** 2026-05-21
- **Supersedes:** —
- **Superseded by:** —

## Context

Phase 2 Q&A is RAG over the approved descriptor set (ADR 0004). Retrieval needs an embedding model so that a user question like *"what are the entrances to the city made of?"* can surface a descriptor that says *"the twelve gates are twelve pearls"* — a match that keyword search misses.

Anthropic does not ship a first-party embedding model. Three candidate paths:

1. **OpenAI** — `text-embedding-3-small`. Mature, well-benchmarked, 1536 dimensions, $0.02 per 1M tokens.
2. **Voyage AI** — `voyage-3`. Anthropic's documented recommendation for embedding alongside Claude. Slightly higher MTEB retrieval scores than OpenAI's small model.
3. **Local** — e.g. `BAAI/bge-small-en-v1.5` via `sentence-transformers`. No API, no cost, runs at build time.

## Decision

The default embedding provider is **OpenAI `text-embedding-3-small`**.

The retrieval interface in `apps/web/src/lib/retrieval/` is **pluggable** — providers implement a single `embed(texts: string[]) → number[][]` contract — so swapping is a one-file change if a future measurement justifies it.

## Why OpenAI rather than Voyage

- **Existing subscription.** The maintainer already pays OpenAI. Adding Voyage means another vendor, another key, another billing relationship. The marginal benefit of a Voyage-shaped quality bump does not justify that operational cost.
- **Quality gap is in the noise at this dataset size.** Far Country's canonical dataset is on the order of hundreds to low thousands of descriptors. MTEB retrieval-quality differences between `text-embedding-3-small` and `voyage-3` are measurable at scale (millions of documents) but indistinguishable on a corpus this small.
- **Reversible.** The pluggable interface means we can swap providers later if a Phase 2 measurement shows real Q&A quality differences. The interface, not the choice, is the load-bearing part.

## Why not local (`bge-small`)

- Adds Python + a model download to the Next.js build pipeline; complicates Vercel deployment.
- Quality is competitive on benchmarks but lags the hosted models on real-world retrieval.
- Worth revisiting if/when we move to a fully offline build, but not for the personal-study deployment.

## Consequences

- **`OPENAI_API_KEY` joins `ANTHROPIC_API_KEY` and `ESV_API_KEY` as a required env var** for Phase 2 builds. `.env.example` will be updated when PR 2B.1 wires retrieval in.
- **Embedding cost is negligible.** ~1,000 descriptors × ~50 tokens each = ~50K tokens per full re-index; at `$0.02/M tokens` that's $0.001. Re-indexing happens once per deploy.
- **Embeddings ship as a static artifact.** `public/data/embeddings.json` is generated at deploy time and served as a static asset. No runtime embedding calls on the read path — only on the write path of `/api/ask` (user question → vector).
- **Determinism caveat.** OpenAI's embedding outputs are deterministic for a fixed input + model version. If OpenAI versions the model out from under us, we re-embed and re-deploy. The model identifier is stored alongside `schema_version` in the manifest.
- **No source text leaks to OpenAI.** Only descriptor *statements* are embedded — statements are the project's own derivative content, not ESV or Willis source text. This is consistent with ADR 0006 (licensing posture).

## References

- [`docs/adr/0004-llm-grounding-strategy.md`](0004-llm-grounding-strategy.md)
- [`docs/adr/0006-source-licensing-posture.md`](0006-source-licensing-posture.md)
- [`docs/specs/phase-2-browse-ui.md`](../specs/phase-2-browse-ui.md) §3.4, §5 E1
