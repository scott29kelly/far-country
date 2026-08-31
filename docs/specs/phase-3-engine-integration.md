# Spec — Phase 3, Stage 3: New Jerusalem on the vendored engine

**Status:** Draft (engine fork in progress; see ADR 0013)
**Phase:** 3
**Depends on:** [`../adr/0013-fork-laas-engine-for-3d-world.md`](../adr/0013-fork-laas-engine-for-3d-world.md)

This is the concrete engineering plan for the heart of Phase 3: rendering the
New Jerusalem on the vendored WebGPU engine (`apps/world-engine/`). Stages 1–2
(vendoring, hosting at `/world-preview`) are done. Stage 3 is where the visual
quality and the biblical content meet.

The plan rests on two findings, one per side of the integration.

---

## 1. What the engine gives us (and what we replace)

The engine separates **terrain + lighting + rendering** (reusable, content-
agnostic) from **vegetation placement** (the forest — which we replace).

**Keep, unchanged:**

- `world/Heightfield` — terrain generation; `hf.heightAtCpu(x, z)` is the
  ground-height contract for placing anything.
- `world/TerrainTiles` — CDLOD terrain rendering, splat shading, micro-displacement.
- `sky/SunSky` — physical sky + sun + time-of-day.
- `render/ShadowSetup` (`setupSunShadows`) — 4-cascade CSM + PCSS.
- `render/PostStack` — GTAO, TRAA, bloom, auto-exposure, filmic grade, aerial
  perspective. Attached as `engine.post`; runs automatically.
- `gpu/passes/ProbeGI` (optional) — irradiance probes (pass `gi` **without**
  `canopyTex`; the city has no canopy).
- `core/FlyCamera`, `engine.onUpdate()`, `engine.post`.

**Replace (do NOT call):** `Scatter`, `Forests`, `GroundRing`, `VegLibrary`,
canopy map/shell, understory/dressing. These place the forest.

**The seam.** The engine has a scene registry:

```ts
// src/debug/Scenes.ts
export interface WorldContext { engine; params; seed; hooks; progress }
export type SceneBuilder = (ctx: WorldContext) => Promise<void>;
export function registerScene(name: string, builder: SceneBuilder): void;
```

Any `Mesh`/`InstancedMesh` added to `engine.scene` with `castShadow` /
`receiveShadow` set automatically participates in shadows, GI, GTAO, and post —
**no core-engine changes required.** Custom shading uses `MeshStandardNodeMaterial`
/ `MeshPhysicalNodeMaterial` with TSL node graphs (`three/tsl`).

**Integration is therefore additive:**

1. **New:** `src/nj/NewJerusalemScene.ts` (a `SceneBuilder`). (We keep our
   content in its own `src/nj/` dir rather than `debug/` to separate it from
   vendored code and ease upstream diffs.)
2. **Modify:** `src/main.ts` (~line 65) — `registerScene('newjerusalem', …)`.
3. **Boot:** `?scene=newjerusalem`. Wire `/world-preview` to pass that param.

Everything else in the engine stays read-only.

---

## 2. What we already have to render (the grounded content model)

The New Jerusalem geometry is **already encoded as citation-grounded data** in
the R3F world and the canonical dataset. Stage 3 ports this model onto the new
renderer; it does not re-derive the city.

- `apps/web/src/lib/world/data/world-geometry.ts` — the Willis step-pyramid:
  `PYRAMID` (baseHalf 68 m, summitHalf 18 m, 12 steps × 7 m → summit y = 84 m),
  `halfAtLevel`/`topYAtLevel`/`groundHeightAt`, the river cascade decomposition,
  tree-of-life positions.
- `apps/web/src/lib/world/data/points-of-interest.ts` — `CITY_HALF` (100 m),
  walls (`WALL_HEIGHT` 30 m), the **twelve gates in Ezekiel 48 tribe order**, the
  **twelve foundation gems in Rev 21:19–20 order** (stylised hues), throne/glory/
  river/tree/street POIs, each bound to an entity slug.
- The canonical export schema (`apps/web/src/lib/data/types.ts`):
  `Entity` / `Descriptor` (`tier`: clear|fuzzy|debated|symbolic, `symbolic_referent`)
  / `Citation`. This drives the inspect HUD and the "every claim cited" rule.

**Action:** lift the dimensional constants and the gate/foundation/POI tables
into a small shared, framework-neutral module the engine scene can import (they
are plain data — no React). This keeps one source of truth across the R3F world
(until retired) and the new engine.

---

## 3. Mapping the model onto the engine

Each element below is built as plain three.js geometry placed with
`hf.heightAtCpu(x, z)`, shaded with a TSL node material, `castShadow` +
`receiveShadow` on. **Content is doctrinally specific — not generic stone.**

| Element | Source | Geometry | Material intent |
| --- | --- | --- | --- |
| **Crystal step-pyramid** (the city mass / "great high mountain", Rev 21:10) | `PYRAMID`, `TERRACES`, `halfAtLevel` | nested terrace boxes → step silhouette | translucent jasper/crystal (transmission), edges catching rim light |
| **Jasper wall** (Rev 21:18) | `CITY_HALF`, `WALL_HEIGHT` | four wall runs with gate gaps | clear/jasper, luminous |
| **Twelve gates of pearl** (Rev 21:21) | `GATES` (Ezekiel order) | one pearl arch per gate | pearlescent; label carries tribe + compass |
| **Twelve foundations** (Rev 21:19–20) | `FOUNDATION_BANDS`, `FOUNDATION_GEMS` | jewelled course at wall base | per-gem stylised hue (ADR 0009 rule 2 — not photoreal mineralogy) |
| **Street of gold** (Rev 21:21) | base plaza ring | ground plane / inlay | gold, "transparent as glass" sheen |
| **River of the Water of Life** (Rev 22:1) | `cascadeSegments()` | channel reaches + fall ribbons from summit to south gate | reuse engine `WaterMaterial`/caustics if feasible |
| **Tree(s) of Life** (Rev 22:2) | `TREE_POSITIONS` | two trees flanking the river | authored tree geometry (NOT the forest scatter) |
| **Throne of God** (Rev 4; 21:5) | summit POI | **abstract luminous form — NO figure** | emissive glory core + bloom (see §4) |
| **Glory of God as light** (Rev 21:23; 22:5) | glory POI | the scene's key light; no sun-as-disc | drives lighting; "no night there" |
| **The redeemed multitude** (Rev 7:9) | population policy | reverent simplified figures, white robes, raised palm | **no facial/identity detail** (ADR 0011) |

---

## 4. Non-negotiable policy constraints carried into the engine

These ADRs govern the rendered content unchanged; the engine swap does not relax
them:

- **Aniconic policy (ADR 0010).** The divine Persons are **not depicted**. The
  throne is rendered as abstract light (an emissive glory core feeding bloom and
  acting as the scene's key light), never a figure. The engine's `SunSky` sun is
  the lighting *mechanism*, but theologically the light source is the glory
  (Rev 21:23) — render the sun disc hidden/neutralised so the glory reads as the
  light, consistent with "no night" and "no sun needed."
- **Symbolic vs. literal rendering (ADR 0009).** Symbolic descriptors
  (`tier: symbolic`, e.g. streets of gold) are rendered as the surface image
  **with an explicit indicator** (hover note / sidebar referent), not asserted as
  literal metallurgy. Literal elements (bodily resurrection, the city's reality)
  are not flattened.
- **Population rendering (ADR 0011).** The multitude and hosts may be shown as
  creatures, reverently, without invented iconography. This is an upgrade target
  over the current cone+sphere figures — better silhouette/robes, still no
  identity detail.
- **Scale (ADR 0009 rule 6).** True scale (12,000 stadia cube, Rev 21:16) stays
  deferred; we keep the ~200 m placeholder initially. The engine's ~4 km world
  gives ample room to revisit scale later without re-architecting.

---

## 5. The new-earth landscape (decided: idealized paradisal terrain)

The engine's terrain is an eroded forest landscape. Revelation sites the city on
a **new earth** (Rev 21:1-2). **Decision (2026-06):** keep the engine's terrain
technology but art-direct it toward an **idealized, paradisal** look rather than
wild wilderness, and keep the surrounding landscape as illustrative context (not
a cited descriptor; disclosed as such in the HUD).

Paradisal art-direction is inherently *visual* iteration and belongs in M3, done
against a running build (the agent container has no GPU). The levers:

- **Time of day / grade** — a warm, luminous key (the single biggest lever). The
  scene honours `?T=` (0-24), so candidates can be A/B'd live and the winner
  baked as the scene default. Default is currently the engine's `T=11`.
- **Relief** — gentler amplitude than the wild default. Lives inside the
  heightfield synthesis (not a URL param); a tuning knob is a small engine edit,
  deferred to M3 so it can be judged visually.
- **Water** — calmer surface, fuller rivers/lakes.
- **Lushness** — optional reintroduction of *gardens/groundcover* (not the wild
  forest scatter) around the city, if it reads as paradise rather than wilderness.

Rejected: discarding the terrain for an abstract plane (throws away the exact
quality we forked the engine for).

---

## 6. Data flow: descriptors → inspect HUD

The engine has its own debug HUD; our descriptor/citation inspection is a
separate concern. Plan:

- Bundle the canonical export (entities + descriptors + citations) with the
  engine build, or fetch it at runtime from the same JSON the browse UI uses.
- Reuse the POI model (entity slug → world position + radius). On camera
  proximity or click (engine raycast against tagged meshes), surface that
  entity's descriptors **with citations and tier badges** — same grounding
  contract as the R3F world's `DescriptorHud`/`ClickInspector`.
- Refuse-to-invent still holds: only entities present in the dataset get HUD
  content; landscape and structural filler are explicitly un-annotated.

---

## 7. Staged milestones

> **Status update, 2026-07-01** (see `apps/world-engine/STATUS.md` "New
> Jerusalem scene" section and `docs/roadmap.md` Phase 3 for the full
> inventory): M1 is done. M2 is **partial and diverged** — city massing,
> river cascade, and trees exist, but as a hand-tuned 5-tier box massing
> (`CityMassing.ts`) that does not consume this doc's "shared constants"
> (`cityModel.ts` was ported but is unimported dead code); walls, named
> gates, and jewelled foundations were never built. Content ahead of this
> spec's original scope has also landed (Holy Allotment plateau, crop
> fields, dwelling grid, standalone temple, citywide scale per ADR 0014) —
> reconcile against `docs/roadmap.md` Phase 4 sequencing before extending
> further. M3–M5 have not started.

- **M1 — Boot parity.** *(done)* `NewJerusalemScene` registered; terrain + SunSky +
  shadows + PostStack render with an empty pad. Confirms the reused stack works.
  *Verifiable via the engine's Playwright `tools/shoot.ts` screenshot harness.*
- **M2 — City massing.** *(partial, diverged — see status note above)* Pyramid
  terraces, walls, gates, foundations, throne
  glory core, river cascade, two trees — correct positions from the shared
  constants, placeholder materials. The silhouette reads as the New Jerusalem.
- **M3 — Material quality.** *(not started)* Crystal/jasper transmission, gold street, pearl
  gates, gem foundations, glory bloom; tune against the engine's lighting/post.
  This is the milestone that closes the visual-quality gap.
- **M4 — Population + symbolic markers.** *(not started)* Improved multitude (ADR 0011); symbolic
  indicators (ADR 0009); descriptor/citation inspect HUD (§6).
- **M5 — Retire R3F.** *(not started; `/world` already redirects to `/world-preview`
  at the route level, but the underlying code is not yet removed)* Once parity on
  the core elements, point `/world` at the
  engine and remove `apps/web/src/lib/world/` (per ADR 0013).

---

## 8. Verification

- **Build:** guarded by the `world-engine` CI job (typecheck + `vite build`).
- **Visual:** the engine's `tools/` Playwright harness boots headless WebGPU and
  captures deterministic screenshots (`?seed=N&freeze=1&cam=…`). Adopt it for
  per-milestone regression shots. **Runtime requires Chrome 113+ on a real GPU —
  not the headless agent container — so visual checks happen locally / in a
  GPU-capable runner.**

---

## 9. Open questions

- ~~§5 new-earth landscape: option (A) vs (B). **Decide before M2.**~~ **Resolved
  2026-07-01:** kept the engine's wild terrain unchanged (option "keep tech, no
  paradisal re-art-direction"). See `RENDERING-DECISIONS.md` Entry #5.
- River: reuse the engine `WaterMaterial`/caustics for the cascade, or author a
  simpler ribbon? (Prefer reuse if the cascade geometry cooperates.)
- Throne glory: how bright/large before it washes the frame via bloom — tune in M3.
- Scale: confirm the ~200 m placeholder reads well sited in a ~4 km world, or
  scale the city up. (Deferred per ADR 0009 rule 6, but the engine invites it.)
- HUD: bundle the dataset into the engine build vs. fetch at runtime (§6).

---

## 10. Backlog — quick-travel district streaming (added 2026-08-31)

Adopted from the Persepolis Reimagined research
([`../research/2026-08-30-persepolis-reimagined-getty.md`](../research/2026-08-30-persepolis-reimagined-getty.md)
§6, note 4; companion visitor-facing backlog in
[`phase-3-3d-world.md`](phase-3-3d-world.md)). Persepolis splits its city
into per-district scene files (0.5–10 MB geometry + 2.5–4.4 MB baked
lightmap), prefetches the next district while the visitor is still in the
current one, and hides each swap behind a short (~1–2 s) fog transition.

At our citywide scale (ADR 0014) the same shape fits `NavigationUI.ts`
quick-travel: when a destination is picked, prefetch or build that
district's heavy content (dressing, crowd assemblies, impostor atlases)
while masking the jump with a live glory-light/cloud transition rendered by
the engine — not a canned video. Their numbers are a budget reference: a
convincing scholarly city district reads at under 15 MB because lighting is
baked and parts are instanced and reused.

Unscheduled. Scope it when quick-travel hitching or memory pressure at full
city scale makes it worth the complexity.
