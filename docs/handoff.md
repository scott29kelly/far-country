# Handoff — Far Country (2026-07-18)

A snapshot of live state for whoever picks this up next. Durable project rules
live in `CLAUDE.md` and `AGENTS.md`; the engine's detailed status lives in
`apps/world-engine/STATUS.md` (its top carries the rehydration protocol — read
it first for any 3D work). This file is a point-in-time snapshot — trust the
code and `STATUS.md` over it where they disagree.

## Where the code is

- **`origin/main` (`77704bc`)** is current and production (Vercel deploys on
  push). It includes PR #30 (2026-07-18): the viewport-resize "Destroyed
  texture" fix (`src/render/ThreePatches.ts` + `tools/probe-resize.ts`), the
  citation HUD + click-picking (M3.4), walk-mode proximity auto-cards,
  walkable city floors, and the Rev 21:12 gate inscriptions.
- **Branch `claude/far-country-population`** (this session, local-first):
  the **M3.6 population first pass** — the great multitude (Rev 7:9,
  `great-multitude`) as ~12,700 instanced white-robed figures in forty
  worship assemblies on the plaza ring and terrace pavements, and the
  angelic hosts (Rev 5:11, `myriads-of-angels`) as twelve clusters of
  light-pillars ringing the summit; zone-level picks + auto-cards for both;
  `tools/probe-population.ts` (13 checks). Plus a QoL flip: the bare dev URL
  (`localhost:5173`) now boots `?scene=newjerusalem` (the product scene);
  the wild-terrain reference scene moved behind an explicit `?scene=world`.
- **Branch `claude/eager-margulis-091662`** (separate worktree session):
  Xbox/Switch **gamepad navigation** — `src/core/GamepadInput.ts` polled from
  `FlyCamera.update()`, probe-verified (CPU 22/22, live 6/6). UNMERGED and
  parked: Scott's feel pass with the physical pad is blocked on a controller
  part arriving ~late July 2026. Keep the branch alive until he tests it.
- Two coexisting 3D implementations per **ADR 0013**: the retired legacy R3F
  scene (`apps/web/src/lib/world/`) and the vendored **LAAS WebGPU engine at
  `/world-preview`** (`apps/world-engine/`), the front door.

## Open PRs

- **#29 — docs-only STATUS/handoff/roadmap updates** for PR #26's acceptance
  (`codex/pr26-hardware-handoff`). Written pre-#30; its target files have
  since been rewritten by #30 and this session. Superseded — recommend close.
- **#28 (draft, do-not-merge-as-is)** — boot-stills "Direction 2". Waiting on
  Scott's direction-1-vs-2 arrival verdict (see below).
- **#23 (draft)** — Cursor Cloud dev-environment notes (docs only).

## Decisions waiting on Scott

1. **Arrival/boot direction.** Direction 1 (the merged "Descent" rite, PR #25)
   ships today; Direction 2 (stills-based boot, PR #28) is preserved unmerged
   and is based on the pre-#25 tree — merging it as-is would revert the rite.
2. **Subjective passes owed:** walk feel (now with floors, inscriptions,
   auto-cards, and crowds), campus visuals, M1 Max perf verdict, rite
   pacing/audio levels, and the gamepad feel pass (blocked on hardware).

## Phase 3 state (detail: docs/roadmap.md Phase 3 + STATUS.md)

- M3.1 scaffolding, M3.3 mountain/river/trees/navigation, M3.4 citation HUD +
  picking + proximity cards: built and probe-verified on `/world-preview`.
- M3.5 symbolic indicators: tier badges + symbolic referents on cards are
  live; the in-scene literal-vs-symbolic visual key is still open.
- M3.6 population: first pass built (population branch above).
- **Track A — measurement seeding (Ezek 45/48)** stays BLOCKED without
  `ESV_API_KEY` in the repo-root `.env` (Scott's machine only). Ezek 45:1
  breadth is 10,000 (MT) vs 20,000 (LXX) — must be tiered `debated`, never
  silently resolved. The dwelling campus stays UNPICKABLE until Track A seeds
  the Ezek 45:4-5 zone entities (RENDERING-DECISIONS #8; no inventing).
- Other logged debts: stairs/ramps between city floors, interior plaza
  dressing at walking range, dwellings/temple collision+floors, figure idle
  motion, lake-foam white shards, Phase 7 perf.

## Verifying the 3D world

- **No GPU in cloud/headless** — use the CPU probes. From `apps/world-engine/`:
  `npm install` (fresh container), `npx tsc --noEmit`, `npx vite build`, then
  `npx tsx tools/probe-<name>.ts` for: population, entitypick, cityfloors,
  walkfling, wallcollide, navigation, arrival, resize. Live probes need a dev
  server (`npx vite --port 5173 --strictPort`): entityhud-live,
  walkfling-live (`--only a,b` then `c,d`), bootrite, ambience, gamepad-live.
- **On real hardware** (visual judgment): `npx tsx tools/shoot.ts --scene
  newjerusalem --cam "x,y,z,yaw,pitch,fov" --out shots/wip/name.png --w 1280
  --h 800 --settle 12`, then look at the PNG. Launch tooling passes `rite=0`
  by default — that is the tooling contract; do not remove it.
- **Re-vendor after an engine change** (from repo root):
  `rm -rf apps/web/public/laas && cp -r apps/world-engine/dist
  apps/web/public/laas && git add -f apps/web/public/laas` (tracked but
  gitignored — the `-f` is required).
- Any three.js upgrade: re-verify every patch in `src/render/ThreePatches.ts`
  against the new sources first (`docs/THREE-NOTES.md`).

## World facts (LAAS engine)

Camera yaw 0 = -Z (north). Walk-mode spawn ≈ `(350, ~484, 4150)`. City walls at
±2000 world (`CITY_HALF` 100 local × `NJ_SCALE` 20). Gates in Ezekiel 48:30-34
order with real gaps: `GATE_WIDTH` 8 local, `GATE_OFFSETS [-50, 0, 50]`. Temple
at world `(0, -5600)`. Crown top `CITY_SUMMIT_Y` 156 local (standing eye
3611.30 live). Take live floor heights from `window.__laas.groundProbe`, never
from sim constants. Benign console warning to ignore: `Vertex attribute
"normal" not found`.

## Secrets (not in git — set locally in `.env`)

Several features need API keys the repo never stores: **ESV** (Track A
measurement fetch), **OpenAI** (embeddings — ADR 0007), **Anthropic**
(extraction pipeline), **ElevenLabs** (future audio layer — never expose
client-side, no `VITE_` prefix; generate offline and vendor the output). Grep
the code for the exact variable names; never commit `.env`.
