# Far Country — web

The Next.js app shell for the Phase 2 browse UI and grounded Q&A. Reads the canonical export produced by the Phase 1 pipeline and renders it for a non-technical reader.

This is the **real Phase 2 app**, not the Phase 1 placeholder. (The placeholder lives forever at the git tag `phase-1-placeholder` — `git checkout phase-1-placeholder -- apps/web/` to inspect it.)

## What ships in PR 2A.1

- Tailwind v4 + Next 15 (App Router) + React 19 + TypeScript.
- Type-safe data layer (`src/lib/data/`) over the canonical export, with a manifest schema-version guard that refuses to render on a major-version mismatch.
- Dev fixture data under `src/lib/data/__fixtures__/` so `npm run dev` works without any pipeline run.
- Pages: landing (`/`) and entity index (`/entities`).
- Vitest unit tests over the loader fallback and manifest guard.

PR 2A.2 adds entity detail pages. PR 2A.3 adds filtering, search, and the ESV citation drill-down. PR 2B series adds retrieval and grounded Q&A.

## Run it locally

```bash
cd apps/web
npm install
npm run dev
# → http://localhost:3030
```

This works immediately against the committed dev fixtures (2 entities, 3 descriptors). To browse the real curated dataset instead:

```bash
# From the repo root — generate the canonical export
uv run --project pipeline far-country export

# Stage the exports under the web app's public dir
mkdir -p apps/web/public/data
cp -r data/exports/* apps/web/public/data/
```

The loader prefers `public/data/` over `__fixtures__/` automatically.

## Tests + typecheck

```bash
npm run typecheck
npm run test
```

## Tech notes

- **Tailwind v4** with CSS-first config (`@theme { ... }` in `globals.css`); no `tailwind.config.js`.
- **Path alias** `@/*` → `./src/*`. Pages under `app/` import library code via `@/lib/...`.
- **Types are hand-maintained** against the Python JSON Schema (`pipeline/src/far_country/export/schema.py`). Codegen-from-schema is tracked as deferred tech debt in the PR 2A.1 description.
- **Source-text licensing.** Per ADR 0006, neither the bundle nor the public data directory ever contains raw ESV or Willis text. ESV proxy + the no-source-leakage CI check land with PR 2A.3.

## Constraints

- Read-only over the canonical export. Mutations happen in the Phase 1 review tool (`apps/review/`), never here.
- Hermeneutic policy (`docs/hermeneutics.md`) is load-bearing. Tier, `symbolic_referent`, and `temporal_phase` must surface in the UI — they are not optional decorations.
