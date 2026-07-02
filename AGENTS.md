# Agent Instructions

See `CLAUDE.md` for full project orientation.

## Cursor Cloud specific instructions

- Monorepo with **no root `package.json`**. Dependencies and dev servers live per app under `apps/`:
  - `apps/web` — Next.js site. `npm install` then `npm run dev` (serves on port **3030**). `npm run build`, `npm test` (Vitest), `npm run typecheck`.
  - `apps/world-engine` — Vite 3D engine ("laas"). `npm install` then `npm run dev` (port **5173**, `--strictPort`).
  - `apps/review` — Python review UI (not part of the Node install).
- The `web` browse UI runs without secrets. The extraction pipeline and `apps/web` `build:index` (OpenAI embeddings) / `/api/ask` require API keys from the root `.env` (`ANTHROPIC_API_KEY`, `ESV_API_KEY`, `OPENAI_API_KEY`); see `.env.example`. These are secrets — the user must supply them.
