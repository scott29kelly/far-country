# Extraction Pipeline

This document specifies how the canonical dataset is built. It is the spec the Phase 1 implementation follows.

The pipeline turns two corpora — the ESV Bible and Janet Willis's *What on Earth Is Heaven Like?* — into a curated set of approved descriptors stored in `canonical.sqlite`.

---

## 1. Pipeline overview

```
┌──────────────┐    ┌────────────────┐    ┌──────────────────┐    ┌──────────────┐
│ Source       │    │ Candidate      │    │ Human-review     │    │ Canonical    │
│ ingest       │──▶ │ extraction     │──▶ │ queue (UI)       │──▶ │ dataset      │
│ (ESV, Willis)│    │ (LLM-assisted) │    │                  │    │ (SQLite)     │
└──────────────┘    └────────────────┘    └──────────────────┘    └──────────────┘
                                                                           │
                                                                           ▼
                                                                  ┌──────────────┐
                                                                  │ JSON exports │
                                                                  │ (consumers)  │
                                                                  └──────────────┘
```

Every stage is idempotent and re-runnable. The pipeline is deterministic given the same prompt version + model + source scope.

---

## 2. Stage 1 — Source ingest

### ESV

- Pulled via the official ESV API (Crossway).
- Cached locally to `data/cache/esv/<book>/<chapter>.json` to avoid re-pulling.
- Stored under fair use for personal study; not committed to the repo.
- Granularity: whole chapters, with verse offsets preserved.

**Initial scope** (passages most directly about heaven, ordered by priority):

1. Revelation 4–5, 7, 19–22 (especially 21–22)
2. Isaiah 60, 65–66
3. Ezekiel 1, 40–48
4. John 14:1–3
5. 1 Corinthians 15
6. 2 Corinthians 5:1–10
7. 1 Thessalonians 4:13–18
8. Hebrews 11:8–16, 12:18–24, 13:14
9. Philippians 3:20–21
10. Luke 16:19–31; Luke 23:39–43
11. 2 Peter 3:10–13
12. Daniel 7:9–14
13. Matthew 5:1–12; Matthew 22:23–33

Once the explicit-about-heaven set is processed, broaden to incidental references (Gen 5:24, 2 Kings 2:11, Acts 1:9–11, etc.).

### Willis

- Held locally in `data/raw/willis/` (not committed).
- Pre-processed into chapter-sized chunks with page numbers preserved.
- The structure of the book — its chapters and the questions she organizes them around — becomes the initial structuring lens for entity categorization.

---

## 3. Stage 2 — Candidate extraction

The LLM-assisted extraction step is the heart of the pipeline. It is **assisted**, not autonomous: it produces candidates, not canonical entries.

### 3.1 Prompt strategy

Two complementary prompts, run independently and reconciled:

**(a) Passage-driven prompt.** Given a Scripture passage, extract every descriptor of heaven (or of any heavenly entity) that the passage supports. Required output: a list of candidate descriptors, each with statement, suggested entity, suggested tier, suggested temporal_phase, and the precise verse range it rests on.

**(b) Entity-driven prompt.** Given an entity (e.g., "the throne," "the river of life," "the angels"), surface every passage in the ingested ESV that bears on it, and produce a descriptor per claim.

Reconciliation: descriptors from (a) and (b) are merged on `(entity_id, citation, statement-similarity)` with deduplication.

### 3.2 Prompt template (sketch)

```
You are extracting candidate descriptors of heaven from Scripture.

HERMENEUTIC: Conservative Protestant, literal-where-possible. Symbolic readings
flagged when text genre signals symbolism (apocalyptic, prophetic vision,
poetry, stated symbolism, internal absurdity if read literally).

For each descriptor:
- Write a single, self-contained claim about heaven (not a meta-claim about
  the verse).
- Identify the entity it describes (suggest a slug if not in the provided
  entity list).
- Assign a tier: clear | fuzzy | debated | symbolic.
- If symbolic: provide a symbolic_referent.
- Assign a temporal_phase: intermediate | final | either | unspecified.
- Cite the exact verse range.

Do not include:
- Speculation beyond the passage.
- Descriptors that require sources outside the canonical 66 books.
- Paraphrases that add content not in the text.

If a passage is fuzzy or debated, prefer extracting it with the appropriate
tier over skipping it.

PASSAGE: <book> <chapter>:<verses>
TEXT: <passage text>
ENTITY HINTS: <existing entities likely relevant>

Output JSON conforming to the descriptor schema.
```

Prompt versions are tracked in `extraction_run.prompt_version`.

### 3.3 Willis extraction

Willis is extracted with a parallel prompt that treats her as a structuring lens:

- For each chapter / section, identify the entities she organizes around and the claims she makes.
- For each Willis claim, attempt to back it with the Scripture references she cites. If she cites Scripture, the descriptor inherits the Scripture citation as primary and the Willis page as secondary.
- A Willis claim that is *not* backed by Scripture in her own text becomes a descriptor with only a Willis citation — and is automatically tier-tagged `fuzzy` or `debated` for human review.

### 3.4 Output

All candidates land in `descriptor` with `review_status='pending'`. The `provenance` field records:

```json
{
  "run_id": "...",
  "prompt_version": "0.1.0",
  "model": "claude-opus-4-7",
  "prompt": "passage" | "entity" | "willis",
  "source_scope": "esv:revelation:21",
  "raw_response_hash": "sha256:..."
}
```

---

## 4. Stage 3 — Human review

The human-review tool is a minimal web UI over `canonical.sqlite`. It is not optional — no descriptor enters consumer exports without human approval.

### 4.1 Workflow

For each `pending` descriptor, the reviewer:

1. Reads the descriptor statement.
2. Reads the cited verse(s) in context (the reviewer UI shows the surrounding passage).
3. Checks the suggested entity, tier, and temporal_phase.
4. Edits any field freely.
5. Acts:
   - **Approve** → `review_status='approved'`. Descriptor is now canonical.
   - **Reject** → `review_status='rejected'` with required `reviewer_notes`. Stays in the DB for audit but not exported.
   - **Needs discussion** → `review_status='needs-discussion'` with notes. Surfaced separately for batched theological consultation.

### 4.2 UI targets

- Single descriptor per screen, keyboard-driven (A approve, R reject, D needs-discussion, E edit).
- Citation preview inline (no tab-switching to look up the verse).
- Tier and temporal_phase as quick-select chips.
- Time-on-task: median < 10s for clear descriptors, < 60s for fuzzy/debated.

### 4.3 Inter-reviewer consistency (future)

If/when multiple reviewers participate, the same descriptor goes to two reviewers; disagreements route to `needs-discussion`. Phase 1 single-reviewer is fine.

---

## 5. Stage 4 — Canonical dataset & exports

After approval, descriptors live in `canonical.sqlite` as the source of truth.

Exports are generated by a separate script:

```
scripts/export_canonical.py
  → data/exports/canonical.json           (full flat export)
  → data/exports/entities/<slug>.json     (per-entity for the browse UI)
  → data/exports/manifest.json            (schema_version, generated_at, counts)
```

The 3D layer (Phase 3) and Q&A interface (Phase 2) consume the exports, never the SQLite directly. This keeps the canonical store free to evolve without coupling consumers to its physical schema.

---

## 6. Re-running & re-extraction

The pipeline is designed to be re-run as the prompt improves:

- A new `extraction_run` row is created.
- New candidates are deduplicated against existing approved descriptors. Matches are skipped. Near-matches surface in a "candidate variant" view in the review UI.
- Approved descriptors are not overwritten. They can be edited only via the review UI, with the edit captured in `reviewer_notes`.

This lets us iterate on prompts without losing curated work.

---

## 7. Failure modes & mitigations

| Failure mode | Mitigation |
| --- | --- |
| LLM hallucinates a descriptor with a real-looking citation | Citation verification step: the cited verse range is fetched and the descriptor flagged if the words don't plausibly support the claim (LLM-as-judge or simple keyword overlap). |
| LLM under-tiers symbolism (marks `clear` what should be `symbolic`) | Reviewer is the backstop; additionally, a second-pass prompt specifically scans apocalyptic / prophetic passages for missed symbolism. |
| Reviewer fatigue → rubber-stamping | UI shows tier distribution and rejection rate per session; if approval-rate spikes anomalously, surface a warning. |
| Willis claim is more inventive than Scripture warrants | Willis-only descriptors are tier-tagged `fuzzy` or `debated` by default; reviewer can upgrade to `clear` only with a found Scripture citation. |
| Prompt drift across versions | Prompts are versioned; every descriptor's provenance pins the prompt version that produced it. |

---

## 8. Implementation notes (Phase 1)

- Language: Python 3.12.
- Package manager: `uv`.
- LLM SDK: `anthropic` (use Claude Opus for extraction; Sonnet acceptable for re-runs).
- Validation: `pydantic` v2 for all candidate-descriptor payloads.
- DB: SQLite via `sqlalchemy` (lightweight).
- Review UI: FastAPI + HTMX (recommended) or a small Next.js page sharing the SQLite. Recommendation: FastAPI + HTMX because it ships with the pipeline as one repo and one runtime.
- Tests: pytest, focused on the schema-validation and dedup logic.

Concrete spec for Phase 1 implementation: [`specs/phase-1-dataset.md`](specs/phase-1-dataset.md).
