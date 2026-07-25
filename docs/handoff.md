# Handoff — Far Country (2026-07-24)

A snapshot of live state for whoever picks this up next. Durable project rules
live in `CLAUDE.md` and `AGENTS.md`; the engine's detailed status lives in
`apps/world-engine/STATUS.md` (its top carries the rehydration protocol — read
it first for any 3D work). This file is a point-in-time snapshot — trust the
code and `STATUS.md` over it where they disagree.

## Where the code is

- **`origin/main` (`8f9b936`)** is current and production (Vercel deploys on
  push). Twelve PRs (#31–#42) landed since this file's previous snapshot
  (`77704bc`, 2026-07-18):
  - **#31** M3.6 population — ~12,700 instanced white-robed figures (Rev 7:9)
    in forty worship assemblies, plus the angelic light-pillar hosts (Rev 5:11).
  - **#32** boot refinement (engine city sprite, verse raised, gem row and
    summit orb removed).
  - **#33** M3.5 reading key — one marker per cited entity, a colored dot per
    confidence tier (`K`, the KEY chip, or `?key=1`; off by default).
  - **#34** processional ascent (RENDERING-DECISIONS #10) + the wall-entombment
    fix that opened the street-of-gold gallery inside the jasper wall.
  - **#35** Track A: the Ezek 45/48 allotment measurements seeded (ADR 0017).
  - **#36** dwelling-campus pick (cited Ezek 45:4-5 zones), entity exports at
    schema 0.2.0 with embedded `measurements`, `apps/web/public/data` committed.
  - **#37** figure idle sway (shader-time `positionNode`, no CPU per-instance
    work).
  - **#38** Phase B config started — the campus consumes EZA through a declared
    district-scale mode (ADR 0018, RENDERING-DECISIONS #11).
  - **#39** city-side Rev 21 resolver — `cityModel.CITY_HALF` derives from
    `rev-city-side` (12,000 stadia) through the declared `compressed-city`
    mode (RENDERING-DECISIONS #12).
  - **#40** Phase B closed — `cityTiers` + `look` defaults in `config.ts`;
    `rebuildNewJerusalem(config)` recorded overtaken-by-events.
  - **#41** Phase C slice 1 — seven named content stages via `?stages=`
    (`src/nj/stages.ts`); a stage owns its geometry AND its derived probe hooks.
  - **#42** collision sweep fix — `resolveCityMoveLocal`'s substeps are now
    INCREMENTAL, closing a frame-spanning tunnel at fly speed.
- **Vendored bundle in sync:** `apps/web/public/laas` serves
  `assets/index-DviqRZ7t.js`, which matches a fresh `npx vite build` of the
  current tree.
- **Branch `claude/eager-margulis-091662`** (separate worktree): Xbox/Switch
  **gamepad navigation** — `src/core/GamepadInput.ts` polled from
  `FlyCamera.update()`, probe-verified (CPU 22/22, live 6/6). UNMERGED, and
  its three commits are **local-only (never pushed)**; the worktree also holds
  an uncommitted `.claude/launch.json` edit. Parked until Scott's feel pass
  with the physical pad. Keep the branch alive; do not touch the worktree.
- Two coexisting 3D implementations per **ADR 0013**: the retired legacy R3F
  scene (`apps/web/src/lib/world/`) and the vendored **LAAS WebGPU engine at
  `/world-preview`** (`apps/world-engine/`), the front door.

## Open PRs

- **#23 (draft)** — Cursor Cloud dev-environment notes (docs only), idle since
  2026-07-15. Finish or close — Scott's call. It is the only open PR.
- **#28** is CLOSED with its branch kept (boot-stills "Direction 2", built on
  the pre-#25 tree — merging as-is would revert the arrival rite). Do not
  reopen; the direction-1-vs-2 verdict is still Scott's to give.
- **#29** was closed as superseded. Its one surviving correction — the stale
  M3.2 roadmap stamp — was folded into `docs/roadmap.md` on 2026-07-24, so
  branch `codex/pr26-hardware-handoff` is now dead and safe to delete.

## Decisions waiting on Scott

1. **Measurement-only entities** (records with measurements but no descriptors)
   are currently excluded from `canonical.json` and the `/entities` browse
   index, and appear only in the per-entity exports the world HUD reads. Should
   they surface in the browse UI?
2. **Subjective / feel passes owed** (support these, do not pre-empt them):
   reading-key styling and copy across the 14 markers, campus card copy, sway
   feel (`populationModel.SWAY`), ascent wedge flanks, gallery interior
   lighting, the ~46 degree base climb, walk feel with crowds present, M1 Max
   perf verdict, rite pacing and audio levels, and the gamepad feel pass
   (blocked on hardware).
3. **Phase C remainder, when called:** stage-granular toggling INSIDE
   `CityMassing` (arcade detail as its own stage) and the timed "city assembles
   itself" arrival sequence built on the stage system.
4. **Cloud reprojection pass** (cloud-edge speckle debt) — only on an explicit
   go-ahead.

## Phase 3 state (detail: docs/roadmap.md Phase 3 + STATUS.md)

- **M3.1–M3.6 are all built and probe-verified on `/world-preview`:**
  scaffolding; the city shell (jasper wall, twelve real gate gaps with Rev
  21:12 tribe inscriptions, notched foundation course, lateral collision, walk
  floors, processional ramp chains); mountain/river/trees of life; the citation
  HUD with click-picking and proximity auto-cards (including the dwelling
  campus); tier badges plus the in-scene reading key; and the population with
  idle sway.
- **Track A is no longer blocked.** The Ezek 45/48 allotment records (`eza-`)
  and the Rev 21:15-17 city records (`rev-`) are seeded, and the
  Scripture-as-data resolvers are live: `config.ts` declares the district
  (campus) and `compressed-city` scale modes, `campusModel` consumes EZA, and
  `cityModel.CITY_HALF` derives from `rev-city-side`. `rev-city-wall` is
  deliberately NOT consumed — the wall keeps its art height and asserts
  nothing. Governing docs: ADR 0017, ADR 0018, RENDERING-DECISIONS #11/#12.
- **Logged debts:** interior plaza/wall dressing is thin at walking range
  (CITY-QUALITY-BAR pillar A); dwellings and temple still lack collision and
  floors; lake-foam white shards; cloud-edge speckle; Phase 7 perf.

## Verifying the 3D world

- **No GPU in cloud/headless** — use the CPU probes. From `apps/world-engine/`:
  `npm install` (fresh container), `npx tsc --noEmit`, `npx vite build`, then
  `npx tsx tools/probe-<name>.ts` for: population, entitypick, cityfloors,
  walkfling, wallcollide, visualkey, ascent, stages (plus navigation, arrival,
  resize as needed). Live probes need a dev server
  (`npx vite --port 5173 --strictPort`): visualkey-live, entityhud-live,
  campus-live, stages-live, navigation, arrival, bootui, bootrite, ambience,
  gamepad-live.
- **Probe gotchas:** `probe-bootui`'s pass signal is `[probe] done` — it has no
  checker. `probe-bootrite` is pacing-sensitive and can throw one spurious FAIL
  when run back-to-back with other live probes; re-run it alone before treating
  a failure as real. Hand-built tooling URLs need `&rite=0` (`laasUrl` adds it)
  or the boot-rite overlay swallows trusted clicks.
- **Pipeline:** `cd pipeline && uv run python -m pytest tests/ -q` (166 tests)
  and `uv run ruff check .`. Note `uv run pytest` fails with a "uv trampoline"
  error — always go through `python -m`.
- **On real hardware** (visual judgment): `npx tsx tools/shoot.ts --scene
  newjerusalem --cam "x,y,z,yaw,pitch,fov" --out shots/wip/name.png --w 1280
  --h 800 --settle 12`, then look at the PNG. Unknown flags pass through as URL
  params (e.g. `--key 1`). A/B motion comparisons must happen in ONE boot —
  auto-exposure drift ruins cross-boot diffs.
- **Re-vendor after an engine change** (from repo root):
  `rm -rf apps/web/public/laas && cp -r apps/world-engine/dist
  apps/web/public/laas && git add -f apps/web/public/laas` (tracked but
  gitignored — the `-f` is required).
- **After `far-country export`:** copy `data/exports/{canonical.json,
  manifest.json,entities/*}` into `apps/web/public/data/` and `git add -f`.
  Never commit `embeddings.json`, `data/canonical.sqlite`, or `data/exports/`.
- **After `far-country measure export`:** that is a SEPARATE command and it
  writes `measurements.json` plus the generated engine modules. The browse
  UI reads `measurements.json` for tier filtering and search, so copy it into
  `apps/web/public/data/` too (`git add -f`). A missing file degrades to
  descriptor-only tiers rather than erroring, so staleness is silent — re-copy
  whenever measurements are reseeded.
- Any three.js upgrade: re-verify every patch in `src/render/ThreePatches.ts`
  against the new sources first (`docs/THREE-NOTES.md`).
- **Last full green battery (2026-07-24, main `8f9b936`):** CPU probes
  population, entitypick, cityfloors, walkfling, wallcollide, visualkey,
  ascent, stages — ALL PASS; `tsc --noEmit` clean; `vite build` clean;
  pipeline 166 passed; ruff clean.

## World facts (LAAS engine)

Camera yaw 0 = -Z (north). Walk-mode spawn ~ `(350, ~484, 4150)`. City walls at
±2000 world (`CITY_HALF` 100 local × `NJ_SCALE` 20 — `NJ_SCALE` now lives in
`config.ts`, re-exported by `rimModel`; never hardcode either). Gates in
Ezekiel 48:30-34 order with real gaps: `GATE_WIDTH` 8 local, `GATE_OFFSETS
[-50, 0, 50]`. Temple at world `(0, -5600)`. Priests' band z -5021..-6029,
x ±5979, flanking a meridian lane at ±21; Levites' band z -6355..-10145. Crown
top `CITY_SUMMIT_Y` 156 local (standing eye 3611.30 live). Useful cameras:
campus + reading key `"1200,1000,-4200,0,-0.3,55"` with `--key 1`; crowd
close-up at `[500, 489, 1858]`, yaw 0, pitch -0.08. Take live floor heights
from `window.__laas.groundProbe`, never from sim constants. Benign console
warning to ignore: `Vertex attribute "normal" not found`.

## Secrets (not in git — set locally in `.env`)

Several features need API keys the repo never stores: **ESV** (measurement
fetch), **OpenAI** (embeddings — ADR 0007), **Anthropic** (extraction
pipeline), **ElevenLabs** (future audio layer — never expose client-side, no
`VITE_` prefix; generate offline and vendor the output). Grep the code for the
exact variable names; never commit `.env`.
