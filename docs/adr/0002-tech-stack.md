# ADR 0002 — Tech stack

- **Status:** Accepted
- **Date:** 2026-05-21
- **Supersedes:** —
- **Superseded by:** —

## Context

Far Country has three eventual surfaces: an extraction pipeline (back-of-house), a browse UI + grounded Q&A (Phase 2), and an explorable 3D world (Phase 3). The builder is solo + AI-assisted with a long horizon. The choice space includes:

- For the 3D layer: a game engine (Unity / Unreal) vs. browser-native (Three.js / React Three Fiber).
- For the app shell: Next.js vs. SvelteKit vs. Astro vs. plain Vite.
- For the pipeline: Python vs. TypeScript vs. polyglot.
- For the datastore: SQLite vs. Postgres vs. a graph DB.

We must pick a stack that keeps the surface area small, ships easily for a solo dev, and aligns with where AI-assisted coding is strongest today.

## Decision

- **Extraction pipeline:** Python 3.12, `uv` for env, `anthropic` SDK, `pydantic` for validation, `sqlalchemy` over SQLite.
- **Review tool:** FastAPI + HTMX (lightweight, ships with the pipeline as one process).
- **Canonical store:** SQLite (`canonical.sqlite`). JSON exports for consumers.
- **App shell (Phase 2+):** Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.
- **3D layer (Phase 3):** React Three Fiber + drei + zustand, inside the Next.js app.
- **AI Q&A:** Anthropic Claude (Opus for extraction, Sonnet acceptable for re-runs and Q&A latency-sensitive paths).

Rejected alternatives:

- **Unity/Unreal for the 3D world.** Higher fidelity ceiling, but: no shared language with the rest of the stack, no instant share-via-URL, install/build friction for the user, steeper solo learning curve, much weaker AI-assisted dev support for game-engine workflows.
- **TypeScript pipeline.** The extraction step benefits from Python's mature LLM/NLP tooling and from `pydantic` for schema validation. A TS pipeline adds friction without payoff.
- **Postgres as canonical store.** Overkill at this scale; SQLite is portable, file-based, easy to version (the schema, not the data), and trivial to ship.
- **A graph DB.** The relations we model are simple enough that a SQL `entity_relation` table covers them; introducing a graph DB would add operational overhead with no current payoff.

## Consequences

- The user-facing stack is uniformly JS/TS — one mental model from app shell to 3D.
- The pipeline is uniformly Python — clean separation, no contamination.
- The canonical store is a single file we can copy, version, and inspect with `sqlite3`.
- The whole frontend deploys as one Next.js app on Vercel.
- We accept lower 3D ceiling than Unity could offer; we judge this acceptable for a project where the dataset, not the rendering, is the primary value.
- If the 3D requirements grow beyond what R3F handles well, a future ADR can introduce a dedicated engine, with the same dataset feeding it.

## References

- [`docs/data-model.md`](../data-model.md)
- [`docs/extraction-pipeline.md`](../extraction-pipeline.md)
