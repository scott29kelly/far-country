# Handoff — Far Country (2026-07-13)

A snapshot of live state for whoever picks this up next (handover from Claude
Code to a Codex / GPT agent). Durable project rules live in `CLAUDE.md` and
`AGENTS.md`; the engine's detailed status lives in `apps/world-engine/STATUS.md`.
This file is a point-in-time snapshot — trust the code and `STATUS.md` over it
where they disagree.

## Where the code is

- **`origin/main` (`64509a1`)** is current and production (Vercel deploys on
  push). It includes the merged arrival **"Descent" boot rite (PR #25)** and
  wall/gate collision with notched foundation courses (**PR #26**).
- Two coexisting 3D implementations per **ADR 0013**: the retired legacy React
  Three Fiber scene (`apps/web/src/lib/world/`, reachable only via its old
  route) and the vendored **LAAS WebGPU engine at `/world-preview`**
  (`apps/world-engine/`), which is the front door.

## Open PRs

- **#28 (draft) — direction-2 arrival boot stills**
  (`claude/far-country-boot-stills-direction2`). Competing, unmerged direction;
  conflict-dirty against `main` by design. Do not merge as-is.
- **#23 (draft)** — Cursor Cloud dev-environment notes (docs only). Currently
  conflict-dirty with its pipeline check failing; unrelated to Phase 3 runtime.

## Recently merged

- **#26 — wall/gate collision** (`64509a1`, merged 2026-07-13). Hardware-
  verified on Windows/Intel Xe-LPG: the walker stops at the wall/foundation
  face, passes through the west-centre gate to the inner plinth, and slides
  along the wall on oblique input. The faceted foundation course visibly
  terminates on both sides of the gate threshold. Post-merge CI and Vercel
  production deployment are green.

## Decision waiting on you: the arrival / boot experience

There are **two competing takes** on the same boot/arrival surface:

- **Direction 1 — merged (PR #25):** the "Descent" boot rite. Elaborate
  `src/core/BootUI.ts`, procedural audio in `src/audio/Ambience.ts`,
  `src/core/Easing.ts`. This is what ships today on `main`.
- **Direction 2 — preserved, unmerged:** branch
  **`claude/far-country-boot-stills-direction2`** (commit `04cb9fc`, pushed).
  A stills-based boot: full-bleed **real engine captures** shown during
  world-gen (ADR 0019), a simplified BootUI, and a separate
  `src/nj/ArrivalAudio.ts`. Built on the pre-#25 tree and never committed until
  this handover.

Pick one (or reconcile) before doing further boot/arrival work. Direction 2's
branch will show conflicts against `main` on `BootUI.ts` / `index.html` /
`NewJerusalemScene.ts` / `launch.ts` — that is expected and confirms the
overlap. **Do not merge Direction 2 as-is**; because it is based on pre-#25 it
would revert the Descent rite.

## Phase 3 tracks

- **Track A — measurement seeding (Ezek 45/48).** BLOCKED without `ESV_API_KEY`
  in the repo-root `.env` (Scott's machine only). Note: Ezek 45:1 breadth is
  **10,000 (MT) vs 20,000 (LXX)** — must be tiered `debated` and surfaced to
  the user, never silently resolved. Pattern to follow:
  `pipeline/src/far_country/measure/temple.py` (ADR 0017/0018 —
  `LONG_CUBIT_M = 0.525`).
- **Track B — wall/gate collision.** DONE and merged in PR #26; real-hardware
  walk, slide, gate-passage, foundation-notch, live ground-probe, CI, and
  production deployment checks all passed on 2026-07-13.
- **Track C — descriptor/citation HUD + click-picking.** Not started. This is
  the core Phase-3 promise: geometry that footnotes itself. Its data source
  MUST be the **existing canonical dataset exports** the browse UI (`apps/web`)
  already consumes — grep `apps/web/src` for the descriptor/citation fetch and
  reuse that shape; do NOT invent descriptors. Guardrails: RENDERING-DECISIONS
  **#7** (cite the measured structure, e.g. the temple) and **#8** (zone-level
  citations only — nothing anchored to an individual house / hedge / well).

## Verifying the 3D world

- **No GPU in cloud/headless** — use the CPU probes. From `apps/world-engine/`:
  `npm install` (fresh container), `npx tsc --noEmit`, `npx vite build`,
  `npx tsx tools/probe-<name>.ts`. Some probes need a dev server running first:
  `npx vite --port 5173 --strictPort` (e.g. `probe-bootrite`, `probe-ambience`).
- **On real hardware** (visual/feel judgment): capture a still with
  `npx tsx tools/shoot.ts --scene newjerusalem --cam "x,y,z,yaw,pitch,fov"
  --out shots/wip/name.png --w 1280 --h 800`, then look at the PNG. Interactive
  input via Playwright `page.mouse` (see `tools/probe-mousesteer.ts`,
  `tools/probe-walkfling-live.ts`). Launch tooling passes `rite=0` by default —
  that is the tooling contract; do not remove it.
- **Re-vendor after an engine change** (from repo root):
  `rm -rf apps/web/public/laas && cp -r apps/world-engine/dist
  apps/web/public/laas && git add -f apps/web/public/laas`.

## World facts (LAAS engine)

Camera yaw 0 = -Z (north). Walk-mode spawn ≈ `(350, ~484, 4150)`. City walls at
±2000 world (`CITY_HALF` 100 local × `NJ_SCALE` 20). Gates in Ezekiel 48:30-34
order with real gaps: `GATE_WIDTH` 8 local, `GATE_OFFSETS [-50, 0, 50]`. Temple
at local `(0, -5600)`. Crown top `CITY_SUMMIT_Y` 156 local. Take live floor
heights from `window.__laas.groundProbe`, never from sim constants. Benign
console warning to ignore: `Vertex attribute "normal" not found`.

## Secrets (not in git — set locally in `.env`)

Several features need API keys the repo never stores: **ESV** (Track A
measurement fetch), **OpenAI** (embeddings — ADR 0007), **Anthropic**
(extraction pipeline), **ElevenLabs** (future audio layer — never expose
client-side, no `VITE_` prefix; generate offline and vendor the output). Grep
the code for the exact variable names; never commit `.env`.
