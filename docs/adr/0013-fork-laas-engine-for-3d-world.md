# ADR 0013 — Fork the LAAS engine as the Phase 3 3D foundation

- **Status:** Accepted
- **Date:** 2026-06-15
- **Supersedes:** the 3D-layer decision in [`0002-tech-stack.md`](0002-tech-stack.md) (React Three Fiber). The rest of ADR 0002 (Python pipeline, SQLite store, Next.js app shell, Anthropic Q&A) still stands.
- **Superseded by:** —

## Context

The Phase 3 explorable world was built on React Three Fiber + drei with a
cinematic post-processing stack (see `apps/web/src/lib/world/`). In practice
its visual quality is far below the bar set by a publicly available reference:
PROJECT LAAS (https://github.com/Braffolk/fable5-world-demo), a fully
procedural WebGPU world. The gap is not lighting or grading — it is that our
scene is hand-built primitives (e.g. the redeemed multitude is 760
cone-plus-sphere figures) while LAAS has real procedural terrain, ~190k
instanced trees, ~1M grass blades, PBR materials, and a WebGPU pipeline
(cascaded shadows + PCSS, GTAO, SSR, volumetric clouds, TAA).

The project owner's directive is explicit: get the world-model quality up to
the LAAS bar first, then design the biblical content on top of it. Rebuilding
those systems from scratch on R3F would be a large effort that still likely
falls short of the reference.

LAAS is **MIT-licensed**, depends only on `three@0.184.0` (the exact version
the web app already uses), is framework-agnostic TypeScript, and keeps its
WGSL shaders inline in `.ts` (no special bundler loader required). This makes
adopting the engine itself the most direct path to the target quality.

## Decision

Fork (vendor) the LAAS engine into the monorepo as the foundation for the
Phase 3 world, rather than continuing to build the 3D layer on React Three
Fiber.

- **Vendoring:** the engine lives at `apps/world-engine/`, copied from upstream
  commit `fd75fdb718996908aad3d22b59dfa297dc94298d`, with the upstream MIT
  `LICENSE` retained and provenance recorded in `apps/world-engine/VENDORED.md`.
  The heavy upstream `shots/` and `reference/` image dirs are excluded.
- **Integration strategy:** keep it as a **standalone sub-app** that builds with
  its own Vite config (it already parameterizes `base`), rather than dissolving
  it into Next's bundler. The Next app hosts the engine's build output at
  `/world`. This preserves the engine's exact behavior and look and avoids
  bundler-integration risk.
- **Content path:** progressively replace the procedural forest content
  (`src/world`, `src/vegetation`) with New Jerusalem geometry driven by the
  canonical dataset. This is where "quality first, then biblical design"
  re-enters. The aniconic policy (ADR 0010), symbolic-vs-literal rendering
  (ADR 0009), and population-rendering policy (ADR 0011) continue to govern
  all content rendered in the new engine, unchanged.
- **Verification:** adopt the engine's Playwright screenshot/regression harness
  (`apps/world-engine/tools/`) as the way an agent iterates on visuals against
  pixel feedback.

The previous R3F world (`apps/web/src/lib/world/`) is retained for now and
retired once the new engine reaches parity on the New Jerusalem core elements.

## Consequences

- **Hard browser requirement.** LAAS is WebGPU-only with no fallback and gates
  non-Chromium / mobile / missing-WebGPU clients with a notice. This is a real
  reach constraint for a public surface and must be surfaced in the UI; the
  browse UI and grounded Q&A (Phase 2) remain on the broadly compatible Next
  stack and are unaffected.
- **Two render stacks during transition.** Until parity, the repo carries both
  the R3F world and the vendored engine. Accepted as temporary.
- **Quality ceiling raised.** We inherit erosion terrain, instanced vegetation,
  and a modern WebGPU pipeline rather than rebuilding them.
- **Upstream divergence.** As we modify the engine it diverges from upstream;
  the pinned commit in `VENDORED.md` is the merge base if we ever pull updates.
- **Bring-up is local.** WebGPU does not run in the headless CI/agent container,
  so first render and visual verification happen on a developer's Chrome 113+
  machine, not in the cloud session.

## References

- `apps/world-engine/VENDORED.md` — provenance and MIT attribution
- [`0002-tech-stack.md`](0002-tech-stack.md) — the decision this partially supersedes
- [`0009-symbolic-vs-literal-rendering.md`](0009-symbolic-vs-literal-rendering.md), [`0010-aniconic-policy.md`](0010-aniconic-policy.md), [`0011-population-rendering-policy.md`](0011-population-rendering-policy.md) — content policies that still govern the new engine
- [`../specs/phase-3-3d-world.md`](../specs/phase-3-3d-world.md) — Phase 3 spec
