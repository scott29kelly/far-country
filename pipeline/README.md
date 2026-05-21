# `far_country` — extraction pipeline

This is the Python package that implements the Phase 1 extraction pipeline and canonical SQLite store for the Far Country world model. See [`../docs/specs/phase-1-dataset.md`](../docs/specs/phase-1-dataset.md) for the full implementation contract.

## Quickstart

From the repository root:

```bash
cd pipeline
uv sync --extra dev
uv run pytest
```

Initialize a fresh canonical SQLite store at `../data/canonical.sqlite`:

```bash
uv run python ../scripts/init_db.py
```

The database file is gitignored. Re-running `init_db.py` against an existing file is a no-op (it does not drop or overwrite tables).

## Layout

```
pipeline/
├── pyproject.toml
├── src/far_country/
│   └── store/                  ← SQLAlchemy models + raw-SQL migrations
└── tests/
```

Ingest, extraction, verification, export, and CLI modules land in subsequent PRs.
