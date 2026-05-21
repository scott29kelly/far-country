# Far Country — web (Phase 1 placeholder)

A minimal Next.js page that loads the Phase 1 canonical JSON export and renders
one entity (New Jerusalem). It exists to close spec acceptance criterion 4:

> A placeholder Next.js page (in a separate `apps/web/` directory) loads
> `canonical.json` and renders one entity (e.g., New Jerusalem) with its
> approved descriptors and citations.

This is **not** the real browse UI — that's Phase 2. The placeholder proves
the export contract works end-to-end.

## Run it locally

The web app reads its data from `apps/web/public/data/`, which is gitignored.
You produce that data with the Phase 1 pipeline:

```bash
# From the repo root — generate canonical.json + entities/<slug>.json
uv run --project pipeline far-country export

# Stage the exports under the web app's public dir
mkdir -p apps/web/public/data
cp -r data/exports/* apps/web/public/data/

# Run the placeholder
cd apps/web
npm install
npm run dev
# → http://localhost:3030
```

If `apps/web/public/data/entities/new-jerusalem.json` is missing, the page
renders a fallback panel explaining how to populate it.

## What this page is and isn't

It is:

- A read-only server component that imports the entity JSON via the Node
  filesystem at build/request time.
- Styled minimally to make the data legible — not the visual identity for
  Phase 2.

It is **not**:

- The Phase 2 browse UI (that gets real navigation, Tailwind, a design system,
  search, and the 3D layer).
- A demonstration of grounded Q&A (Phase 2).
- Deployed anywhere — the licensing posture (ADR 0006) restricts public
  artifacts that redistribute ESV or Willis text. Descriptors are
  project-original paraphrases and may be safe to deploy, but the call lives
  in a future ADR.

## Tech

- Next.js 15 (App Router)
- React 19, TypeScript 5
- No CSS framework — single `globals.css`, kept minimal on purpose
