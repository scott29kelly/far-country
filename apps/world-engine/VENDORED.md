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
setup; the Next app hosts its build output at `/world`; and its procedural
forest content is being progressively replaced with New Jerusalem geometry
driven by the canonical dataset.
