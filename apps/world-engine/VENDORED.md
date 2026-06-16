# Vendored engine — provenance and attribution

This directory contains a vendored copy of a third-party rendering engine that
Far Country has adopted as the foundation for its Phase 3 explorable 3D world.

## Upstream

- **Project:** PROJECT LAAS — a fully procedural WebGPU open world in the browser
- **Source:** https://github.com/Braffolk/fable5-world-demo
- **Upstream commit:** `fd75fdb718996908aad3d22b59dfa297dc94298d`
- **Author / copyright:** Copyright (c) 2026 Remi Sebastian Kits
- **License:** MIT (see `LICENSE` in this directory — retained unmodified)

## What was and was not copied

Copied: `src/`, `tools/`, `docs/`, `index.html`, `package.json`,
`package-lock.json`, `tsconfig.json`, `vite.config.ts`, and the upstream
`README.md` / `PROJECT_LAAS_v2.md` / `STATUS.md`.

Deliberately excluded: the upstream `shots/` (~164 MB) and `reference/`
(~8.6 MB) image directories, which are development artifacts we do not need.

## License compliance

This is MIT-licensed code. The obligation is to retain the copyright notice
and license text, which we do via the unmodified `LICENSE` file here. Far
Country's own modifications to this engine are made under the same terms.

## Relationship to Far Country

Why this engine, and how it is integrated, is recorded in
[`docs/adr/0013-fork-laas-engine-for-3d-world.md`](../../docs/adr/0013-fork-laas-engine-for-3d-world.md).
In short: it is kept as a standalone sub-app that builds with its own Vite
setup; and its procedural forest content is being progressively replaced with
New Jerusalem geometry driven by the canonical dataset.

## How it is hosted in the web app (Stage 2)

The engine's Vite `base` is `/laas/` for production builds, so its output is
emitted into the web app's static dir at that path with no edits to the engine:

- `apps/web`'s `npm run build:engine` runs `npm ci` + `npm run build` here, then
  copies `dist/` into `apps/web/public/laas/` (gitignored — a generated artifact).
- The Next route `apps/web/app/world-preview/page.tsx` hosts it in a
  full-viewport iframe pointing at `/laas/index.html`, so the engine runs
  untouched (own canvas, boot UI, error hooks, HUD), isolated from React.
- This `/world-preview` route coexists with the legacy R3F `/world` until the
  engine reaches parity on the New Jerusalem core elements, then `/world` is
  retired (per ADR 0013).
- CI builds this engine on every PR (the `world-engine` job) to guard against
  the vendored code ceasing to compile.

To view locally: `cd apps/world-engine && npm install && npm run dev`
(`localhost:5173`) for the engine standalone, or from `apps/web` run
`npm run build:engine` then `npm run dev` and open `/world-preview`. WebGPU
(Chrome 113+) is required.
