# Spec — Phase 1: Extraction pipeline + review tool + canonical dataset

**Status:** Active spec
**Phase:** 1
**Goal:** Ship a working extraction pipeline, a human-review UI, and a first canonical dataset.

This spec is the implementation contract for Phase 1. It is intentionally concrete.

---

## 1. Scope

In scope:

- Python extraction pipeline that processes ESV passages and Willis chapters into candidate descriptors.
- SQLite canonical store implementing the schema in [`../data-model.md`](../data-model.md).
- Human-review web UI (FastAPI + HTMX) over the SQLite store.
- Export script producing JSON consumed by Phase 2.
- Unit tests for schema validation, dedup, and verification logic.

Out of scope (this phase):

- Browse UI beyond a sanity-check placeholder.
- Grounded Q&A.
- Any 3D rendering.
- Multi-user / multi-reviewer features.

---

## 2. Repository structure (Phase 1)

```
far-country/
├── apps/
│   └── review/                    ← FastAPI + HTMX review tool
│       └── ...
├── pipeline/                      ← Python extraction pipeline
│   ├── pyproject.toml
│   ├── src/
│   │   └── far_country/
│   │       ├── __init__.py
│   │       ├── ingest/            ← ESV + Willis loaders
│   │       ├── extract/           ← LLM-assisted extraction
│   │       ├── verify/            ← citation verification
│   │       ├── store/             ← SQLite + SQLAlchemy
│   │       ├── export/            ← JSON export
│   │       └── cli.py
│   └── tests/
├── scripts/
│   ├── init_db.py
│   ├── run_extraction.py
│   └── export_canonical.py
├── data/
│   ├── raw/                       ← gitignored; ESV cache, Willis chunks
│   ├── canonical.sqlite           ← gitignored
│   └── exports/                   ← generated JSON
└── docs/                          ← existing docs from Phase 0
```

---

## 3. Components

### 3.1 Ingest (`pipeline/src/far_country/ingest/`)

- `esv.py`: ESV API client. Caches per-chapter responses to `data/raw/esv/`. Exposes `get_passage(book, chapter)` returning structured verses.
- `willis.py`: loads pre-chunked Willis text from `data/raw/willis/<chapter>.md`. Returns sections with page-range metadata.

### 3.2 Extraction (`pipeline/src/far_country/extract/`)

- `prompts.py`: versioned prompt templates. Constants: `PROMPT_VERSION`, `PASSAGE_PROMPT`, `ENTITY_PROMPT`, `WILLIS_PROMPT`.
- `extractor.py`: orchestrates calls to Anthropic Claude. Returns a list of `CandidateDescriptor` (pydantic) per source unit.
- `dedup.py`: merges candidates by `(entity_id, citation, statement-similarity)`. Similarity uses normalized statement comparison (lowercase, whitespace-collapsed, punctuation-stripped, plus an embedding-similarity threshold once embeddings are added).

### 3.3 Verification (`pipeline/src/far_country/verify/`)

- `citation_check.py`: given a descriptor and its citation, fetches the cited text and applies (a) keyword/lemma overlap and (b) optional LLM-judge to score support. Output: `VerificationResult` with `score` and `pass|fail|partial`.

### 3.4 Store (`pipeline/src/far_country/store/`)

- `models.py`: SQLAlchemy ORM models matching the schema in [`../data-model.md`](../data-model.md).
- `migrations/`: simple migration scripts (number-prefixed `.sql` files).
- `repo.py`: repository functions (`insert_descriptor`, `update_review_status`, `list_pending`, etc.).

### 3.5 Export (`pipeline/src/far_country/export/`)

- `canonical.py`: produces `data/exports/canonical.json` and `data/exports/entities/<slug>.json` from `review_status='approved'` descriptors.
- `manifest.py`: writes `data/exports/manifest.json` with `schema_version`, `generated_at`, and counts.

### 3.6 CLI (`pipeline/src/far_country/cli.py`)

- `far-country ingest esv <book> <chapter>` — pulls and caches.
- `far-country extract passage <book>:<chapter>[:<verses>]` — runs the passage prompt.
- `far-country extract entity <slug>` — runs the entity prompt.
- `far-country extract willis <chapter>` — runs Willis extraction.
- `far-country verify --since <run-id>` — runs verification over recent candidates.
- `far-country export` — writes JSON exports.

### 3.7 Review UI (`apps/review/`)

- FastAPI app. Single SQLite file shared with the pipeline.
- Routes:
  - `GET /` — overview: counts by status, by tier, recent runs.
  - `GET /queue` — paginated pending descriptors, one per page.
  - `GET /queue/<id>` — single descriptor with citation preview, entity context, edit fields.
  - `POST /queue/<id>/approve` | `/reject` | `/discuss` | `/edit` — actions.
  - `GET /entities/<slug>` — read view of an entity and its approved descriptors.
- HTMX for partial updates; no SPA framework.
- Keyboard shortcuts: `a` approve, `r` reject, `d` discuss, `e` edit, `j/k` next/prev.

---

## 4. Acceptance criteria

The phase is complete when all of:

1. The pipeline can process **Revelation 21** end-to-end with no manual intervention: ingest → extract → verify → store → review-UI shows the pending queue.
2. The reviewer can approve, reject, and edit descriptors and the state persists.
3. The export script writes a `canonical.json` that passes JSON-schema validation against the documented schema.
4. A placeholder Next.js page (in a separate `apps/web/` directory) loads `canonical.json` and renders one entity (e.g., New Jerusalem) with its approved descriptors and citations.
5. Unit tests cover: schema validation, dedup, and citation verification (at least the keyword-overlap heuristic).
6. CI (lint + tests) passes on every commit to the main branch.

---

## 5. Open questions to resolve during Phase 1

- Exact dedup similarity threshold (will be empirical).
- Whether to introduce embeddings for similarity now or defer to Phase 2.
- Whether the LLM-judge verification pass runs always or only on a sampled subset (cost).
- How aggressively to chunk Willis (per-page vs per-section vs per-chapter).
- Whether to add an "intermediate review" status for descriptors that need a Scripture-fluent reviewer (vs editorial review).

---

## 6. Non-functional requirements

- **Determinism:** same inputs (model + prompt version + source) produce the same candidates ± LLM nondeterminism. We accept LLM nondeterminism; we control everything else.
- **Idempotency:** re-running extraction on a passage does not duplicate approved descriptors.
- **Observability:** every run logs to stdout and writes a row to `extraction_run` with counts.
- **Cost discipline:** Opus for extraction, Sonnet for verification re-runs; track per-run token usage in `extraction_run.notes`.

---

## 7. References

- [`../data-model.md`](../data-model.md)
- [`../extraction-pipeline.md`](../extraction-pipeline.md)
- [`../hermeneutics.md`](../hermeneutics.md)
- [`../adr/0002-tech-stack.md`](../adr/0002-tech-stack.md)
- [`../adr/0004-llm-grounding-strategy.md`](../adr/0004-llm-grounding-strategy.md)
