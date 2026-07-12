# AGENTS.md — Far Country

You are an AI coding agent working on **Far Country**: a citation-grounded,
biblically accurate world-model simulation of heaven (an explorable 3D world
plus grounded AI Q&A, built on a dataset extracted from the ESV Bible and
Janet Willis's *What on Earth Is Heaven Like?*).

This file is the entry point for any agent (Codex, Claude, or otherwise).
Read the linked documents before you act — this repo is heavily documented on
purpose, and most questions are already answered in `docs/`.

## Read these first, in order

1. **`CLAUDE.md`** — the primary orientation. Its rules are **binding**, not
   advisory. Read it in full first.
2. **`docs/handoff.md`** — current live state: open PRs, in-flight branches,
   the decision waiting on you, and how to verify the 3D world.
3. **`apps/world-engine/STATUS.md`** — the 3D engine's living source of truth
   (what is and isn't built). Keep it updated after each meaningful step.
4. **`docs/roadmap.md`** — phase ordering and milestones (currently Phase 3).
5. **`RENDERING-DECISIONS.md`** and **`apps/world-engine/docs/CITY-QUALITY-BAR.md`**
   — the visual and quality guardrails for the 3D world.
6. **`docs/adr/`** — why each technical choice was made (append-only).

## Non-negotiables (full detail in `CLAUDE.md` and `docs/`)

1. **Every claim about heaven carries a citation** — Scripture (book/chapter/
   verse) and, where applicable, Willis (chapter/page). No descriptor enters
   the dataset without one. Never invent or paraphrase descriptors.
2. **Conservative Protestant, literal-where-possible hermeneutic**
   (`docs/hermeneutics.md`). Flag symbolism explicitly by genre; never flatten
   symbol into literal or literal into symbol.
3. **Fuzzy / debated / symbolic material is preserved, not dropped** — with a
   confidence tier (`clear` / `fuzzy` / `debated` / `symbolic`), routed to
   review (`docs/data-model.md`).
4. **ESV is the canonical translation.** Personal-study licensing posture:
   never store or redistribute ESV text or Willis excerpts in bulk
   (ADR 0006) — fetch to a scratch dir only, never commit it.
5. **ADRs are append-only** — supersede an Accepted ADR with a new one; never
   edit it in place. **No emoji in committed files.**

When a hermeneutic or doctrinal question is genuinely ambiguous, surface it to
the user — do not resolve theological disputes silently.

## Engine discipline (`apps/world-engine/`, the `/world-preview` WebGPU world)

- TypeScript strict: `npx tsc --noEmit` must stay clean. Follow the local
  `as unknown as NF/NU/NV3` TSL cast pattern — do not introduce bare `any`.
- **Shared-table discipline:** geometry and any CPU probe/collision must read
  ONE exported table/function from the owning module (e.g. `src/nj/cityModel.ts`)
  — never hand-mirror constants into a second copy.
- **After any engine change:** `npx vite build`, then re-vendor the bundle into
  `apps/web/public/laas` (it is gitignored → `git add -f`). Exact commands in
  `docs/handoff.md`.
- No usable GPU in cloud/headless contexts: verify with the CPU probes in
  `apps/world-engine/tools/probe-*.ts`; on real hardware use `tools/shoot.ts`.
- Do not break the `window.__laas` progress/ready contract or the boot
  fast-hide, and keep the bloom/emissive contract (see RENDERING-DECISIONS.md).

## Never commit

`/public/images/`, `.env`, `data/canonical.sqlite`, `data/exports/`, `shots/`.
(`apps/web/public/laas` IS tracked but gitignored → always `git add -f`.)
