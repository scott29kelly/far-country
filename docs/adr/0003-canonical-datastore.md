# ADR 0003 — Canonical datastore

- **Status:** Accepted
- **Date:** 2026-05-21
- **Supersedes:** —
- **Superseded by:** —

## Context

The canonical dataset is the core artifact of the project. We need a store that:

- Is easy to inspect and edit manually when reviewing descriptors.
- Survives long pauses (no managed service to pay for or maintain during idle months).
- Can be exported deterministically to feed downstream consumers (browse UI, 3D layer, Q&A).
- Is portable enough to commit (the schema, at least) or back up trivially.

## Decision

The canonical datastore is a **single SQLite database** at `data/canonical.sqlite`.

- Schema is defined in `docs/data-model.md` and codified in pipeline migrations.
- The database file itself is **not committed** by default (it's listed in `.gitignore`). The schema is recoverable from migrations.
- Downstream consumers read from **JSON exports**, not directly from SQLite. Exports are produced by `scripts/export_canonical.py` and live in `data/exports/`.
- The schema carries a `schema_version` value; exports include it; consumers check it on load.

## Why not Postgres?

- The dataset is small (thousands of descriptors at most).
- No concurrent writers — the reviewer is one human at a time.
- SQLite is zero-ops; Postgres is ops-positive.
- SQLite files are easily backed up by copying.

## Why JSON exports rather than direct DB consumption?

- Consumers (Next.js app, R3F scene) should not couple to the physical SQL schema.
- JSON exports give us a stable, semver'd contract — we can refactor the SQLite schema without breaking consumers.
- Static JSON is cacheable, CDN-friendly, and works in a fully static deployment.

## Consequences

- One file is the source of truth for the entire project. Loss of `canonical.sqlite` loses curated reviewer work. **Mitigation:** a backup script writes timestamped copies to a separate location and (optionally) to private cloud storage.
- The schema lives in two places: SQL migrations and `docs/data-model.md`. They must be kept in sync. The data-model doc is the human-readable canonical statement; migrations encode it for the DB.
- If the project ever needs multiple concurrent writers (multi-reviewer Phase 1.5), we revisit this ADR.

## References

- [`docs/data-model.md`](../data-model.md)
- [`docs/extraction-pipeline.md`](../extraction-pipeline.md)
