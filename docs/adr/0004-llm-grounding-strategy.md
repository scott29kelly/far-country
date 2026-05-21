# ADR 0004 — LLM grounding strategy

- **Status:** Accepted
- **Date:** 2026-05-21
- **Supersedes:** —
- **Superseded by:** —

## Context

Two places in the project use a language model:

1. **Extraction** (Phase 1): producing candidate descriptors from Scripture and Willis.
2. **Q&A** (Phase 2): answering user questions about heaven.

In both, the risk we are most concerned with is **hallucination dressed in citations** — the model producing claims that look grounded but are not. The hermeneutic policy ([`hermeneutics.md`](../hermeneutics.md)) is meaningless if the model can silently smuggle in unsupported claims.

## Decision

We adopt a strict grounding contract for both LLM uses.

### For extraction

- The LLM is presented with **the source text itself**, not asked to recall it from training. Scripture passages are pulled via the ESV API at run time; Willis text is loaded from local raw files.
- Every candidate descriptor must include the **exact verse range** it rests on (and Willis page range where applicable).
- A **citation verification pass** checks that the cited verse(s) plausibly support the claim. Initial heuristic: keyword/lemma overlap between the descriptor statement and the verse text. Stricter mode: a second model call acting as a judge ("does this verse support this claim? yes/no/partial").
- Descriptors that fail verification are flagged and routed to human review with the verification result visible.

### For Q&A

- The Q&A interface uses **retrieval-augmented generation** over the **approved descriptor set only**.
- The retrieval surface is the canonical dataset, not the ESV text, not Willis text, not training data.
- Every answer must include at least one descriptor citation. The system prompt forbids ungrounded claims.
- **Refusal is a feature.** If retrieval surfaces no descriptor relevant to the question, the model is instructed to say so plainly: "The dataset does not contain a grounded answer to this question. The closest relevant material is [...]."
- The model is forbidden from supplementing answers with information from its training that is not represented in retrieved descriptors. The system prompt is explicit about this.
- Tier is surfaced in the answer: if an answer rests on a `symbolic` or `debated` descriptor, the answer must say so.

### Model choice

- **Extraction:** Claude Opus (latest, currently `claude-opus-4-7`). Highest fidelity for tier judgments and symbolism detection.
- **Q&A:** Default to Claude Sonnet (currently `claude-sonnet-4-6`) for latency; surface the model identifier in the UI so users know which model produced the answer.
- Model identifiers are stored in the relevant `extraction_run` row (for extraction) and in conversation metadata (for Q&A).

## Consequences

- **Hallucinated citations are detectable.** The verification pass catches the common failure mode where a model confidently cites the wrong verse.
- **The Q&A interface will sometimes refuse.** This is correct behavior. We measure refusal rate as a quality metric, not a failure metric.
- **The dataset is the ceiling.** Q&A can never be more knowledgeable than the dataset is. This pushes investment toward dataset quality, which is exactly where we want it.
- **The system prompt is load-bearing.** It must be versioned, tested, and changed deliberately. We will store it in `apps/web/src/lib/qa/system-prompt.md` and version it.

## References

- [`docs/hermeneutics.md`](../hermeneutics.md)
- [`docs/extraction-pipeline.md`](../extraction-pipeline.md)
- [`docs/data-model.md`](../data-model.md)
