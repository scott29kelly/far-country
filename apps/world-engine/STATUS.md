# PROJECT LAAS — STATUS (source of truth)

> **Rehydration protocol** (for an agent resuming with no context): read this file fully, then
> `PROJECT_LAAS_v2.md` (the spec — binding), then `docs/THREE-NOTES.md` (API gotchas for the
> pinned three.js), then the **Current focus** section below. Reference images: `reference/`.
> Never re-plan from scratch; continue from "Next actions". Update this file after every
> meaningful step. Commit per milestone with descriptive messages.
>
> **If your task concerns the New Jerusalem / biblical content** (`?scene=newjerusalem`,
> `src/nj/`) rather than the terrain engine itself, the phase checklist below does not
> track it — go to the **"New Jerusalem scene (`src/nj/`) — content track status"**
> section instead, and also read `docs/roadmap.md` Phase 3 and `RENDERING-DECISIONS.md`.

## Mission (1 paragraph)

Fully procedural 4×4 km open world in the browser. WebGPU only (three.js WebGPURenderer + TSL +
raw WGSL compute), TypeScript strict, zero `any`, zero external assets, deterministic by
`?seed=N`. Visual bar: the four UE5-class reference images in `reference/` (noon forest ravine
w/ cobbled streambed; gully close-up; karst tower forest in haze; golden-hour serrated alpine
vista w/ snow + cloud sea below summits — "Witcher" frame). 8 gated phases; verification by
Playwright screenshots compared against references; `DELTA.md` loop each phase. Must ALSO be
smooth + explorable interactively by the user (fly camera, ToD control, bookmarks) — user
feedback comes in chat; the two-frame test is the agent-side acceptance only.

## Hard rules digest (full text = spec §)

- No black/gray shadows (Pillar B); no bare terrain within 10 m (Pillar A/§9); no cloned trees;
  no smooth silhouettes on hero rock/tree; no fog-as-cover; no `MeshBasicMaterial`; no CPU
  per-instance updates; no one-file architecture; never ask user to lower the bar.
- Floors (§2): ≥5M tris forest hero / ≥3M vista post-culling; 4096² heightfield sim; erosion
  ≥500 iters @ ≥2048²; ≥6 tree species w/ per-instance uniqueness; hero tree ≥100k tris; hero
  rock ≥200k tris; grass ≥800k blades; debris ≥80k; particles ≥100k; visible range ≥4 km;
  ≥5 biomes incl. alpine snow; probes ≥24×24×6 per chunk; CSM 4×≥2048² + PCSS + contact
  shadows; raymarched 2-layer clouds + cloud shadows; Hillaire atmosphere; 60 fps @ 1440p
  target hardware class.
- Infeasible item → nearest feasible alternative + entry in `DEVIATIONS.md`. A closed phase has
  zero TODOs in its code.

## Verified environment facts

- macOS 26.4 (Darwin 25.4.0), Apple **M1 Max 32-core GPU**, Metal 4, 3456×2234 display.
- Node v22.12.0, npm 10.9.0. Git repo initialized on `main` (no remote).
- three.js pinned: **0.184.0** (latest on npm as of 2026-06-10). VERIFY APIs against
  `node_modules/three/` source before use — do not trust memory for TSL surface.
- **Playwright WebGPU recipe (SOLVED)**: `chromium.launch({ headless: true, channel: 'chromium' })`
  → apple/metal-3 adapter. Two traps: (1) WebGPU only exists on secure contexts — probe on
  http://localhost:5173, never about:blank; (2) default Playwright headless = GPU-less
  "headless shell"; `channel:'chromium'` selects full Chromium new-headless. Cached in
  `.cache/webgpu-flags.json` by tools/launch.ts.
- Dev server: `npm run dev` (background, port 5173 strict). Shots:
  `npx tsx tools/shoot.ts --scene X --cam "..." --out shots/x.png [--hud 1] [--stats f.json]`.
  Compare: `npx tsx tools/compare.ts --a ours.png --b reference/sceneN.png --out cmp.png`.
  Pixel sampling (shadow-color test): `--sample img.png --px "x,y;x,y"`.
- Sanity scene measured (1080p, M1 Max): 3.1M tris @ 117 fps, render 7.2 ms — lots of headroom.

## Phase checklist

- [x] **Phase 0** — DONE 2026-06-10. Scaffold, WebGPU init + fail-loud diagnostics, HUD, fly
      camera, params, Playwright shot harness (headless WebGPU working), compare tool. Gate
      passed: `shots/phase-0/cmp_sanity_vs_scene1.png`. Proven: compute→storage→instanced draw,
      compute→StorageTexture→sampling, TSL vertex displacement, CPU procedural geometry,
      GPU timestamps, deterministic seeding.
- [x] **Phase 1** — DONE 2026-06-11. 4096² synth (macro layout: NE massif/valley/karst/lake w/
      outlet), pipe erosion 640 it @2048 (hardness-aware thermal), multigrid lake fill, particle
      flow accumulation → carved rivers, moisture, biome+snow classify (coarse-slope hold +
      couloirs + ledges + dither), CDLOD instanced tiles + far shell w/ analytic normals +
      far-detail normal synthesis, PBR splat material (strata/iron bands/lichen/macro variation/
      wet darkening/snow), erosion split view, ground-clamped camera (`x/z/alt/yaw`), CPU height
      readback. Gates passed; see docs/DELTA.md Phase 1. Artifacts: shots/phase-1/.
- [x] **Phase 2** — DONE 2026-06-11. Hillaire LUT atmosphere + aerial perspective (post-pass
      camera-uniform bug fixed — explicit uCamPos/uProjInv/uCamWorld); GPU auto-exposure
      (key 0.125); hemisphere ambient (IBL env path dead → Phase 3 probes); CSM×4 + PCSS +
      screen-space contact shadows (12-step depth march, near-field, floored); volumetric
      clouds (half-res RTT march, baked weather, cloud sea below summits + cloud shadow map);
      TRAA, GTAO (depth-derived normals, distance-faded), bloom, per-ToD grade (strong
      teal-orange golden split). Gates PASSED: golden vista vs Witcher (DELTA.md Phase 2,
      ~70% of ref without vegetation), shadow-color test (chroma 18.3/255, no gray).
      Artifacts: shots/phase-2/. Known debts → DELTA items 1,4,7–10.
- [x] **Phase 3** — DONE 2026-06-11 (vegetation-dependent parts deferred w/ DEVIATIONS).
      Irradiance probe field: 256×256×6 TERRAIN-RELATIVE layers (1.5–105 m above ground),
      heightfield ray-march gather (16 dirs × 16 steps, sun horizon test + albedo proxy +
      sky LUT misses), SH-L1 → 3×rgba16f 3D textures, time-sliced 3072/frame (~2 s refresh,
      invalidate() fast-converge on ToD jumps), injected via IrradianceNode (setupLightMap
      patch); hemisphere dimmed to 0.15× floor. GTAO: depth-derived normals + distance fade
      + luminance-masked 'indirect-only' approx (DEVIATIONS D-1). Screen-space bounce +
      foliage translucency → Phase 4 (D-2). Probe density vs spec floor → D-3.
      VERIFIED: no-black-shadows at golden hour (darkest-20 lum 61.8, chroma 20.1 — AgX-toe
      desat fixed); ?view=probes ambient-only debug view; +3 ms GPU. Forest-interior gate
      re-judged after Phase 4 (no forest exists). Artifacts: shots/phase-3/.
- [x] **Phase 4** — DONE 2026-06-11. Growth grammar (tropisms, whorl/spiral/PLANAR phyllotaxis,
      crown envelopes, light-competition asym, per-instance lean/age/bias = D5); 6 tree species
      (spruce/pine/beech/birch/karst-gnarl/snag) + 3 shrubs (incl. PINK FLOWERING) + fern + 4
      flowers; foliage CLUSTER-CARD pipeline (real leaf/needle meshes captured to per-species
      2×2 atlases — the ez-tree look, zero assets) + hero HYBRID mode (cards + real-mesh
      foliage; hero spruce 1.18M / beech 1.26M tris); bark synthesis 6 recipes (2048² compute,
      albedo/cavity + normal/rough/height, aoNode wired = D-1); rocks (welded icosphere +
      strata ledges + fracture cuts; hero 327k craggy, cliffFace preset, wall, cobbles); grass
      (clumped instanced blades, 260k shown), debris kit (cobbles/pebbles/twigs/chips/litter
      reusing leaf atlas), deadfall (logs ×3 decay + stumps + shelf/cap fungi), dressing
      (moss/lichen/streaks by upness+cavity, hanging vines, ledge ferns, litter ring); foliage
      translucency + SS bounce (D-2), octahedral impostor capture 8×8 albedo+normal+depth +
      relit preview (runtime → D-4/Phase 5). Gate: gallery sheet shots/phase-4/ + macro-meso-
      micro audit in DELTA.md (top-3 deltas fixed: foliage hue variance, log moss, blossoms).
      Forest-interior gate re-judge happens after Phase-5 assembly (no forest yet).
- [x] **Phase 5** — DONE 2026-06-11. GPU scatter (162k trees/467k under/451k stones), per-frame
      instance cull (frustum + terrain-march occlusion + ring classify) → compact indirect draws,
      LOD rings hero≤26/R1≤150/R2≤460/octahedral impostors (dithered crossfades, vegViewPos),
      PER-CASCADE shadow caster culling + fitted crown shadow proxies (world-anchored dither,
      impostor-band casters to 1.1 km) + world-metric PCSS, canopy-aware chromatic probe GI
      (green crown slab + glow), grass/debris probe GI + shade coloring, terrain micro-
      displacement (fbm+ridged creases, biome/gravel-gated, shared DISP table, ?dispdbg=1),
      gorge wall greening, river boulder affinity, grass 5/3-blade clumps + 3-plane tufts +
      near scruff floor. GATE PASSED: floors hero 19.5M / vista 6.8M veg tris / grass ~1.0M
      blades (shots/phase-5/floor-*), repetition strip clean (strip-1..5), DELTA Phase-5
      top-10 logged + top-3 fixed, DEVIATIONS D-5. Shadow regression user-reported and FIXED
      (blobby/flicker/circle — see gotchas). Carried: geometric wall plants, moss volume geo,
      noon-dapple gap-framing re-judge, perf 50–151 ms GPU veg-heavy (Phase 7).
- [x] **Phase 6** — BUILT 2026-06-12, all six systems live + verified (gate notes below):
      stream/lake water (clipmap + SSR + caustics + wet margins + strict hydrology),
      hierarchical wind (trees/understory/grass + shadows), froxel volumetrics (canopy
      shafts + valley fog), GPU particles (131k snow/pollen/leaves), weather motion
      (clouds drift+churn, shadow map follows). Lakes use SSR (spec: "SSR or planar");
      planar pass logged as optional polish. Gate DELTA written (docs/DELTA.md Phase 6):
      motion checks PASSED, remaining items are art-direction/composition (fg boulders,
      wall-veg density, overhang framing) folded into Phase 7's composed-bookmark pass.
- [ ] **Phase 7** — perf pass (60fps@1440p / reduced preset), HUD full (per-pass GPU timings),
      9 bookmarks, 90s flythrough, full battery, final two-frame test, self-score rubric.
- [ ] **Tier 3** — only after battery passes (see spec §11).

## New Jerusalem scene (`src/nj/`) — content track status (updated 2026-08-02)

> This engine's phase checklist above tracks the **terrain/vegetation systems**
> (PROJECT_LAAS_v2.md). The **biblical content** built on top of it
> (`?scene=newjerusalem`, hosted at `/world-preview`) is a separate track,
> specced in `docs/specs/phase-3-engine-integration.md` (its own M1–M5) and
> tracked milestone-by-milestone in `docs/roadmap.md` Phase 3 (M3.1–M3.6). This
> section is the source-of-truth inventory for that track specifically — kept
> in sync with `docs/roadmap.md` and `RENDERING-DECISIONS.md`, which any future
> session should also read.

**(2026-08-02) HARDWARE SELF-VERIFICATION ESTABLISHED ON SCOTT'S LAPTOP —
the Phase 3 gate ("no Phase 4 until the agent can see its own work") is
cleared.** First agent-driven capture on real hardware since the city
sessions: `tools/shoot.ts --scene newjerusalem` from a fresh checkout
(worktree, `npm install` from cache) acquired the **`nvidia / blackwell`**
adapter through the plain cached recipe `{headless: true, channel:
'chromium', args: []}` — none of the software-adapter fallback candidates
added on 2026-07-31 were needed. Boot ready in 58.9 s, 42 fps at 1600×900,
21.0 M triangles, 1169 draw calls; `shots/nj-check.png` shows the city
(tiers, bay rhythm, gate-lintel names legible), not the boot screen.

- **The ProbeGI validation error does NOT reproduce on hardware.** The full
  page console was captured for the whole boot and first frames: no
  validation error, and the GI passes ran with normal timings
  (`c.probeGather` 0.19 ms, `c.probePublish` 0.004 ms). The 2D-view-against-
  3D-texture error is therefore a SwiftShader-path artefact, not an engine or
  three.js backend bug that hardware exercises. Per the standing constraint
  (no three.js patch without a hardware repro) there is nothing to fix;
  if GI ever looks wrong on hardware, re-open with fresh evidence.
- Console noise on hardware, for the record (all pre-existing classes, none
  fatal): `powerPreference` ignored on Windows (crbug.com/369219127), the
  timestamp-query pool warning, and one `THREE.TSL: Vertex attribute
  "normal" not found` warning.
- Cloud/SwiftShader capture remains a dead end per the 2026-07-31 entry;
  the visual bar lives on this machine now.

**(2026-07-31) TEMPLE COLLISION + FLOORS BUILT — half of the standing
"dwellings/temple collision and floors remain open" debt closed.** A walker
previously phased through the perimeter wall, the sanctuary and the altar,
and stood at meadow height inside the courts.

- `Temple.ts` now RECORDS the world AABB of each massing box as it builds it
  (`solidBox`/`recordSolid`), returning `{ group, solids }`. This inverts the
  cityCollide idiom deliberately: the city massing is a few concentric square
  rings that `cityModel`'s tables describe exactly, but the temple is 57
  individually placed boxes whose layout arithmetic lives inline in the
  builder — deriving a parallel description in a collide module would BE the
  hand-mirrored copy the idiom forbids. The collider set is the geometry.
- `templeCollide.ts` (new, pure — no three.js, no DOM) consumes that list:
  lateral collision with cityCollide's axis-separated incremental sweep
  (no tunnelling, no trapping on programmatic poses) plus floors from the
  top face of each mass, y-aware so the sanctuary roof never claims a walker
  in the court beside it. Filigree (merlons, windows, arch heads, trim
  courses, vestibule pillars, altar horns, glow membranes) is excluded at the
  source by simply not calling `solidBox`.
- **STEP_OVER (1.0 m) is the load-bearing constant.** The plinth is a 0.8 m
  lip ringing the whole compound; blocking it laterally walled off the gates
  as effectively as the masonry, and the counted stair flights (Ezek 40:22,
  26, 49) became impassable ridges. A mass whose top is within 1.0 m of the
  body is stepped over rather than blocked. Deliberately far tighter than
  `FLOOR_STEP_UP_M` (3.5): the floor rule governs what may be STOOD on, this
  governs what may be walked THROUGH, and the 3.15 m perimeter wall must stay
  solid from the outer court.
- Verification: `tools/probe-templecollide.ts`, 20/20 PASS — real FlyCamera
  physics against the real wraps over the real recorded solids. Proves the
  wall stops a walker, the EAST gate portal passes one (Ezek 40:11's ten-cubit
  opening is a real gap), the WEST wall has no gate (Ezek 42:15-20), oblique
  motion slides, the outer court and inner terrace are real stacked floors,
  the house platform blocks short of the sanctuary, a pose inside a solid is
  never trapped, and a compound-spanning move cannot tunnel. Regression:
  probe-wallcollide / probe-cityfloors / probe-walkfling all still 0
  failures; `tsc --noEmit` and `vite build` clean.
- **Owed:** live GPU/hardware walk of the compound (Scott's — no GPU in the
  cloud container; see the software-rasteriser note below). **Still open:** the
  DWELLINGS half of this debt, and there is no walkable ascent onto the inner
  terrace — its 3.3 m rise has no rendered flight, the same class of gap as
  the city's "no stairs/ramps between floors" debt.

**(2026-07-31) SOFTWARE-WEBGPU CAPTURE IN THE CLOUD CONTAINER: PARTIAL.**
`tools/launch.ts` now falls back to a system Chromium (`LAAS_CHROMIUM`, else
`/opt/pw-browsers/chromium`) and a headless `--enable-unsafe-webgpu`
candidate, which resolves Chromium's SwiftShader adapter where the pinned
browser is absent and no GPU exists; `shoot.ts` gives navigation the same
budget as readiness. Verified: adapter acquired (`google / swiftshader`), and
three.js `getArrayBufferAsync` over `instancedArray` reads back 2048² in
165 ms. **But the New Jerusalem scene still cannot be captured here.** At the
default `high` preset the 4096² terrain readback did not return within 15
minutes; at `preset=low` it returns in ~5.5 min and boot proceeds into
vegetation, where the renderer process is then destroyed mid-atlas-capture.
A real WebGPU validation error surfaces on the way: a 2D texture view against
the 3D 256×256×6 RGBA16Float probe field (`gpu/passes/ProbeGI.ts` — the
engine's own `Storage3DTexture` + `textureStore(vec3)` + `texture3D` usage all
look correct, so the 2D view is created inside three.js's backend). Worth a
look on hardware, since Dawn validation is backend-independent and this is not
obviously a SwiftShader artefact. Conclusion unchanged: visual judgment needs
real hardware; CPU probes remain the cloud-side verification bar.

**(2026-07-29/30) CITY REVIEW SURFACE + ART-DIRECTION PASS.** Branch
`claude/city-review-framings`, 8 commits, UNPUSHED and NOT RE-VENDORED at
time of writing. First GPU pass over the city since 2026-07-02 — the
07-24..07-28 sessions had no GPU, so the visual state had gone eleven days
unlooked-at while docs work continued on top of it.

- **Register question SETTLED (Scott):** the city stays PHOTOREAL. ADR 0009
  rule 2 untouched, no superseding ADR. The remaining gap is therefore an
  OPTICS problem, not a rendering-register one. Recorded with the other
  three answers in `docs/plans/procedural-asset-authoring.md` §8.
- **`src/nj/reviewFramings.ts`** — nine composed review framings, the city's
  counterpart to the terrain's nine `debug/Bookmarks.ts`. Authored in LOCAL
  city units and resolved through the owner tables, because the 2026-07-01
  framings in `docs/CITY-QUALITY-BAR.md` were absolute world coordinates and
  NOT ONE still framed the city — the massing outgrew them silently. Yaw and
  pitch derive from an aim point. Published on `hooks.reviewFramings`;
  `?shot=1..9` and digit keys 1-9 jump (matching the terrain scene).
  `tools/cityshots.ts` shoots the whole set from ONE boot (~2.5 min vs ~8,
  and one shared world/exposure/cloud state so sheets are comparable build
  to build); `--framealign N` for pixel-diffable sheets, but it spins up to
  1024 frames PER FRAMING and a full aligned sheet can lose the WebGPU
  device on integrated parts — use with `--only`. New standing probe
  `tools/probe-framings.ts`.
- **`NJ_CONFIG.palette`** — six named material families (the identities the
  text names), albedo plus optics each, replacing five loose `Color`
  constants and inlined per-use-site roughness values. Adapted not copied
  from the Hoshi one-palette lesson: their lit/mid/shade/bounce shape suits
  a cel renderer that must author shade; ours comes from the probe field.
  Verified a no-op by frame-aligned diff (0.10/3.38/0.04% against a
  same-build two-boot control of 2.90%).
- **Bay rhythm** — authored ABCBA cadence (grand centre bay on the meridian,
  majors flanking, narrows at the corners) plus heavier corner piers,
  replacing N identical bays. Widths group into 2-3 classes per tier, one
  InstancedMesh each, ~8 extra draw calls. All classes share one head top.
- **Pavement coursing** — merged concentric course bands on an authored
  border-and-field profile, plus a world-space paving lattice (fades past
  ~130 m to avoid moire TRAA amplifies). Bands abut, no coplanar overlap, no
  cityCollide floor moved. NOTE the deliberate omission: no raised kerb or
  parapet, because collision claims the ring at one height and a walker
  would clip through it — that needs a collision change.
- **Optics pass — one bug in four places.** Gems, tier glass, city cascade
  and the jasper wall each had real transmission or simulation under a
  CONSTANT emissive/opacity floor that erased the very thing the material
  is. All four are now grazing-weighted (`grazing()` in CityMassing).
  Gems additionally: per-species published refractive index and dispersion
  in `FOUNDATION_GEMS` (chalcedony 1.53/0.013 vs zircon 1.93/0.039 — a 3x
  spread in fire, variation drawn from the cited stone list), consumed
  through the declared `palette.gemDispersionScale`; facet pitch halved and
  depth jitter doubled. River: floor 0.18 -> 0.05 on the CITY cascade only
  (`crystalFallMaterialWorld` keeps its floors — rim falls are judged at
  ~1 km).
- **CITATION CORRECTION.** `jasperMaterial`'s comment read
  Rev 21:18 "wall built of jasper... clear as glass" — an ellipsis across a
  clause boundary. Per this repo's own canonical export, 21:18 is "the wall
  ... is built of jasper, while the city itself is pure gold, LIKE CLEAR
  GLASS": the transparency is the GOLD CITY's. The crystalline jasper
  reading comes from **Rev 21:11** ("like jasper, clear as crystal", tier
  `clear`), so a translucent wall is an inference ACROSS TWO VERSES and
  21:11 describes the city's radiance, not the wall's fabric. Comment now
  states the derivation and its limit.
- **Wall + gallery articulation.** Ashlar coursing on the wall's outer face
  (Pillar A taken literally here — a wall is looked ACROSS, which is the case
  the ~0.3 m reveal rule is written for) AND its inward face, which on the
  base tier is the gallery's outer wall. Engaged colonnade on the plinth
  face — ENGAGED because a free-standing one would be furniture the walker
  walks through; corners left bare for the base ascent. Street-of-gold apron
  paved and its metalness dropped 0.5 -> 0.2.
- **Pillar D beacon (item 7)** — `distantLift()`: opaque-family self-light
  ramps 1x -> ~2.8x beyond ~9 km, because the stepped silhouette now reads at
  12 km but the city was NOT the brightest thing in its own landscape (the
  cloud deck was). Aerial perspective is a post-pass and cannot be lifted off
  one object, so the radiance entering it is raised instead. This is the one
  place boosting emissive with distance is the CLAIM rather than a cheat
  (Rev 21:23-24). Applied to gold/ivory/jasper only — NOT the tier glass
  (already within ~0.01 of `bloomThreshold`) nor the crown (over it on
  purpose). PARTIAL: the city now holds as a warm luminous mass instead of
  washing to tan, but the clouds are still brighter. Going further needs a
  glory/bloom treatment and a decision about the contract.
- **Bloom claim corrected.** The 2026-07-29 optics commit said every glass
  tier sat further under `bloomThreshold` than before. True face-on, FALSE at
  the silhouette, where the new grazing term adds. Worked arithmetic is now in
  `goldGlassMaterial`; the grazing weight dropped 0.35 -> 0.20, which puts the
  top glass tier at 1.49 against the old 1.53 — under the threshold and under
  the old value at both limits.
- **SCOTT-OWED:** (1) whether the gem optics may stay keyed to CONTESTED
  mineral-species identifications (`Gem.species` records which reading;
  jacinth/chrysolite/agate/beryl each have more than one credible
  reconstruction) — flagged, not settled; (2) the parapet/collision
  follow-up; (3) re-vendor + push.
- **Battery each commit:** framings, entitypick, cityfloors, walkfling,
  wallcollide, visualkey, ascent, stages, population ALL PASS; stages-live,
  navigation, campus-live ALL PASS; tsc + vite build clean. Perf note for
  any later verdict: these frames are DRAW-SUBMISSION bound, not GPU bound
  (GPU render+compute ~16 ms vs `cpu.submitMs100` 2430 = 24 ms/frame) on an
  Intel Xe-LPG part at ~25-35 fps / 1280x800.
- **Open observations, not chased:** a white wash low in the distant
  framings (probably the foreground cloud layer — UNCONFIRMED) and thin
  vertical bright streaks in the sky at `crown-sea-of-glass` (probably
  particles; the light-pillar hosts do not appear in that framing at all).

**(2026-07-25) SUMMIT RAINBOW RING REMOVED (Scott's call) + COLLAPSED-HOST
BOOT FIX.**

- Scott saw the spectral ring floating over the crown and called it: gone.
  `CityMassing` builds NOTHING above the crown now — the glory sphere went
  2026-07-20, the Rev 4:3 rainbow ring 2026-07-25. ADR 0010's aniconic
  posture is total: the emissive crown, the sea of glass and the arcade
  glows carry Rev 21:23's light, and Rev 4:3 is simply not depicted. The
  descriptor keeps its `debated` tier in the dataset and still shows in the
  browse UI and HUD — this is a rendering choice, not a claim about the text.
  RENDERING-DECISIONS #4 gains an addendum saying so.
- Geometry and analytic volumes must agree, so two anchors moved with it:
  the `throne-of-god` PICK sphere (was centred 10 local above the crown to
  enclose the ring — now on the crown at SUMMIT+2, r 12) and its reading-key
  MARKER. A pick volume or key marker left hanging in empty sky pops a card
  for a click on nothing, which is the same desync the shared-table
  discipline exists to prevent. `summit-overlook` nav copy now reads "Sea of
  glass before the throne" (Rev 4:6).
- Separately, from the same session: BootUI/Engine now survive a COLLAPSED
  HOST. A hidden or zero-width /world-preview iframe reports innerWidth/
  innerHeight 0; the boot's star and meadow layers are sized from those, and
  a 0-dimension canvas is an illegal drawImage SOURCE — it threw
  InvalidStateError and the LAAS fatal handler killed the world for a
  cosmetic star field. buildViewportLayers and drawScene now bail on a zero
  viewport, and Engine's resize holds the last good size (0/0 is NaN, and a
  NaN camera aspect never recovers). probe-bootrite run 4 (D1-D4) pins it,
  and it FORCES layersActive false first — otherwise the matte layers decode
  before the star path runs and the case cannot fail however broken the
  guard is. Verified failing without the guard, passing with it.
- Battery: CPU entitypick, visualkey, population, cityfloors, walkfling,
  wallcollide, ascent, stages ALL PASS; live navigation, arrival, resize,
  bootrite ALL PASS; bootui done. tsc + build clean, re-vendored.

**(2026-07-24, later) PHASE C SLICE 2 — the `arcade` detail stage.**

- `stages.ts` gains an eighth stage, `arcade`, and it is the first DETAIL
  stage: relief filigree inside the city massing rather than a content
  block of its own. `buildCityMassing(gi, { arcade })` gates exactly six
  classes — wall pilasters, terrace arch frames, terrace fluted piers,
  the gold frieze fascia, the ivory arcade courses (fascia + gold arches
  + glow panes), and the dentil courses.
- The boundary was NOT invented here: `cityCollide`'s own header already
  declares this class ("relief filigree, same class throughout:
  pilasters, piers, arch frames, dentil/arcade courses...") as what does
  NOT collide. The stage makes the geometry honour a line the collision
  module had already drawn, which is why it owns no hooks. Structure
  stays on through `-arcade`: massing, wall, gate portals + inscriptions,
  foundation course (picked AND collided), the glass tier skin, cornice
  pavements (walk floors), crown, ascent ramps.
- Sub-stage of `city` — with `city` off nothing calls the massing
  builder. The parser stays dumb (no dependency graph): `?stages=arcade`
  alone renders no city, which probe-stages E5 pins as intended
  inclusion semantics rather than a bug.
- Probes: probe-stages grows section E (5 checks, arcade defaults on,
  `-arcade` keeps city, `-city` does not implicitly clear the flag);
  probe-stages-live grows boot C — with `-arcade` the wall collision is
  still installed and the approach frame blocks at the SAME z
  (2069.0000), the plaza walk floor sits at the SAME height (483.8500),
  and the river claim is untouched, all to 1e-6. That equality IS the
  stage's contract: if a refactor ever moves a cornice pavement or the
  foundation course under the flag, boot C fails.
- Measured: draw calls 1083 -> 1029, triangles 19.74M -> 19.08M
  (-663k). Stills shots/wip/arcade-{on,off}.png at the Issachar gate:
  ornament gone, wall/gate/inscription/pearl arch/cornice/glass bays/
  cascade identical.
- Battery: CPU population, entitypick, cityfloors, walkfling,
  wallcollide, visualkey, ascent, stages ALL PASS; live visualkey-live,
  entityhud-live, campus-live, navigation, arrival, stages-live ALL
  PASS; bootui done; bootrite ALL PASS (run alone). tsc + build clean;
  engine re-vendored (index-CSnvzx6j.js).
- Phase C remainder: the timed "city assembles itself" arrival sequence
  — Scott's direction needed on build-order-vs-scripted-order and
  whether it plays inside the existing boot rite or replaces part of it.

**(2026-07-24) COLLISION SWEEP FIX — the frame-spanning tunnel closed.**

- `cityCollide.resolveCityMoveLocal`: the axis-separated substeps used
  to test ABSOLUTE interpolated positions, so one move long enough to
  span a whole solid band (a 100+ m dt-spike frame at fly speed) landed
  free beyond it and tunneled (found while building probe-stages-live;
  frame-scale moves never triggered it). The sweep is now INCREMENTAL —
  each candidate advances one substep from the current resolved
  position — so a solid band always interposes regardless of move
  length. Slide-along-face semantics and exact-placement free-move
  (start inside a solid) are unchanged.
- probe-wallcollide grows a T section pinning it: T1 band-spanning move
  stops at the course face (z 103.45); T2 the same-length move passes
  the gate lane end to end; T3 oblique band-spanning move still slides
  in x. probe-stages-live's comment updated (its A2 case stays
  frame-scale for the start-inside-solid reason only).
- Battery note: probe-bootrite showed one timing-flaky FAIL ("fill
  tracks the paced display value") when run back-to-back with seven
  other live probes; clean ALL PASS in isolation. Pacing probes are
  load-sensitive — re-run alone before treating as real.

**(2026-07-23) PHASE C STARTED — named content stages (`?stages=`).**

- `src/nj/stages.ts`: the seven content stages (city, river, trees,
  temple, dwellings, population, falls) + the pure `parseStages`
  parser (`?stages=city,river` includes; `?stages=-population`
  excludes; absent = all). NewJerusalemScene gates each content build
  on its stage; Allotment.ts splits city/river the same way.
- Discipline: a stage owns its geometry AND its derived probe hooks
  (river off drops the water-claim wrap; city off drops wall collision
  and the city walk floors; dwellings off drops the far-ground wrap) —
  geometry-only ablation that leaves stale invisible physics is
  exactly the shared-table desync this codebase guards against.
  Terrain (macroPatch/scatterExclude) and the analytic entity/nav
  contracts are never staged. `?resizeprobe=` stays a separate
  diagnostic contract (probe-resize.ts); both gates apply.
- Probes: tools/probe-stages.ts (CPU, parser semantics) and
  tools/probe-stages-live.ts (two boots: default asserts collision
  blocks a frame-scale approach move, the channel claims wade water,
  the plaza floor claims; `-city,-river` asserts moveProbe null, dry
  channel, bare-terrain plaza). Probe development surfaced a latent
  edge in resolveCityMoveLocal: substeps test ABSOLUTE positions, so
  a single 100+ m frame move spanning a whole solid band tunnels
  (frame-scale moves never do; flagged as a follow-up task, not
  fixed here).
- Debugging today; the bones of a "city assembles itself" arrival
  sequence later (plan doc Phase C). Stage-granular instancing was
  already largely done (arches/piers/dentils/glow panes).

**(2026-07-22, later-2) PHASE B CLOSED — tier rows + look defaults in
config; the structural live-rebuild recorded overtaken-by-events.**

- `config.ts` gains `cityTiers` (base {h, arches} + the four upper
  terrace rows; the BASE half stays the resolver-derived CITY_HALF —
  cityModel composes the one CITY_TIERS table every consumer keeps
  reading) and `look` (timeOfDay 17, aerialFogK 0.12, aerialClarity
  0.35) consumed by NewJerusalemScene — the tuned-look values now have
  one home.
- EditPanel: "copy config (JSON)" emits the `NJ_CONFIG.look` shape
  (paste tuned values straight into config.ts); the dead
  glory-intensity binding and the never-assigned `njLive` registry are
  REMOVED (leftovers of the glory orb's 2026-07-20 removal — the
  binding's `if (njLive.glory)` gate never fired).
- `rebuildNewJerusalem(config)` recorded OVERTAKEN BY EVENTS in the
  plan doc: CITY_TIERS now feeds five probe-verified analytic
  subsystems (~76 uses / 7 modules); a visual-only rebuild would
  desync them, a full-fidelity one threads the table everywhere for a
  dev-only convenience. Phase B closes; next in plan sequence is
  Phase C (staged assembly — partly done: arches/piers/dentils
  instanced) when called.

**(2026-07-22, later) CITY-SIDE REV 21 RESOLVER — the city footprint
consumes its cited 12,000 stadia.** Phase B slice 2 (RENDERING-DECISIONS
entry #12, companion to #11): the last named remainder of the
Scripture-as-data reframe (plan §3) is in.

- Pipeline: `measure/city.py` authors the two Rev 21:15-17 records —
  `rev-city-side` (12,000 stadia, tier `clear`; the minority perimeter
  reading preserved in notes) and `rev-city-wall` (144 cubits, tier
  `fuzzy` — height vs thickness underdetermined; recorded as height
  after 21:12's "great, high wall" with the thickness reading in notes).
  `seed_city` (citations carry book "Revelation" — `_seed_records` grew
  a `book` param), `emit_city_module` → `cityMeasurements.gen.ts`
  (const `REV`, slug prefix `rev-`), CLI `measure seed-city` +
  `--city-module` on export. The REV module is purely text-native — NO
  `cu` field (Revelation declares no internal unit standard; no Ezek
  40:5 governs John's vision). 4 new tests (166 total).
- Engine: `config.ts` gains the `city` section — declared
  `compressed-city` mode: ESV-footnote unit glosses (stadion 185 m,
  cubit 0.457 m) over ONE whole-city compression factor 555,
  back-derived from ADR 0014's 4000 m experiential footprint exactly as
  entry #11's 0.1 was from the mirror constraint. `cityModel.CITY_HALF`
  now DERIVES from `rev-city-side` via `cityMeters()` (lands exactly on
  100 local — zero visual change); `NJ_SCALE` moved into config.ts
  (rimModel re-exports, importers untouched). `rev-city-wall` is
  deliberately NOT consumed (wall keeps art height, asserts nothing).
- HUD: the `new-jerusalem` entity export (schema 0.2.0) now embeds both
  records — the city card shows "12,000 stadia — Revelation 21:16" /
  "144 cubits — Revelation 21:17" with tier badges; `formatMeasurement`
  fixed for the invariant plural ("stadia", not "stadias").
- Remaining Phase B (unchanged): tier table/palette/glory/river config
  sections, `rebuildNewJerusalem(config)` live-rebuild.

**(2026-07-22) PHASE B CONFIG STARTED — the campus consumes EZA; band
proportions are now the text's own.** First slice of the plan-§1 Phase B
`NewJerusalemConfig` (RENDERING-DECISIONS entry #11, the successor entry
#8 promised).

- New `src/nj/config.ts`: `NewJerusalemConfig` + the declared
  `compressed-district` resolver mode (0.1 m per long cubit — derivation
  in the module doc: 10,000 cubits of priests'-band breadth centered on
  TEMPLE_SITE.z against the heightfield-mirror edge |z| ≤ 6144).
  `districtCu()/districtMeters()` read `allotmentMeasurements.gen.ts`
  (EZA) — the campus counterpart of templeModel's `cu()/meters()`.
- `campusModel.ts` INVERTED: cited `PRIESTS_RECT`/`LEVITES_RECT` come
  first (25,000 × 10,000 cubits each at district scale → 2500 × 1000 m,
  equal, adjacent, sanctuary-centered), and the block grids are FITTED
  inside them (COLS_PER_SIDE/NEAR_ROWS/FAR_COLS_PER_SIDE/FAR_ROWS are
  now derived, not hand-typed). Visible change: priests' band 6 rows ×
  16 cols (was 7 × 80), Levites' 2 rows × 8 cols (was 13 × 40) — the
  bands now render EQUAL breadths (the text's explicit equality; the old
  Levites' band was 3.76× the priests') at the shared 2.5:1 proportion.
  The freed plateau reads as the prince's unbuilt portion (Ezek
  48:21-22, no spatial numbers — nothing invented). Scene scatter
  exclusion now derives from the cited rects.
- Tooling: `shoot.ts` gains `--base` (target the deployed engine);
  `shot-sway-pair.ts` pre-existing tsc error fixed (`hud: false`).
- Verified: tsc clean, vite build clean, all 7 CPU probes green
  (entitypick B13-B15/N6 and the campus zone volumes hold — pick/key
  derive from the same owner table), live probes + stills per this
  entry's PR. Remaining Phase B: migrate tier table/palette/glory/river
  sections into config.ts, `rebuildNewJerusalem(config)` live-rebuild,
  city-side Rev 21 resolver mode (ADR 0018 consequence 3).

**(2026-07-21, later-3) FIGURE IDLE MOTION BUILT — the multitude
breathes.** The M3.6 "figure idle motion" remainder lands exactly on the
prescribed idiom: shader-time only (the Population.ts host-bob
positionNode pattern), zero CPU per-instance updates.

- `populationModel.ts` gains the probe-asserted `SWAY` table: speed 0.9
  rad/s (≈7 s breath cycle), robe-crown amplitude 2–4.5 cm per-instance
  (hash slot 43), palm-tip flex +3.5 cm at 1.7× speed. `Population.ts`:
  a shared `figureSway()` node (hash-phase slot 41) feeds all three
  figure materials — robes sway scaled by local height (feet stay
  planted), heads apply the FULL sway so they ride their robe's crown
  (identical instance ordering across the three InstancedMeshes makes
  the per-instance phase/amp match exactly), palms carry the body sway
  at grip height (0.62) plus their own tip-weighted frond flex (slot
  47). Hosts' rise/fall untouched.
- probe-population A7 asserts the contract CPU-side: total lateral
  amplitude < 0.15 m (figures never leave their assembly/pick volumes)
  and a slow speed band. Placements, counts, emissives unchanged.
- LIVE-VERIFIED with a one-boot A/B pair (`tools/shot-sway-pair.ts`, a
  verification aid, not a standing probe): same pose, 1.75 s apart —
  11,482 pixels changed >10 grey levels in the crowd crop vs ZERO in the
  static-sky control; the zoom side-by-side
  (shots/wip/sway-pair-zoom.png) shows fronds and robe crowns shifted
  with heads still seated. Full battery green (all CPU + live probes),
  tsc clean, build clean, engine re-vendored.
- Still open in M3.6: M4.4's nations/pilgrimage dynamism (Phase 4) and
  Scott's subjective pass — the sway amplitude/speed numbers are tuned
  for reverence at reading distance and are his to adjust.

**(2026-07-21, later-2) DWELLING-CAMPUS PICK WIRED — M3.4's last gap
closes; measurement-backed entity cards land.** The Track A follow-on
slice: the campus bands are now cited, clickable zone entities.

- Pipeline (export schema 0.1.0 → 0.2.0, additive): per-entity JSON now
  embeds approved `measurements` (with inline citations), and an entity
  qualifies for export with measurements alone — the six measurement-backed
  entities (`priests-portion`, `levites-portion`, `holy-district`,
  `city-portion`, `ezekiel-city`, `ezekiel-temple`) now export to
  `/data/entities/`. canonical.json stays descriptor-driven (the browse
  index does not list measurement-only entities yet — a Phase 2 UI call for
  later). Descriptor-only entity files round-trip byte-identical (no
  `measurements` key emitted when empty). 5 new exporter tests; suite 162.
- DATA-TRACKING FIX: the 2026-07-18 claim that `/data/entities/*.json` was
  "tracked via git add -f like /laas" was NOT true — git carried zero files
  under `apps/web/public/data/`, so prod HUD/key fetches had nothing to be
  served from. This slice actually commits the export set (canonical.json,
  manifest.json, 269 entity files, ~1.3 MB; embeddings.json stays
  untracked). Verified before committing: zero citation `quote` fields —
  statements + references only, ADR 0006 clean.
- Engine: `src/nj/campusModel.ts` extracts the Dwellings band tables into a
  pure shared owner module (Dwellings.ts imports it; layout numbers
  unchanged). `entityPicks.ts` adds three zone volumes — the priests' band
  as TWO strips flanking the cleared meridian lane so a ray down the
  city→temple axis still reaches the temple compound (probe case B15), the
  Levites' band as one (its generous vertical span absorbs the heightAtCpu
  edge-clamp beyond the mirror). `keyModel.ts` adds the two markers (12 →
  14 anchors). `EntityHud.ts` renders measurement cards — subject,
  "25,000 long cubits" display grammar, tier badge, citation chips, and
  the notes surfaced for non-clear tiers so the MT/LXX breadth crux stays
  legible on the holy-district card. `VisualKeyUI.ts` tier dots span
  descriptors + measurements.
- Verification: probes entitypick (+B13/B14/B15/N6, C generalized to
  descriptor-or-measurement grounding), visualkey (C1 likewise),
  visualkey-live (14 anchors) updated; NEW standing member
  `tools/probe-campus-live.ts` (live: both bands pick, meridian lane
  reaches the temple, and the clicked card renders The Priests' Portion
  with long-cubit values, clear badges, and Ezek 45:3/48:10 chips). Full
  battery green: entitypick, visualkey, population, cityfloors, walkfling,
  wallcollide, ascent (CPU) + visualkey-live, entityhud-live, campus-live,
  navigation, arrival, bootui, bootrite (live). tsc clean, build clean,
  engine re-vendored. Still: shots/wip/campus-pick-key.png (key on over
  the bands — canonical names + clear-tier dots render from the real
  exports).
- Scott-owed: reading-key styling pass now covers 14 markers; the campus
  card copy; whether the browse index should list measurement-only
  entities.

**(2026-07-21, later) TRACK A SEEDED — the Ezek 45/48 allotment measurements
are canonical; the dwelling-campus pick is unblocked.** The ESV_API_KEY
blocker cleared, so the allotment-strip records went in via the pipeline on
the temple-PoC precedent (ADR 0017/0018, `pipeline/src/far_country/measure/`):

- `measure/allotment.py`: 17 hand-authored records — 5 new zone entities
  (`holy-district`, `priests-portion`, `levites-portion`, `city-portion`,
  `ezekiel-city`) plus two Ezek 45:2 records (the 500-cubit sanctuary plot +
  its 50-cubit open space) attached to the existing `ezekiel-temple` entity,
  corroborating the ESV's 500-cubit reading of the 42:16-20 precinct
  (`ezt-precinct-side`). Values are text-native long cubits (the Ezek 40:5
  convention). Nothing invented: the prince's portion, the tribal strips, and
  the 45:10-12 capacity/weight standards carry no spatial numbers and are
  deliberately absent (documented in the module docstring).
- THE CRUX: the holy district's breadth — ESV prints 20,000 (Septuagint)
  where the Hebrew reads 10,000, at 45:1, 48:9, and 48:13 (footnotes fetched
  and verified from the ESV API) — is tiered `debated` with both readings
  preserved; the render follows the ESV as printed. No NEW ambiguity beyond
  the known 45:1 crux appeared (48:9/48:13 are the same variant — the ESV's
  own 48:9 footnote reads "Compare 45:1"), so nothing needed Scott's call.
- Machinery: `seed_temple` refactored onto a generic `_seed_records`
  (behavior identical; `SeedOutcome.entities_created` is now an int); new
  `seed_allotment`; engine-module emission split by slug prefix so
  `templeMeasurements.gen.ts` stays byte-identical (verified: no git diff)
  and a new generated `src/nj/allotmentMeasurements.gen.ts` exports `EZA`
  (17 entries, unconsumed so far). CLI: `far-country measure seed-allotment`;
  `measure export` now writes measurements.json (105 approved rows) + both
  modules.
- Verification: adversarial agent pass against the cached ESV text —
  17/17 values/tiers/note-claims clean; 2 citation-completeness findings
  fixed (48:13 added to `eza-holy-district-length`; `ezekiel-city` summary
  range corrected to 48:15-17). Seeded `--review-status approved` with
  reviewer notes per the temple precedent. New `pipeline/tests/test_measure.py`
  (6 cases: well-formedness, crux preservation, idempotent reseed, temple
  regression, prefix-split exports, pending-not-exported); full pipeline
  suite 157 passed. Engine `tsc --noEmit` + `vite build` clean.
- UNBLOCKED next slice: the dwelling-campus entity pick (`entityPicks.ts`)
  can now cite the canonical Ezek 45:4-5 zone entities (`priests-portion`,
  `levites-portion`). One GAP to solve when wiring its HUD card:
  `far-country export`'s per-entity JSON only includes entities holding at
  least one approved DESCRIPTOR, so the new measurement-only entities do not
  yet appear in `/data/entities/` — either extend that exporter to embed
  measurements, or extract + review descriptors for the zones first.

**(2026-07-21) PROCESSIONAL ASCENT BUILT + WALL-ENTOMBMENT FIX — the city
is climbable on foot, and the plaza multitude is finally visible.** Two
coupled changes (RENDERING-DECISIONS entry #10):

- **Ascent.** Two mirrored boustrophedon chains of solid ivory wedge ramps
  (east + west faces), five climbs each: plaza → plinth top → the three
  terrace rings → the crown's sea of glass. `src/nj/ascentModel.ts` is the
  shared owner table (authored z-spans dodge the gate corridors and every
  worship assembly); CityMassing builds the wedges, flat head pads, and the
  tier-0 cornice's stairwell slots (the slab roofs the plaza ring — the
  base climb tops out through it); cityCollide claims the sloped surfaces
  y-aware and blocks the flanks (mounting happens at a ramp's base end,
  never mid-slope through masonry). Slopes: 1.4 run/rise on the tier
  climbs, ~46 deg on the short base climb (the only assembly-and-gate-free
  span of the plaza ring is the corner run). INTERPRETIVE architecture per
  entry #10: uncited, unpickable, no reading-key marker (the
  dwelling-campus precedent). Ivory only — bloom contract untouched.
- **Wall-entombment fix.** populationModel stations the sixteen plaza-ring
  assemblies at the plaza-ring centre — but the jasper wall was massed
  (and collided) as a solid 12-local fill from plinth to wall line, so ALL
  sixteen assemblies (~5,000 figures) stood inside masonry: invisible,
  unreachable, and the "plaza crowd" utility cam sat inside the solid too.
  The wall is now a SLAB at the wall line (`cityModel.WALL_INNER`, matching
  the entity-pick volume), opening the covered street-of-gold GALLERY;
  the plaza ring recentres into it (aCenter 94 → 92) and cityCollide opens
  the same band, so walkers reach the plaza crowds on foot for the first
  time. Gate portals are correspondingly 4 deep instead of 12.

Verified: tsc; `probe-ascent` (26 checks: chain/table, gate + assembly
clearances, stairwell-slot coverage, a simulated full walk SE gate → sea
of glass with no gap/drop/block, flank blocking, gallery regression
guards) ALL PASS; all 7 standing suites + visualkey CPU/live + entityhud
live + bootui/bootrite re-run ALL PASS. Walk-speed note: the surface
claims obey the 3.5 m step rule, so extreme boosted ground speeds
(> ~200 m/s) stall on the steep base climb rather than fall — graceful,
revisit only if it annoys. Scott-only: judge the wedges in the hero view,
the gallery's dim interior lighting, and the ~46-deg base climb in situ.

**(2026-07-20, later-9) READING KEY BUILT (M3.5 CLOSED) — the tier
discipline is visible in-scene without the inspector.** The roadmap's last
open M3.5 item (an in-scene literal-vs-symbolic visual key independent of
the descriptor cards) is live, off by default:

- `src/nj/keyModel.ts` (CPU-pure): twelve world-space marker anchors, one
  per cited entity slug, built from the same owner tables the geometry /
  collision / picks consume and placed for legibility from the southern
  approach. Coverage contract probe-asserted: the marker slug set EQUALS
  the pick registry's slug set — nothing unpickable gets a marker, nothing
  pickable is missing, so no marker can exist without a canonical cited
  entity behind it.
- `src/core/VisualKeyUI.ts` (DOM-only — zero scene-material changes, so
  the rendering register and the bloom emissive contract are untouched in
  either state): K, a bottom-left KEY chip, or `?key=1` toggles floating
  markers — the canonical entity name plus one colored dot per confidence
  tier present among its descriptors (fetched from the SAME
  `/data/entities/*.json` exports the cards consume; nothing authored) —
  plus a fixed bottom-right legend explaining the four tiers. Markers
  project per frame with distance fade, and an honesty pass reuses
  `hooks.entityPick`: when the ray toward an anchor hits a DIFFERENT
  entity well in front (the temple 11 km behind the city, the street /
  multitude behind the wall from outside), the marker dims to 0.35 and
  drops back instead of masquerading as foreground.
- Wiring: `hooks.entityKeyMarkers` (scene-installed, probe-readable),
  `Params.key`, ControlsUI key-card row, `tools/shoot.ts --key 1`
  forwards as the URL param for stills.

Verified: tsc, vite build (re-vendored), `probe-visualkey` (CPU, 8) +
`probe-visualkey-live` (17: default-off, chip, K both ways, ?key=1 boot,
12 markers with canonical names + tier dots in canonical colors, 4-row
legend, occlusion dim, gate stays full) ALL PASS; all 7 standing suites +
bootui/bootrite re-run ALL PASS. Still: `shots/wip/visualkey-approach.png`.
Scott's subjective pass owed — legend copy and marker styling are first
drafts.

**(2026-07-20, later-8) BOOT REFINEMENT + SUMMIT ORB REMOVED FROM THE
WORLD.** Scott's review of later-7: verse too small and too low, gem
diamonds pointless, and the AI-still city "a slumped down pile of crap" —
he wants the REAL city. Changes:

- **The summit glory orb is gone from the 3D world itself** (user
  directive: no orb in the world or the intro). CityMassing no longer
  builds the emissive glory sphere; the rainbow ring (Rev 4:3) stays at
  the old glory height as the aniconic throne marker, and Rev 21:23's
  "the glory of God gives it light" is carried by the emissive crown +
  arcade glows. ADR 0010 posture unchanged — abstract light only, now
  with no body at all. njLive.glory is simply never set (EditPanel
  guards handle it); entitypick/wallcollide suites unaffected (analytic).
- **The boot city sprite is now the engine's own city**: a 2048px front
  still of the live scene (orb-free, rainbow intact, river pouring),
  Higgsfield-cutout, tail-cropped via intro-assets.ts `cropBottom`
  (alpha bbox 0.2013/0.2/0.7994/0.8667, seat = platform underside).
  intro-assets.ts gained edge-feather + bottom-crop params.
- **Verse enlarged and raised into the sky** (top 11%, clamp 20-30px,
  citation in deep bronze with a light halo shadow so it survives the
  white crown rising behind it). **Twelve-gem diamond row REMOVED** —
  progress is a single thin gold baseline (probe-bootrite stone
  assertions replaced with baseline-fill checks). Motes damped 0.55x
  over the bright matte sky; front cloud band grounded at the horizon
  and thinned harder as the city settles; halo/rays calmed.

Verified: tsc, vite build, bootui/bootrite + all 7 standing suites ALL
PASS, boot-shots stills clean. Judgment call recorded: the boot backdrop
keeps the SAME rendering register as the world (Scott: "good enough" —
approved direction, not final art).

**(2026-07-20, later-7) BOOT BACKDROP FINAL FORM: layered matte descent —
the film is GONE.** Scott rejected film v3 too ("a weird mass growing up
out of itself from the ground") and asked to rethink the loading screen
altogether. Diagnosis: video models cannot hold a descent — three takes
failed the same way — while (a) the concept STILLS were consistently
excellent and (b) the old painted descent's choreography (city translating
down through clouds, tied to real progress) was correct and only its flat
Canvas2D rectangles read "8-bit". So the backdrop is now a 2.5D layered
matte: three generated stills (soul_cinematic, Dawn-Bride palette) vendored
as ~240 KB of WebP in apps/web/public/intro — `descent-sky.webp` (pre-dawn
plate with plain + silver river), `descent-city.webp` (golden tiered city,
Higgsfield image_background_remover cutout with alpha), `descent-cloud.webp`
(luminous band on black, edges feathered in prep, screen-composited so the
plate vanishes). BootUI.installLayers() decodes all three then drawScene
switches from the painting; layerGeom() seats the city's measured alpha-bbox
base (fraction 0.6867) on the plate's horizon (0.573) and translates it down
with easeInOutCubic(displayP); glory halo/rays, front cloud band thinning as
it settles, light pooling on the plain, motes/verses/stones/dissolve all
unchanged. Painting remains the fail-soft fallback and the only ?rite=0 /
asset-failure path (probes fetch no boot assets). nj-descent.mp4 deleted
(9 MB → 240 KB). Tools committed: `tools/intro-assets.ts` (bbox measure +
WebP encode + edge feather via chrome-channel canvas), `tools/boot-shots.ts`
(timed screenshots through a real rite boot). Verified: tsc, vite build,
probe-bootui + probe-bootrite ALL PASS, all 7 standing suites ALL PASS,
boot-shots stills clean at 2/6/14/25/40 s (first take had hard vertical
sky seams = cloud sprite edges under 'screen'; fixed by the 10% feather).

**(2026-07-19, later-6) POLISH PASS: z-fight fix, boot film, mute/controls
UI.** PR #31 (the M3.6 population branch) merged to main. Then, on
`claude/world-polish-pass`, four user-reported items:

- **City-wide stripe flicker FIXED (z-fighting, not shadows).** User
  screenshot showed banded stripes crawling on the terrace pavements.
  An `?ablate=shadows` still proved the shadow stack innocent: every
  tier-top plane had 2+ coplanar top faces (interior core / plinth /
  wall segments / gate jambs all ended exactly at yTop = the cornice
  slab's top). CityMassing now gives every pavement plane ONE owner:
  structural boxes stop at the cornice underside (CORNICE_T); on the
  crown the cornice drops 0.15 local so the sea-of-glass crown mesh owns
  the summit. No cityCollide floor moved; verified by stills (terrace-2,
  summit, ZEBULUN wall-top). KNOWN DEBT, separate mechanism: cloud-edge
  speckle in motion is the half-res jittered cloud march showing through
  TRAA history rejection — a real fix is a dedicated cloud reprojection
  pass, not attempted here.
- **Boot rite cinematic.** The painted descent read as amateurish (user);
  a vendored 12 s Seedance 2.0 film (apps/web/public/intro/nj-descent.mp4,
  silent 1080p, generate-offline-and-vendor posture) now fades in as the
  backdrop. Painting stays as fail-soft fallback and the only path for
  ?rite=0 tooling + reduced motion. Overlays (verses/stones/dissolve) and
  the motes/lamp canvas unchanged on top.
- **Mute + controls discoverability.** The M mute existed but was
  invisible. New `src/core/ControlsUI.ts`: bottom-left chip cluster —
  SOUND ON/OFF (drives Ambience, preference persisted in localStorage
  `laas-muted`) and KEYS (or H) opening a compact key card. Ambience
  gained isMuted/onMuteChange. Nav panel footer updated.

Scott-only follow-ups: judge the film in situ (loop has a hard cut at
12 s — could crossfade or regenerate longer if it bothers), walk-feel
passes still owed from later-5.

**RESOLVED (2026-07-19 late): boot-film art direction → 6 Dawn Bride.**
Scott picked direction 6 (Dawn Bride) from the 3x3 board, with 9
(Star-Woven) as declared fallback. Film v3 regenerated via Seedance
2.0 (1080p std, 12 s, silent, 16:9) from the direction-6 concept
still alone and swapped into apps/web/public/intro/nj-descent.mp4 —
no code change. Learnings: a first 1080p take that included the two
engine reference stills regressed to the literal engine render
(summit orb returned, camera pushed in until the city filled the
frame) — for stylized directions, reference ONLY the concept still.
Also `quality:"1080p"` is silently ignored by generate_video; the
correct param is `resolution:"1080p"` (a 54-credit 720p job is the
tell — 1080p costs 108). Frame-QA'd via the chrome-channel Playwright
recipe (style holds all 12 s, no orb, veil-of-light descent beats at
0-6 s); full-rite headless boot verified post-swap (56.6 s, painted
fallback path). Unused takes (2x Parted Veil, 1x orbed Dawn Bride)
remain in Higgsfield history. v1/v2 films in git history (827d211,
b906c8a).

**(2026-07-18, later-5) POPULATION FIRST PASS BUILT (M3.6) — the city is
no longer empty.** The settled RENDERING-DECISIONS #3 rendering lands on
the engine under ADR 0011 (population policy) and ADR 0010 (aniconic
divine persons, untouched): 12,712 white-robed faceless figures with
raised palm branches (Rev 7:9, `great-multitude`) stand in 40 worship
assemblies — sixteen on the street-of-gold plaza ring, twenty-four on the
tier 1-3 terrace-top cornice pavements — every figure facing the summit
light; 48 abstract light-pillar hosts (Rev 5:11, `myriads-of-angels` —
the entry #3 citation; the handoff's `angels-around-throne` slug is Rev
7:11, so the Rev 5:11 slug was wired instead) ring the summit in twelve
clusters, slowly rising and falling. The four living creatures and the
twenty-four elders stay OMITTED per ADR 0011 rule 4.

- `src/nj/populationModel.ts` (CPU-pure): every placement derives from
  the cityModel owner tables and stands EXACTLY on a
  `cityCollide.cityFloorLocalY` floor (probe-asserted for all 12,712);
  assemblies clear the gate corridors and the river meridian; host
  clusters are stationed OFF the four cardinal meridians at (i+0.5)·30°
  so a glory-bound ray down an approach axis never enters a host volume
  first (probe invariant). Deterministic fixed-seed sunflower spirals —
  independent of ?seed, so probes and stills are stable.
- `src/nj/Population.ts`: plain InstancedMesh (the CityMassing static
  path, NOT the scatter system) — three draws for the whole multitude
  (robe/head/palm share one transform set; per-instance warm-tone/scale
  variation via slotHash implies "every nation" without depicting
  anyone), two for the hosts (core+halo; rise/fall is a shader-time
  positionNode bob — no CPU per-instance updates). Bloom contract holds:
  worst population emissive luminance 1.31 < 1.5 (probe-asserted
  constants); only crown + glory still cross.
- Picks/HUD: zone-level volumes per assembly (`great-multitude`,
  priority 2 — beats the street slab underfoot, yields to gates) and per
  host cluster (`myriads-of-angels`); walking into an assembly
  auto-surfaces the card; gate-corridor/plaza/glory pick behavior
  regression-guarded.
- VERIFIED: new `tools/probe-population.ts` 13/13 (floors, clearances,
  bloom, pick integration); battery entitypick ALL PASS (now includes the
  two new slug-citation checks), cityfloors 11/11, walkfling 8/8,
  wallcollide 19/19, navigation 11/11, arrival 11/11, entityhud-live
  17/17, tsc clean, vite build clean. Live hook check on the dev server:
  `__laas.entityPick` resolves `great-multitude` over an assembly and
  both new entity JSONs fetch 200. Stills (shots/wip/population-*.png):
  plaza crowd against the south wall, terrace-ring congregation,
  host-ring approach (luminous pillars flanking the glory, no bloom),
  summit + spawn regressions clean. Engine re-vendored.
- Debts: figures are statically posed (no idle sway — motion would need
  a positionNode idiom that respects the CSM casters; deferred); crowd
  contrast on the pale terrace pavements is soft in flat light; no
  multitude on the crown (deliberate — the sea of glass stays clear
  before the throne); nations/pilgrimage dynamism is M4.4, not this pass.

**(2026-07-18) VIEWPORT-RESIZE "Destroyed texture" RACE ROOT-CAUSED AND
FIXED — the uncommitted resizeprobe investigation closed.** Resizing the
browser window with the NJ scene up raised Dawn validation errors
(`Destroyed texture ... used in a submit`, encoder `renderContext_6`) —
dropped frames on every user window resize/maximize. The dirty-tree
`?resizeprobe=` ablation slice (city/river/transmission/allotment) was
finished into `tools/probe-resize.ts` (parametrized `--ablate`/`--cycles`,
plus a `--diag` mode that patches createTexture/createBindGroup/submit
before boot, labels textures by creating stack, and error-scopes every
submit). The bisect matrix pinned TRANSMISSION as the owner (baseline
FAIL; river-ablated FAIL; transmission-ablated PASS), and --diag traced
the full mechanism in the pinned three 0.184:

- `ViewportTextureNode.updateBefore` resizes the transmission backdrop
  FramebufferTexture IN-PLACE, MID-PASS (inside the scene pass's
  copyFramebufferToTexture; `Textures.js:208` destroys the old GPU
  texture) — the scene encoder already references it, so its own submit
  fails.
- Worse, the stale references NEVER converge: the backdrop's shared
  `NodeSampledTexture` binding syncs version/generation at the FIRST
  group that updates, and `Bindings._update`'s generation check is gated
  behind `updated` (`Bindings.js:303`) — every other bind group keeps GPU
  views of the destroyed texture forever.
- Two rarely-drawn transmissive meshes dodge even that: `_renderObjectDirect`
  gates binding updates behind `_nodes.needsRefresh` (`Renderer.js:3535`),
  so NodeMaterialObserver-static objects draw WITHOUT updateForRender —
  traced live via --diag STALE-DRAW instrumentation (bg64/bg72, epoch 0
  at draw time).
- And `createBindings`' (cacheIndex, version-sum) cache can REVIVE purged
  groups: the sum is non-monotonic when a binding's texture reference
  swaps objects (`WebGPUBindingUtils.js:155`).

Fix (`src/render/ThreePatches.ts`, installed from `Engine.create`, all
scoped to `isFramebufferTexture` — RT resizes and normal disposals keep
exact timing): (1) `resizeFramebufferTextures` — the window-resize
listener pre-sizes + disposes + version-bumps every live viewport
framebuffer texture BETWEEN frames and bumps a global resize epoch;
(2) `installDeferredFramebufferDestroy` — raw GPUTexture.destroy calls
defer 16 frames, drained from the frame loop; (3)
`installFramebufferBindingRefresh` — any bind group that has EVER sampled
a framebuffer texture (tag on the wrapper) is force-rebuilt once per
epoch, textures re-initialized first and the version cache purged, at
BOTH seams: `Bindings._update` AND `backend.draw` (the only unconditional
per-draw hook — catches observer-static objects). VERIFIED: probe-resize
baseline FAILED pre-fix (1-8 errors/run), now 5 consecutive PASS runs
including `--cycles 6` (12 resizes); tsc clean; vite build clean;
navigation 11/11, arrival 11/11, walkfling 8/8, wallcollide 19/19; spawn
hero framing visually intact (shots/wip/resizefix-spawn.png). Engine
re-vendored into `apps/web/public/laas`. Durable API gotchas recorded in
`docs/THREE-NOTES.md`. The `?resizeprobe=` ablations stay in nj/ code,
documented as probe-only diagnostics (consumed by `--ablate`).

**(2026-07-18, later-4) PROXIMITY AUTO-CARDS BUILT — the legacy HUD's
nearby-entity behavior lands on the engine, walk-mode only.** Walking
near a grounded structure now surfaces its descriptor card without a
click: `entityPicks.nearestEntityAt` (distance flavor of the pick
registry — smallest distance wins, 5 m priority tie for co-located
volumes) drives a new `hooks.entityNear`, and EntityHud polls it at
~3 Hz. Contract: WALK MODE ONLY (programmatic poses always force fly, so
probes/shots never see an unclicked card, and 2000 m/s flight never
flickers); a clicked card is PINNED (chip in the header) and proximity
never replaces it; Escape/✕/miss-click latches the current label off
until the walker nears something else (labels, not slugs, are the key —
twelve gates share a slug). The arrival meadow spawn is outside every
trigger radius, so first-walk stays clean. VERIFIED: probe-entitypick
now 37/37 (N1-N5 proximity cases — gate-over-street tie, street at eye
height, tree, meadow null, wading the river); probe-entityhud-live now
17/17 (C1 no card in fly mode beside a gate, C2 V-into-walk
auto-surfaces "Zebulun Gate · S", C3 unpinned, C4 Escape latch holds).
Full battery: navigation 11/11, arrival 11/11, walkfling 8/8,
wallcollide 19/19, cityfloors 11/11, tsc clean, build clean. Engine
re-vendored. M3.4's remaining engine-side gap is now only the campus
pick (blocked on Track A) — the in-scene symbolic visual key (M3.5)
stays open.

**(2026-07-18, later-3) GATE INSCRIPTIONS BUILT — the tribe names are
legible in-scene (Rev 21:12; wayfinding floor, CITY-QUALITY-BAR).** Each
gate carries its tribe's name in gold serif capitals on the ivory cornice
fascia directly over the opening — the classical entablature-frieze
position (the first placement attempt sat the plaque INSIDE the cornice
slab, y 13.6..16 at half+2.5; an opaque-quad bisect shot exposed the
burial). The inscription's existence is cited content (Rev 21:12 "on the
gates the names of the twelve tribes... were inscribed"; side order Ezek
48:30-34 per RENDERING-DECISIONS #2); the applied-gold serif treatment is
art direction. Zero assets: one runtime Canvas2D atlas (BootUI
precedent), one alpha-cutout material, one merged 12-quad mesh — a
single draw; emissive 0.4 stays far under the 1.5 bloom threshold.
LIVE-VERIFIED (shots/wip/inscription-close2/-approach/-corner.png):
ZEBULUN reads on the frieze point-blank and from the ~700 m approach
without bloom; the SE-corner framing shows south + east faces with
correctly-oriented (unmirrored) text and the gem courses undisturbed.
Battery: wallcollide 19/19, entitypick 32/32, cityfloors 11/11,
walkfling 8/8, tsc clean, build clean. Engine re-vendored. Compass-side
identification continues to come from the click card ("Zebulun Gate · S")
and the navigation panel.

**(2026-07-18, later-2) WALKABLE CITY FLOORS BUILT — the "plaza slab and
terrace pavements are not walk floors" debt (declared in cityCollide's own
header since the collision pass) is closed.** A walker now steps up
through a gate onto the street of gold and walks INSIDE the city; the
plinth top, every terrace-top cornice ring, and the crown top (sea of
glass) are real standing surfaces in walk mode.

- `cityCollide.cityFloorLocalY` + `wrapGroundProbeWithCityFloors`: floors
  derive from the SAME tables as geometry and lateral collision
  (CITY_TIERS/cityTierBottoms/PLINTH_HALF/CITY_SUMMIT_Y; slab margin
  covers the gate corridors). Composed onto the scene groundProbe AFTER
  the river + campus wraps with the river wrap's y-aware claim idiom:
  a floor claims only when its top is within FLOOR_STEP_UP_M (3.5 m) of
  the querying feet — the 2.8 m meadow→plaza step is walkable, an 840 m
  terrace overhang never grabs a plaza-level walker, and legacy no-y
  callers claim the slab only. Water passes through untouched (the wade
  channel still crosses the plaza; the crown basin still claims from
  above).
- VERIFIED: new `tools/probe-cityfloors.ts` (CPU, real FlyCamera + real
  river+floors wraps in scene order) 11/11 — meadow holds outside the
  slab, street-of-gold standing inside, tier-1 cornice walkable, y-cap
  discipline both directions, crown floor under the basin claim, no-y
  slab-only, and a 1500-frame gate-corridor walk that steps up exactly
  2.8 m with no fling. `probe-walkfling-live` rerun on REAL hardware:
  ALL PASS across A/B/C/D — its live-derived expectations follow the
  composed probe by design (corridor entries now land ON the street at
  485.55 m — previously wading under the slab at ~482.8; C1 stands ON
  the crown at 3611.30). Full battery: walkfling 8/8, wallcollide 19/19,
  navigation 11/11, arrival 11/11, entitypick 32/32, tsc clean, build
  clean. Engine re-vendored.
- Debts: no stairs/ramps between floors (terraces reachable by flight
  only — step-free ascent is future content); interior plaza/wall
  dressing at walking range is thin (CITY-QUALITY-BAR pillar A applies
  inside the wall too — shots/wip/cityfloors-plaza.png shows the flat
  interior read); dwellings/temple floors and collision remain open.

**(2026-07-18, later) CITATION HUD + CLICK-PICKING BUILT — M3.4's core
promise ("geometry that footnotes itself") lands on /world-preview.**
Clicking a rendered structure now surfaces its canonical dataset entity:
descriptor statements, confidence-tier badges (clear/fuzzy/debated/
symbolic), Scripture/Willis citation chips, and the symbolic referent
where the tier demands one. Content comes EXCLUSIVELY from the same
per-entity JSON exports the apps/web browse UI consumes
(`/data/entities/<slug>.json`, tracked via git add -f like /laas) — zero
descriptor text authored in engine source.

- `src/nj/entityPicks.ts` (scene-owned, CPU-pure): analytic pick volumes
  derived from the shared owner tables — GATES (twelve tribe+compass
  labels, Ezek 48:30-34), `foundationCourseSpans()` (the SAME gate-notched
  spans geometry/collision consume — the first probe draft used un-notched
  bands and the contract probe caught the drift), CITY_TIERS/PLINTH_HALF/
  cityTierBottoms, riverReaches(), the new `treeOfLifeModel.ts` station
  table (extracted from TreesOfLife so probes import no vegetation), and
  the measured `ezt-precinct-side` 500-cubit temple square. Resolver:
  nearest ray entry with a 25 m priority tie window (gate beats wall on
  the shared face), base-terrain occlusion march. Picks: gates,
  foundation gems, jasper wall, tiers/plinth, street of gold, river
  reaches, trees of life, summit throne/glory sphere, sea of glass,
  temple compound (zone-level, `sanctuary-in-the-midst`).
  DELIBERATELY UNPICKABLE: the dwelling campus — no canonical Ezek
  45:4-5 zone entity exists yet and inventing one is forbidden; wire it
  after Track A seeds the allotment entities. Zone-citation guardrails
  (RENDERING-DECISIONS #7/#8) hold: nothing anchors to an individual
  house/hedge/well.
- `src/core/EntityHud.ts`: the card (NavigationUI DOM idiom, z 1050,
  bottom-centre, visually subordinate). Canvas click → NDC →
  `hooks.entityPick` (new, installed by the NJ scene; the tooling surface
  probes drive). Card: eyebrow label ("Issachar Gate · S"), entity name,
  per-descriptor tier badge + citation chips (display grammar ported from
  the legacy DescriptorHud, golden-tested), statement, symbolic referent,
  "+N more" past 3 cards, open-in-browse link, Escape/✕/empty-click
  dismissal. Mouse-steer is mousemove-based so clicks never turn the
  camera (live-verified Δyaw 0.0000).
- Data path: root-absolute `/data/...` fetch — same-origin in prod (the
  engine iframe lives under apps/web) and in standalone dev via a NEW
  dev-only vite `publicDir: ../web/public` (build unaffected:
  publicDir=false).
- VERIFIED: `tools/probe-entitypick.ts` (CPU, no GPU/server) 32/32 —
  table shape (Ezekiel gate order, ESV gem order incl. notches, reach
  count, measured precinct), 12 authored-ray resolver cases incl.
  occlusion + sky, EVERY registry slug exists as a cited canonical export
  (symbolic ⇒ referent), citation-grammar goldens.
  `tools/probe-entityhud-live.ts` (real adapter) 13/13 — contract picks
  via setPose exact placement, card DOM (name/tier/citation/statement/
  link), no-steer, both dismissals; standing capture
  shots/wip/entityhud-gate.png. Full regression matrix: navigation
  11/11, arrival 11/11, walkfling 8/8, wallcollide 19/19, tsc clean,
  vite build clean. Engine re-vendored into apps/web/public/laas.
- Debts: proximity auto-card (legacy parity) not built — click-only by
  design this pass; in-scene literal-vs-symbolic visual key (M3.5
  remainder) still open; the open-link 404s on the standalone dev server
  (no Next routes there — prod/iframe correct); campus pick pending
  Track A.

**(2026-07-13) LARGE-WORLD NAVIGATION BUILT — M3.3 mini-map/click-travel gap
closed.** The existing camera already supported `V`, mouse-wheel fly speed,
Shift boost, and hidden numbered bookmarks, but users had no visible way to
discover or combine them. This pass makes large-scale travel a first-class
surface without introducing a second camera controller:

- `src/core/NavigationUI.ts`: a persistent top-right mode/speed pill and an
  `N` panel with walk/fly controls, stepped speed, auto-cruise, coordinates +
  compass heading, an interactive world map, concise controls help, and
  distance-ranked quick-travel rows. The panel is keyboard-accessible,
  responsive, reduced-motion-safe, and stays off the render canvas so mouse
  steering stops naturally while the user operates it.
- `FlyCamera.ts` remains the one movement owner. Ground travel now steps
  1x/2x/4x/8x (4.6-36.8 m/s before Shift); flight steps
  4/12/24/60/150/400/1000/2000 m/s, with the existing wheel fine control and
  6x Shift boost. `C` toggles auto-cruise, Escape or reverse cancels it,
  Space/Ctrl provide familiar fly up/down controls alongside E/Q, and `[`/`]`
  adjust the active mode's speed. Programmatic poses still switch to fly and
  now cancel cruise, so bookmarks, probes, quick travel, and the arrival
  cinematic retain exact-placement semantics.
- Navigation data is scene-owned through `hooks.navigationTargets` and
  `navigationMap`. Wild terrain exposes its nine composed viewpoints. New
  Jerusalem overrides them with six authored destinations: arrival meadow,
  Zebulun gate, city overview, summit, temple east approach, and priests'
  campus. Factual labels display Scripture citations; illustrative treatment
  is named as such. Ground targets read the FINAL composed ground probe, and
  map clicks enter fly mode at a scene-supplied safe height; clicks over the
  city clear `CITY_SUMMIT_Y` rather than materializing inside a stacked tier.
- Verification: new CPU-only `tools/probe-navigation.ts` **11/11 PASS**
  (speed steps/clamps, `V`, cruise/cancel, vertical flight, 8x ground clamp,
  quick-travel cruise cancellation). Regression matrix: arrival **11/11**,
  walker/river fling **8/8**, wall/gate collision **19/19**, `tsc --noEmit`
  clean, production `vite build` clean. Live Chromium/WebGPU pass confirmed
  the panel, map, cited destinations, walk/fly transition, and 24->60 m/s
  control; horizontal overflow found in that pass was fixed and rechecked.
  Engine re-vendored into `apps/web/public/laas`.

**(2026-07-02) M3 CITY MATERIAL/GEOMETRY PASS — CITY-QUALITY-BAR #1/#3/#5/#7.**
The flat-box city is gone. What landed (branch `claude/m3-city-material-pass`,
one commit per step, every step live-verified via `tools/shoot.ts`):

- **Shared massing table**: `cityModel.CITY_TIERS` is the single source of
  truth; `CityMassing` geometry and `RiverOfLife` reaches both consume it
  (the hand-mirrored TIERS copy and its desync risk are gone).
- **Engine plumbing**: `TerrainScene` stashes `gi` (ProbeGI), `canopyTex`
  and `vegLib` on the engine (same idiom as `heightfield`/`sunSky`) — city
  materials opt into probe GI; the trees of life reuse the baked bark/atlas.
- **Glass tiers (#1/#3)**: tier faces are translucent gold glass —
  `MeshPhysicalNodeMaterial` transmission (VERIFIED working on WebGPU 0.184:
  RenderList auto-routes transmission>0 to the transparent list, mid-pass
  framebuffer copy + mip chain, `getIBLVolumeRefraction` backdrop) over an
  opaque emissive "interior" core the refraction parallaxes, with an
  emissive mullion grid of small ARCHED panes (USER-REFS directive #1).
  Kit-bash relief is instanced real geometry (plain `InstancedMesh`, the
  sanctioned static path — NOT the scatter system): voussoir arch frames,
  fluted piers, gold dentil courses, ivory cornice slabs, gold-on-ivory
  arcade courses at every setback. Bloom contract kept: base tier under the
  1.5 threshold, only crown + glory cross.
- **Wall & foundations (#2 upgrade)**: wall segments are crystal-jasper
  (Rev 21:18); the twelve foundation courses are faceted gem volumes
  (deterministic vertex jitter → flat facet normals; transmission 0.75 +
  dispersion 0.25; stylised hues per ADR 0009 r2); pearl gate heads have
  nacre iridescence + a voussoir ring.
- **Trees of life (#5)**: `TreesOfLife.ts` — four unique hero variants of a
  beech-derived species through the real pipeline (`buildTree` hybrid,
  meshAnchorTarget 1200), twelve WORLD-SPACE placements flanking the
  approach reach (never under the ×20 allot group), wind wired into
  positionNode/castShadowPositionNode, probe-GI parity, card shadow-alpha
  contract, instanced glowing fruit at real skeleton anchors, same-skeleton
  lod-1 twins beyond 220 m. Fruit is rigid (spheres carry no vdata) —
  pulled 0.92 crown-inward to mask sway drift.
- **Crystal river (#7)**: `CrystalWater.ts` — purpose-built materials
  copying WaterMaterial's proven idioms (viewport refraction + depth-leak
  guard, Beer–Lambert at ~0.15× SIGMA, 18-step SSR, flattened-normal
  fresnel, two-phase advection) with AUTHORED per-reach flow (hydrology is
  untouched — its cliff-cut kernel cannot express falls, and the plaza
  reach rides above the heightfield). Reaches are top-surface planes over
  opaque gold beds carrying an authored-depth caustic pass
  (`causticContext()` reuse); tier cascades are downward-advected ribbon
  sheets; `riverSurfaceLocalY` wraps the scene groundProbe so the walker's
  eye can't cross the authored water. The wall cascade sheets over the
  jewelled foundation course; relief courses skip the river's meridian.
- **Summit (RENDERING-DECISIONS #4, now IMPLEMENTED in this engine)**:
  full-spectrum rainbow ring with emerald prominence around the glory
  (Rev 4:3) + reflective sea-of-glass disc on the crown top (Rev 4:6).

**Live verification (tools/shoot.ts, shots/wip/m3-*)**: south establishing
(0,1000,5200) — arch bays/piers/ivory bands/arcades read as the
width-comparison reference language; gate level (0,530,2750) — relief +
mullion lattice hold up close; spawn (350,482,4150) — hero composition with
real trees; summit (500,3950,1500) — rainbow ring + sea of glass verified.
`tsc --noEmit` clean throughout. Known pre-existing console warning
(`Vertex attribute "normal" not found`) appears in the pre-pass baseline
shot too — not introduced by this work.

**Polish round (2026-07-02, late) — two debts closed, live-verified:**
- **Gem facets FIXED**: facet pitch was ~140 m (len/7 segments) — read as a
  smooth wavy strip. Now ~44 m facets (len/2.2, 3×3 cross-sections), tighter
  jitter, transmission 0.75→0.6, emissive 0.7→0.4 so per-facet shading
  survives. Verified at the 150 m oblique (shots/wip/m3-polish-gems2.png):
  distinct cut faces with per-plane light variation.
- **Issachar (south-centre) gate RE-JUDGED — pass, with a composition note:**
  the river deliberately owns that slot (RENDERING-DECISIONS #1 cascade →
  approach). Head-on (shots/wip/m3-polish-issachar.png) the wall cascade
  pours from a pearl-crowned mouth at the wall top into the plunge pool and
  channel; the gate opening behind it is not enterable — by design, entry is
  via the flanking Simeon/Zebulun gates. No geometry bug. Fall streak
  texture verified at close range in the same shots.

**Remaining polish debts**: glass panes read best front-lit (judge shaded
faces at other ToD — shoot.ts ALREADY forwards `--T N` and any unconsumed
flag as raw page params, e.g. `--edit 1`; the earlier "needs a passthrough"
note was stale); arcade glow panes could use per-course hue drift. Backlog
(plateau rim cliffs, allotment zone map, dwellings/temple identity)
unchanged below.

**(2026-07-02, late-2) ALLOTMENT ZONE MAP — queued item 3 BUILT.**
Managed planting on the plateau top through the engine's own systems
(USER-REFS directive #3; ADR 0015 decision 4's promised milestone).
`src/world/ZoneField.ts` is an analytic land-use function — 260×200 m
plot grid hashed per-plot into crop/orchard/fallow, belts choosing the
mix, worn lanes on plot borders, a hashed hedgerow subset (hedging
every edge reads as a waffle and blows the understory cap), mown-park
rects, pond keep-clear — built as a TSL graph and carried on
`PlateauParams.zones` (`src/nj/allotmentZones.ts` holds the authored
numbers: crop belts flanking the city per Ezek 48:18-19 / the Ezek
45/48 schematic, an orchard-heavy Zadok band toward the dwelling
campus, the approach corridor as mown lawn). Terrain synthesis never
reads zones — ground does not move, so heightfield/erosion/hydrology
are untouched. Consumers, each behind a literal `if (…zones)` JS guard
(wild scenes compile bit-identical; bm4 regression verified — NOTE
capture PNGs are never hash-identical across runs, clouds/TRAA/
exposure state differ; judge structurally via tools/compare.ts):
- Scatter: orchard plots plant even-aged rows on a snapped lattice
  (exact one-candidate-per-lattice-point dedup via cell containment;
  domain thinning BYPASSED in managed zones so rows cannot gap;
  species split per plot beech/birch so each impostor pool's 49k
  compact region holds at aerial framings); hedgerows override the
  understory to a near-continuous hazel/juniper band (streambed
  idiom); wild trees/deadfall/stones suppressed on worked land.
  Counters: 304k trees / 356k under / 37k extras / 347k stones — all
  inside caps (pcg2d hash extracted to `gpu/passes/CellHash.ts` so
  ZoneField and Scatter share it without an import cycle).
- GroundRing: crop plots stand as dense tall per-plot-tinted sward
  with 3.4 m row striping; the lawn mows short and fresh; lanes tread
  thin and dry; debris keeps off tended ground; the g3 far band
  matches so the handoff does not pop.
- TerrainMaterial: same palette + stripe phase tint the splat (near
  tiles AND far shell) — the layer that carries the field mosaic at
  aerial range — plus packed-earth lane lines and dark hedgerow
  border lines.
LIVE-VERIFIED (shots/wip/zone1-*, zone2-*): aerial mosaic with dotted
orchard rows, lane grid and pond (zone2-aerial); spawn hero
composition unchanged (mown processional lawn with specimen trees);
crop stand / worn lane / orchard rows / hedge wall at walking height
(zone1-field, zone2-orchard). Debts: hedge border lines still subtle
at high aerial; park lawn keeps some dry scruff (tune the blade dryK
park suppression if judged); orchard rows loosen at oblique angles
(±0.8 m planting slack — tighten if judged).

**(2026-07-02, late-3) TEMPLE PoC — SCRIPTURE-AS-DATA BEGINS (queued item
4 BUILT).** The full program from the plan's §4 answers landed in one
pass:
- **ADR 0017** (Scripture as grounding data): measurements are a
  first-class record type in the canonical store — text-native values
  (cubits/reeds/spans, never meters), stable slug ids that geometry
  references directly, same citation/tier/review discipline as
  descriptors. **ADR 0018** (units/scale): LONG_CUBIT_M = 0.525; the
  temple renders LITERAL ×1 (small/viewable); the city keeps ADR 0014's
  viewable scale — the scale disparity is deliberate and documented.
- **Dataset**: 88 measurement records for Ezek 40-42 + the 43:13-17
  altar, hand-authored against the ESV API text (fetched to scratchpad,
  never stored — ADR 0006), adversarially verified by a 5-agent panel
  (79/81 first pass; a mistiered LXX reading and a wrong span basis
  fixed; completeness sweep added 7 records). Seeded approved into
  data/canonical.sqlite via the new `far-country measure seed-temple`
  (+ migration 0003, Measurement/MeasurementCitation models); exports:
  measurements.json + the GENERATED `src/nj/templeMeasurements.gen.ts`
  (`far-country measure export` regenerates both — the vendoring flow).
  Source of truth in git: `pipeline/src/far_country/measure/temple.py`.
  All 151 pipeline tests pass. Text-critical calls documented in-record:
  ESV's LXX readings (40:48-49; 41:3; 41:22; 42:4) tiered fuzzy; the
  42:16-20 cubits-vs-reeds dispute tiered DEBATED, rendered per ESV
  (500 cubits — which closes the survey's own E-W arithmetic
  50+100+50+100+100+100 = 500 exactly).
- **RENDERING-DECISIONS #6** (Ezekiel/John city harmonization: dataset
  stays debated, render follows Willis) and **#7** (temple render: ESV
  readings at disputed points; interpretive heights incl. the 1 Kgs 6:2
  ~30-cubit house walls; red sandstone/crenellations/corner towers as
  USER-REFS #5 art direction; literal dimensions on compressed
  placeholder placement).
- **Temple rebuilt** (`src/nj/Temple.ts` + `templeModel.ts` resolver;
  delta #8): world-space at (0, -5600) — inside the detailed ring and
  the campus scatter exclusion, on a plinth, old ×20 gold placeholder
  removed, dwelling grid clears the temple close. Gates/courts/house/
  altar/chambers/west building all measurement-driven. LIVE-VERIFIED
  (shots/wip/temple1-*): the USER-REFS temple-complex-wide composition
  (red fortified compound, gold city rising behind) reads at
  (0,520,-6050,3.1416,-0.03,60); east elevation with glowing gate
  portal at (380,492,-5600,1.5708,0,62); plan correct from overhead.
  tsc clean; nj/-only changes (no shared engine files → wild scenes
  structurally unaffected by construction).
- **Debts**: sandstone is flat-shaded v1 (needs macro/meso variation to
  meet "nothing is bare" within 20 m — polish with dwelling pass);
  Ezek 47 river from under the threshold deferred to roadmap M4
  (noted in entry #7); the 240 m dwelling megaboxes now VISIBLY dwarf
  the literal-scale temple — queued item 5 (dwelling variation +
  right-scaling) is the direct fix and next in line.

**(2026-07-02, late-4) DWELLING CAMPUS REBUILT — delta #6 (queued item 5).**
The 82 identical ×20-frame megaboxes (680×440×240 m each — they dwarfed the
literal-cubit temple) are GONE from `Allotment.ts`. `src/nj/Dwellings.ts`
builds the campus in WORLD SPACE at human scale (RENDERING-DECISIONS **#8**
— new entry: cited zone, illustrative content; two named bands honouring
Ezek 45:4-5 / 48:10-14's structure, all dimensions explicitly art
direction):
- **Priests' (Zadok) band**: continuous 108 m garden-court blocks on a
  150 m pitch (7 rows, z -5021..-6029 — ENTIRELY inside the heightfield CPU
  mirror so every house snaps exactly to rendered ground) flanking the
  temple. Attached row-house perimeters (5.5-13 m units, stepped facades +
  rooflines, 25% two-story), hip-roofed corner houses, gate gaps with stone
  posts, court wells, timber doors + warm window panes RECESSED inside open
  trim frames (pillar-A reveal, not a decal; glow 1.05 — bloom contract
  kept). 3 wall pools (limewash/sandstone/whitewash) × 2 clay roof pools;
  deterministic per-cell hash; temple close + east processional + a meridian
  lane on the city→temple axis cleared by construction.
- **Levites' band**: beyond the detailed ring (rows z -6450..-10050) the
  only rendered ground is the far shell (analytic macro MINUS 2.5 m on a
  coarse 160×42 ring — ±2-3 m chord error between vertices). Blocks there
  are RING-SLAB podium footings (temple-plinth idiom, mitered stone bands
  whose skirts absorb the approximation) carrying simplified sand-heavy
  house runs + 2.2 m hedges around REAL shell-meadow courts. Sites come
  from a one-shot GPU eval of `macroTerrain(p, hf.mp, 'far')` on a 512×192
  grid (HeightSynthesis idiom + readback) — never `heightAtCpu`, which
  clamps at ±6144. `ctx.hooks.groundProbe` is wrapped (river-guard idiom)
  so walk/fly grounding follows the shell across the band.
- **Engine discipline**: plain InstancedMesh kit (CityMassing idiom),
  chunked into column groups (~90 meshes) so bounding spheres stay local
  for main + CSM culling; only priests'-band bodies/roofs cast shadows.
  nj/-only change (Dwellings.ts new; Allotment.ts megaboxes removed;
  NewJerusalemScene.ts wiring + campus exclusion rect tightened to
  [-6150,6150,-10400,-4950]). tsc clean.
- **Design process**: a 3-lens adversarial panel (scale/engine/doctrine)
  ran BEFORE implementation and reshaped it — caught the far-shell -2.5 m
  sink + chord error (would have floated every far-band house), the ~3%
  built-coverage sparseness of the first layout, single-sphere culling
  waste, and the missing RENDERING-DECISIONS entry; a solid-frame-box bug
  (frames occluding every door/window plate) was caught by the court
  ground-level shot and fixed with a true open-ring frame geometry.
- **LIVE-VERIFIED** (shots/wip/dw1-*, dw2-*, dw3-*): temple-wide regression
  framing (0,520,-6050) now shows the temple DOMINANT among human-scale
  rooftops (the scale inversion this item existed to fix); NE 3/4 aerial
  (900,700,-6650,2.43,-0.28,55) = dense ordered court grid around the clear
  temple precinct; east processional eye-level (400,492.5,-5600,1.5708,0,62)
  = crenellated temple front over village rows; court interior
  (375,488,-5225,0.7854,0,62) = doors/panes/roof-steps at walking scale;
  north campus aerial (0,2800,-12500,3.1416,-0.35,55) = two-band ordered
  march toward temple + city; spawn hero framing unchanged.
- **Debts**: campus ground keeps the wild meadow's dark scrub/moisture
  veins (pre-existing splat character — a campus zone-tint through the
  ZoneField idiom is the queued polish); courts are pure lawn (no court
  trees — scatter is excluded there; instanced court orchards = polish);
  Levites'-band walkers ride the analytic shell mean (visual shell can
  deviate ±2-3 m between ring vertices — off-path, documented);
  allotment-strip measurements (Ezek 45:1-6; 48:8-22) NOT yet in the
  canonical store — the band split is explicitly uncited art direction
  until they are seeded and consumed per ADR 0017 (queued follow-up;
  entry #8 records the deferral).

**(2026-07-02, late-5) BUG REPORT — walk over the plateau edge flings the
walker skyward (Scott, deferred: "whenever it makes sense to safely
address"). FIXED 2026-07-03 — candidate 1 confirmed as the mechanism,
with a sharper shape than predicted; see the dated 2026-07-03 entry
below.** Symptom: walking past the plateau edge (beyond the world
limit?) casts the user violently upward "and all around," eventually
vacillating up and down HIGH above the city (screenshot: aerial from
roughly cloud height over the whole allotment; note it shows the
pre-rebuild megabox bundle, so it predates the late-4 deploy — the
mechanism is untouched by that work and presumed live). Code-grounded
candidates, ranked (walk mode has NO spring to explode — the eye is
hard-snapped to `max(ground + 1.7, water + 0.45)` per frame at
FlyCamera.ts:339-362, so a violent upward cast means the PROBE returned
a hugely higher floor):
1. The river-surface groundProbe wrap (NewJerusalemScene.ts, installed
   right after the allotment mounts) raises water to authored reach
   surfaces: `riverSurfaceLocalY(x/20, z/20) * 20 + plazaTopY`. Upper
   tier-cascade reaches sit at local y ≈ 150 → world ≈ 3.5 km — the
   reported "high above the city" altitude. If any reach rect's
   containment misfires for far-outside-the-allotment coordinates (the
   kind you only reach by walking over the edge), the wade floor
   teleports the walker there instantly; drifting in/out of the rect
   while airborne = the up/down vacillation. AUDIT
   `RiverOfLife.riverSurfaceLocalY` reach bounds first.
2. Beyond the CPU mirror (|x| or |z| > 6144) outside the campus rect,
   `heightAtCpu`/`waterYAtCpu` clamp to frozen edge-row texels — a wet
   or high edge texel pins a whole column's floor (the campus wrap fixed
   this for the Levites' band only; E/W plateau top and the wild fringe
   still ride frozen values while the rendered far shell diverges).
3. E/W/N plateau rims exist only in the far shell (ADR 0016), so the
   walkable probe never descends them — walking east/west off the
   plateau floats the walker at plateau height over the shell's 260 m
   cliff drop (float, not fling — but disorienting and adjacent).
Repro/probe plan for the fix session: drive the walker programmatically
over each rim compass direction (probe-mousesteer.ts is the trusted-input
template; or setPose + WASD key events), logging per frame the walker
position and BOTH probe components (base terrain vs each wrap's
contribution) to isolate which wrap injects the spike; then clamp reach
containment (and consider bounding every groundProbe wrap to its authored
footprint rect). Must be fixed before the arrival experience ships —
first-session walk feel is the whole point of that package. Fix belongs
to whichever next session touches walk physics, the probes, or the rim.

**(2026-07-03) WALKER-FLING BUG FIXED — stacked river reaches claimed at
any altitude (late-5 candidate 1, confirmed).** Root cause, sharper than
the "far-outside containment misfire" guess: `riverSurfaceLocalY` is a 2D
PLAN lookup over reaches that are vertically STACKED up the city tiers
(ledge pools at local y 16.18/58.18/96.18/130.18, crown basin 156.35 —
world ≈ 796/1636/2396/3076/3600 m). The lookup has no vertical sense, so a
walker at plaza level (~473 m) anywhere on the meridian corridor (|x| ≤
56 m world) inherited whatever reach owned that (x,z) in plan as a hard
wade floor, and FlyCamera's per-frame snap teleported them to it. NOT
confined to the city interior: the lowest ledge pool's rect (z local
85.2..102.6 → world 1704..2052, +0.4 margin) deliberately runs 60 m past
the wall line to meet the wall cascade — so WADING THE RIVER UP TO THE
WALL, the normal approach path, crossed into it at world z ≈ 2060 and
flung the eye 475 → 797 m; drifting between rects while airborne stepped
across pool heights up to 3.6 km (the reported "up and all around" +
vacillation). Fix (all four files small, nj-scoped semantics, wild scenes
behaviour-identical):
- `FlyCamera.GroundProbe` + `Hooks.groundProbe` gain an optional third
  param `y` = the querying eye's CURRENT height; FlyCamera passes it at
  all probe sites (walk, fly soft-collision, walk-entry snap).
- `riverSurfaceLocalY(lx, lz, maxSurfaceY?)`: a matched reach whose
  surface exceeds the cap returns −1e6 (unclaimed). Cap omitted =
  unchanged legacy behaviour.
- The scene's river wrap converts eye y → local cap with a 6 m
  wade-tunnel margin (`WATER_CLAIM_M` — covers wade clearance 0.45 m and
  fast-fall tunnelling ≈ 3.6 m/frame for a full 260 m rim fall at the
  30 fps dt floor). The campus far-ground wrap passes `y` through. Wrap
  chain order preserved (river first, campus composing it).
- VERIFIED via `tools/probe-walkfling.ts` (NEW, CPU-only — no browser/
  GPU/dev server: shims window/DOM, drives the REAL FlyCamera physics
  against the REAL reach table + a mirror of the scene wrap): pre-fix it
  reproduces the fling (walk-entry snap under the crown 471.7 → 3600.25 m;
  840 m single-frame jump between stacked pools on the approach; fly-mode
  shove 480 → 797 m); post-fix ALL PASS — approach wade floor 475.25
  intact, max per-frame |Δy| on the whole corridor 1.2 m (the authored
  channel→plunge-pool step), under-crown plaza walker stays 471.7,
  crown-top water STILL claims a walker standing on it (3600.25), fly
  soft-collision no longer shoved. `tsc --noEmit` clean; `vite build`
  clean; keep the tool's wrap copy in sync if the scene wrap changes.
- Session env note: fixed + verified in a cloud session (Linux, no
  usable GPU — SwiftShader adapter only, full NJ world-gen impractical),
  hence the CPU-sim verification path instead of a live shoot.ts probe.
  Interactive walk-feel re-check on real hardware still owed (Scott's
  pending verdict, plus first-walk feel gates the arrival experience).
  Candidates 2/3 (frozen edge texels beyond ±6144; E/W/N rim float over
  the far shell) are UNCHANGED and remain documented debts — they float,
  not fling, and stay within metres of true ground.

**(2026-07-03, local) FLING FIX LIVE-VERIFIED on real hardware — new
`tools/probe-walkfling-live.ts`, ALL PASS.** In-browser complement to the
CPU sim: real GPU terrain, the scene's ACTUAL groundProbe wrap chain (not
the sim's mirror), real trusted keyboard input via Playwright CDP, one NJ
boot per scenario group. Fix-sensitive checks (each would FAIL pre-fix):
pool0-rect walk-entry snap at (0, 1900) landed eye 482.75 m (pre-fix
~797); corridor-center entry under the crown at (0, 100) landed 482.75 m
(pre-fix ~3600); the reported repro wade from z 2260 across the pool-rect
line to z 1927 showed max upward step 1.2 m (the authored channel step),
max eye 487.5. Canaries: channel wade floor intact (entry 486.30 = the
live-probed floor exactly); crown basin still claims from above — walker
stands at 3611.30 = crown surface 3610.85 + wade clearance. NOTE the real
crown surface is 3610.85, not the CPU sim's 3600.25: real plazaTopY =
coreY 481.05 + 2.8 = 483.85 vs the sim's mock flat 470 — live floor
expectations must come from `__laas.groundProbe`, never sim-derived
constants. All four rim walk-offs clean with real displacement asserted
(south descends the real rim face 477.8 -> 289.9 over 221 m; E/W float
per ADR 0016; the north edge is GROUNDED by the campus far-ground grid,
not floated). Every walk entry asserts the eye snapped DOWN off the fly
seed onto the live-probed floor, so a dropped V press cannot false-pass;
the check design was adversarially reviewed (sensitivity/semantics/
false-pass) before trusting the green run. Environment notes: headless
Chromium's adapter roulette picked the Intel iGPU (xe-lpg) — the probe's
fps 12-17 in heavy framings is an iGPU number, not a machine verdict; and
run the probe FOREGROUND in harness sessions (backgrounded shells die
~2 min in regardless of requested timeout) with `--only a,b` then
`--only c,d` to stay under the 600 s command cap. Visual observation for
the polish list: at plaza level inside pool0's plan rect (meridian z
1696..2060) the walker now legitimately walks UNDER the elevated pool
sheet, which reads as an unlit near-black ceiling
(shots/wip/flingfix-live-a.png) — pool undersides have no lit material;
cosmetic, queue with the polish debts. Still owed (subjective,
Scott-only): first-walk FEEL pass, campus visual verdict (hard refresh),
M1 Max performance verdict.

**(2026-07-06, cloud) ARRIVAL EXPERIENCE BUILT — queued item 6: boot rite
overhauled as "The Descent", staged cinematic hide, procedural audio
package.** Direction question (rite background 1 vs 2) could not reach
Scott from the cloud session, so the scoping's recommended shape was built:
direction (1) richer 2D cinematic + (4a) cinematic hide() + the audio
package; direction (2) stills-carousel stays open as a later layer (its
ADR + regen step were NOT created). All hard invariants held:

- `src/core/BootUI.ts` + `index.html` rewritten: the load IS the descent
  (Rev 21:2/21:10) — a painterly Canvas2D night (parallax star layers,
  drifting cloud deck, meadow silhouette) through which a pre-rendered
  luminous terraced-city sprite (gold gradient tiers, lit windows, three
  pearl gates, twelve-gem foundation course, river thread, summit glory
  with god-ray fan) descends from above the frame to seat on the horizon
  at 100%. Kept: FOUNDATION_GEMS stones row + gemname, ESV
  short-excerpt+citation verse cycle (Rev 21:2 added), stage lines, lamp
  motes + click pulses, `#boot` id, `set()/hide()` + `__laas` mirror. All
  layers pre-rendered offscreen once (per-frame cost is composition only);
  zero GPU anywhere in the overlay; display pacing unchanged (wall-clock
  chase, ~3.5%/s + catch-up, never dt).
- Staged dissolve (4a, DOM-only so fully GPU-safe): text bows out, a
  glory veil blooms to ~0.94 then settles while the night lifts (the
  exposure-ramp feel), gone at ~1.85 s. Tooling contract PRESERVED by a
  `?rite=0` bypass that `tools/launch.ts laasUrl()` now sets by DEFAULT:
  bypass hides in <350 ms and also skips display pacing, camera ease, and
  audio, so every probe/shot sees the bare world unless it opts in with
  extra `{rite:'1'}` (probe-bootui.ts does, and now waits 2.4 s).
  Reduced motion: static painting, direct set() application, fast hide.
- Camera arrival ease (main.ts): default interactive walk spawn only —
  starts held 120 m up / 260 m south of the spawn in fly with input
  disabled, eases (easeInOutCubic on wall-clock, 5 s) onto the spawn pose
  after `engine.start()`, then setMode('walk') + re-enable. Any keydown /
  mousedown skips straight to the ground. Explicit `?cam=`, `?walk=0`,
  `?rite=0`, and reduced motion all keep exact legacy placement semantics
  (no ease). FlyCamera itself UNTOUCHED — fling-fix invariants intact.
- Procedural audio (`src/audio/Ambience.ts`, NJ-only literal branch in
  main.ts, RENDERING-DECISIONS entry #9, roadmap backlog item updated):
  zero assets, one AudioContext unlocked by the first gesture. Movement 1
  boot drone (E2/B2 + beating-octave pair + band-passed shimmer) swells
  with real gen progress; movement 2 meadow bed on arrive() (two
  decorrelated gust-LFO wind channels, river hush gained by live distance
  to the approach corridor |x|<=90 / z 1900..4500, sparse synthesized
  birdsong); movement 3 gold chord (D lydian, slow attack) — soft voicing
  at ready, full voicing once on first south-approach crossing
  (z<2950, |x|<900). `?audio=0` disables construction; `M` mutes.
- VERIFIED headlessly (cloud has no GPU): new `bootrite-harness.html`
  (adopts the REAL #boot markup+CSS by fetching /index.html — nothing
  duplicated to drift) + `tools/probe-bootrite.ts` (plain Chromium, no
  WebGPU; falls back to /opt/pw-browsers/chromium where the pinned
  Playwright browser is absent): 8/8 PASS — pacing chases without
  overshoot, veil blooms mid-dissolve, cinematic hide <2.4 s, hooks
  mirror pinned, rite=0 unpaced + hidden <600 ms, reduced-motion direct +
  hidden <600 ms. Descent stages visually reviewed
  (shots/wip/bootrite-*.png). `tsc --noEmit` clean, `vite build` clean,
  `probe-walkfling.ts` ALL PASS (walk physics untouched). STILL OWED on
  real hardware (Scott): `probe-bootui.ts` (now rite=1) over a real gen
  wait, the arrival ease + audio feel pass, plus the three pending
  verdicts from 07-03 (walk feel, campus visuals, M1 Max perf).

**(2026-07-06, Scott's Windows machine, worktree) ARRIVAL REFINEMENT P0 —
the review's confirmed correctness findings fixed, probed, and run against
the real GPU.** Worked in a git worktree on the PR #25 branch: `main`'s
working tree holds Scott's UNCOMMITTED direction-2 stills exploration
(bootStills.ts, boot-stills/, ADR 0019 draft) and was not touched.

- Arrival ease gated to its narrative: arms only for scene=newjerusalem
  without `?fly=1` (it raced the Bookmarks flythrough for the pose — both
  wrote it every frame). Skip is movement INTENT only (WASD/arrows/Space/V)
  — `M` stays mute, click keeps its rite meaning (audio unlock), and the
  eased y clamps to groundProbe + 1.7 each frame (collision is off during
  the descent).
- Ambience lifecycle: constructed only after the WebGPU gate passes;
  boot().catch now calls dispose() (it existed, uncalled — failed boots
  leaked gesture listeners + AudioContext). Drone progress swell moved to
  a 500 ms wall-clock interval reading hooks.progress — engine updateFns
  never tick during world-gen, so the update()-driven swell had been dead
  code. River-hush corridor now DERIVED from geometry (RIVER width + curbs,
  CITY_HALF, NJ_SCALE, exported CHANNEL_END): |x|<=60, z 2080..3700 — the
  hand-tuned z 4500 overran the authored water by 800 m. CUE_Z 2950 stays
  an explicit design choice.
- Rim-band water hole FIXED (pre-existing from the fling fix): adjacent
  reaches' plan-claim bands overlap 0.2 local (4 m world) at every tier
  lip, and riverSurfaceLocalY returned -1e6 on the first cap-rejected
  match — a walker wading the LOWER pool inside a shared band lost the
  floor and sank under the crystal. Scan now skips capped matches and
  returns the highest claimable surface. The scene's groundProbe wrap
  moved into RiverOfLife (`wrapGroundProbeWithRiver(base, plazaTopY,
  scale)`; scale is a param — importing rimModel would cycle through
  Allotment and break RIM's module-scope init) and probe-walkfling now
  composes the REAL wrap: the documented mirror-desync risk is gone.
- probe-walkfling grew B1-B3 (rim band lz 42.9 / control 43.1 / plaza-eye
  cap): B1 verified FAILING on pre-fix code (water 468 dry vs 2396.40),
  8/8 PASS post-fix, all pre-existing expectations byte-identical.
- probe-bootui made deterministic: after the dissolve it presses KeyW (the
  designed skip) so bootui-after.png is the landed spawn pose every run —
  and the probe RAN GREEN here on a real adapter (headless channel:chromium,
  hardware WebGPU): rite stills reviewed, overlay gone, final frame is the
  grounded meadow view. probe-bootrite 8/8, tsc clean. Still Scott-only:
  the subjective feel pass (rite pace, ease duration, audio levels) and the
  three 07-03 verdicts. Known cosmetic: at p=0.92 the city sprite still
  floats slightly above the meadow ridge (P1 seat-the-city item, next).

**(2026-07-06, same session, continued) ARRIVAL REFINEMENT P1+P2 — the
whole refinement list landed and probed; engine re-vendored.**

- City SEATED: horizon drops to 0.725vh (just above the stones row at 74%)
  and the meadow gains a calm distant back ridge whose crest rides
  RIDGE_SINK(12) px above it, weaving only a few px — at p=1 the wall base
  lands in grass, never on sky, gates stay readable at the ridge's rises.
  probe-bootrite captures bootrite-seated.png as the recurring seat check.
- Sky stability: star fields / twinklers / cloud banks seed from fixed Rng
  streams (fractional positions) — resize rebuilds keep every star put;
  the rebuild debounces 150 ms (canvas resizes immediately). Per-frame
  hygiene: meadow glow is a pre-rendered sprite (recentred under the
  seated base), renderMotes hoists its clock, pulse filtering skips when
  idle; Ambience throttles the river-hush setTargetAtTime to ~5 Hz +
  0.0015 epsilon and all noise sources share ONE 2 s buffer.
- Ease moved into FlyCamera.flyTo(pose, ms, onDone): advances inside
  update() (first in registration order — the one-frame cloud/aerial lag
  during the descent is gone), owns the movement-intent skip set, clamps
  the path to groundProbe + eye height, lands exact; programmatic setPose
  CANCELS it (tooling exact-placement semantics); V can't toggle modes
  mid-cinematic. easeInOutCubic lives once in core/Easing.ts (rite +
  camera share the curve). NEW tools/probe-arrival.ts (real FlyCamera,
  fake clock): 11/11 — monotonic descent, exact landing, walk handoff,
  KeyW skips / KeyM doesn't, clamp engages 30.4 m over a rise, setPose
  cancels.
- Audio heard headlessly: Ambience types against BaseAudioContext with an
  injectable context factory; NEW tools/ambience-harness.html renders each
  movement 10 s through an OfflineAudioContext and NEW
  tools/probe-ambience.ts asserts soundness: 12/12 — drone rms 0.0134,
  meadow 0.0053, cue 0.0105 (chord audibly over the bed), peaks < 0.07,
  zero NaNs, south-approach cue one-shot latched.
- Tooling consolidated: launchAnyChromium shared from tools/launch.ts;
  bootrite-harness.html lives under tools/; the three arrival probes share
  tools/check.ts; rite/audio/walk are typed LaasParams fields consumed by
  main.ts + BootUI (harness passes parseParams().rite — launch.ts's
  literal rite=0 stays the contract). Vestiges swept: #boot-bar
  (field/write/markup/CSS), converge (hidden covers it), hideTimers.
- probe-bootrite also asserts CONTENT now: lit stones always a prefix of
  the foundation order and all twelve in exact Rev 21:19-20 gem colors at
  rest; verse block is a short quoted excerpt + book-chapter:verse ESV
  citation; mid-rite resize leaves the Rng-seeded stars byte-stable.
  13/13.
- Verification matrix at HEAD: tsc clean, vite build clean, walkfling 8/8,
  arrival 11/11, ambience 12/12, bootrite 13/13, and probe-bootui rite=1
  over a REAL adapter end-to-end (rite stills reviewed, deterministic
  landed final frame). Engine re-vendored into apps/web/public/laas.
  NOT done: pool-underside polish (GPU-visual, still queued) and the
  stills-carousel / Ezek 45-48 items (blocked on Scott by design).

**(2026-07-06, Scott's Windows machine, worktree, later) POOL-UNDERSIDE
POLISH (P2 item 15) — investigated, diagnosis corrected, holes closed.**

- CI on 802c6fd confirmed green first (all six checks, world-engine job
  included); baseline re-proved before touching anything: walkfling 8/8,
  arrival 11/11.
- The debt's diagnosis was wrong in an instructive way. "Pool undersides
  have no lit material" — actually the pool undersides were INVISIBLE
  from below (surface + bed are single-sided top-facing planes,
  backface-culled), so under a pool you looked straight THROUGH the
  water to the zenith sky. And under most of a pool's plan rect the
  walker never sees the bed at all: every tier top carries a
  full-footprint ivory cornice slab (CityMassing, 2*half+5 square,
  2.4 thick at yTop) that occludes the bed from below except the ~2 m
  sliver where the pool lip (half+2.6) outreaches the cornice
  (half+2.5). The "unlit near-black ceiling" in flingfix-live-a.png was
  the CORNICE underside + the dark ZENITH SKY through the culled pool
  lip, under auto-exposure keyed to the bright meadow — not a missing
  pool material. At T=11 today the whole undercroft reads properly lit
  pale-ivory in every shot (probe-GI ambient reaches down-faces);
  the walker-height approach/undercroft matrix shows no black anywhere
  (shots/wip/poolunder-*.png).
- Fix that remains real: riverBedMaterial is now DoubleSide, so every
  pool's gold bed renders from below and the see-through-to-sky slivers
  at every pool lip are closed (crown basin + all ledge pools + plunge
  pool inherit it). Verified on-GPU: zenith shot from under the pool0
  lip (0,700,2051) shows the caustic gold bed strip where sky leaked
  before (poolunder-a-liptest.png). Beds are tiny planes — the
  DoubleSide double-pass cost is negligible (CityMassing's FrontSide
  discipline is about its huge meshes, not these).
- Mapped pool0's true world rect via a throwaway groundProbe scan
  (surface y 807.4, x ±50, z 1696..2060 — matches the reach table);
  scan tool deleted after use, not committed.
- Verified after: tsc clean, vite build clean, walkfling 8/8 (water
  materials sit near walk physics — probe is the spec). Engine
  re-vendored into apps/web/public/laas.
- If the black-ceiling read ever returns in a live walk, tune exposure
  or the cornice underside ambient — not the water. The pool undersides
  are now accounted for.

**(2026-07-06, cloud, post-#25) WALL/GATE COLLISION BUILT — the first "What's
NOT built" item closed.** Walkers and the fly camera no longer phase through
the city: lateral collision against the massing, with the twelve gates as
REAL passages (Ezek 48:30-34 order, RENDERING-DECISIONS #2).

- Shape per the handoff: a new `hooks.moveProbe` alongside groundProbe (a
  lateral move resolver, `(fromX, fromZ, toX, toZ, y) -> {x, z}`), consumed
  by FlyCamera in BOTH modes — walk resolves each step at shin height
  (WALL_BODY_LIFT 0.5 so pavement lips stay steppable), fly resolves at the
  camera eye before the ground clamp. Null everywhere but the NJ scene, so
  wild scenes never block (same opt-in idiom as groundProbe); cinematics
  (flyTo) stay collision-free as established in the arrival P0 pass.
- `src/nj/cityCollide.ts` derives the volumes from cityModel's OWN tables
  (CITY_TIERS, PLINTH_HALF, GATE_OFFSETS/GATE_WIDTH, foundationCourseSpans)
  and exports the REAL resolver the scene installs — shared-table discipline,
  no mirrors. Volumes are the MASSING: solid plinth, jasper wall ring with
  open gate gaps, the jewelled foundation course, terrace tiers at the glass
  plane (TIER_GLASS_PROUD), crown. Relief (pilasters, piers, frames, dentil/
  arcade courses, jambs, pearl membranes) stays non-colliding filigree.
  Resolution is axis-separated swept substeps (1 m world): oblique motion
  SLIDES along faces, boosted fly speed cannot tunnel the wall, and a start
  inside a solid moves freely — programmatic poses (setPose anywhere) are
  never trapped, and walk-entry inside the plinth (the live-probe B path)
  simply walks out.
- FOUND ALONG THE WAY: the foundation gem course girdled the wall base
  ACROSS all twelve gate offsets — ~84 m-tall gem volumes walling off every
  gate approach at ground level, contradicting RENDERING-DECISIONS #2 (the
  pilaster and dentil courses already skip gate slots; the gem course was
  the odd one out). `cityModel.foundationCourseSpans()` now notches the
  course at the gates (GATE_CLEAR_HALF, the dentil-skip clearance) and BOTH
  the geometry (CityMassing.buildFoundationCourse) and the collision read
  that one table. GPU-visual check of the notched course still owed on
  Scott's machine (cloud session — CPU probes only).
- Collision is LATERAL only, and the volume extends ~10 m below the plaza
  top (walkers approach on the meadow 2.8 m below the plaza line). Floors
  stay groundProbe territory: the plaza slab and terrace pavements are NOT
  yet walk floors (a meadow-level walker still wades chest-deep through the
  plaza slab's rim, and a gate passage's floor is the plaza he walks under)
  — that is the next navigation debt, distinct from collision. Dwellings/
  temple/curb collision also remains open (city-only scope this pass).
- VERIFIED: new `tools/probe-wallcollide.ts` (walkfling idiom — REAL
  FlyCamera + REAL resolver + REAL river wrap under Node, mock flat
  plateau): 19/19 PASS — wall stop at the course face, gate pass to the
  plinth (walk AND fly), slide, terrace-face fly stop, free sky above the
  summit, inside-solid escape, no-probe pass-through (the pre-fix
  behavior, kept as the opt-in guard), plus 11 pure volume-table checks
  (notches, corners, course top, tier faces, crown). Full matrix at HEAD:
  tsc clean, vite build clean, walkfling 8/8 (groundProbe chain untouched),
  arrival 11/11, bootrite 13/13, ambience 12/12. probe-walkfling-live's
  expectations were audited against the new collision (A2 reaches z<2000
  through the south-gate corridor before the plinth at z~1760; B2's
  in-plinth walk uses the escape rule) — live rerun on Scott's machine
  still owed. Engine re-vendored into apps/web/public/laas.

**Queued program (agreed with Scott 2026-07-02, in order):**
1. ~~Phase A live tuning panel~~ **BUILT 2026-07-02** (`src/debug/EditPanel.ts`,
   Tweakpane 4 + @tweakpane/core devDeps): `?edit=1` on a dev server only —
   the dynamic import sits inside a literal `import.meta.env.DEV` branch and
   `vite build` eliminates it (verified: dist greps clean for tweakpane).
   Binds live handles with no refactor: time of day (through
   hooks.setTimeOfDay's full re-bake chain, 250 ms trailing debounce),
   aerialFogK/aerialClarity uniforms, summit glory intensity (njLive
   registry in CityMassing), exposure lock (new PostStack.setExposureLocked),
   live pose readout + the four judging framings as jump buttons, copy-pose
   (?cam= string) and copy-values (JSON) clipboard round-trips. Panel
   keydown is isolated from the fly-camera hotkeys. LIVE-VERIFIED
   (shots/wip/phase-a-panel.png via `shoot.ts --edit 1`): all folders
   render and read the true live values (fog 0.120/clarity 0.350 = the NJ
   overrides; ToD 17.0). Superseded eventually by Phase B's
   NewJerusalemConfig.
2. ~~Plateau rim → stratified cliff-and-waterfall band~~ **BUILT 2026-07-02**
   (ADR 0016). MacroMap's plateau branch gains a mesa profile: rolling top →
   noise-meandered lip (±70 m) → stepped face carrying an ABSOLUTE 260 m
   wall (a fraction-of-local-rise first cut vanished where the wild fringe
   ran high) → talus tail; the face band gets a strata-modulated hardness
   boost (0.72 interbeds / 0.97 beds) so erosion carves ledges instead of
   shedding the wall. Rim constants live once in `src/nj/rimModel.ts`.
   WATERFALLS: `RimFalls.ts` scans the post-generate CPU mirrors for wet
   cells in a band just inside the lip (the hydrology cliff-cut dries the
   slope itself), clusters to ≤4 sites ranked by wet depth, and drops
   world-space crystal ribbons (`crystalFallMaterialWorld` — the ×20 city
   variant is untouched) + plunge pools at the seed's REAL drainage
   crossings; anchor sites near the basin spill keep the south-face
   composition on dry seeds. LIVE-VERIFIED (shots/wip/rim2-*/rim3-*/rim4-*):
   eye-level south wall with benched treads under the city; basin-side
   framing matches the holy-allotment reference composition (strata bands +
   pond + falls + city); spawn hero view unchanged; wild bm4 regression
   unchanged. Debts: fall ribbons read as translucent veils at 1 km (white
   column drama = tuning knob); rock palette is the engine's alpine pale vs
   the refs' warm sandstone (cohesion vs refs tradeoff — surface if judged);
   E/W/N rims are far-shell only (ADR 0016 accepted); plunge pools lack a
   wade guard (off-path, logged).
3. ~~Allotment zone map~~ **BUILT 2026-07-02** (dated entry above:
   `ZoneField.ts` + `allotmentZones.ts` planted through scatter, the
   grass ring and the splat; wild scene regression-verified).
4. ~~Temple PoC — Scripture-as-data~~ **BUILT 2026-07-02** (dated entry
   above: ADRs 0017/0018, the 88-record verified measurement dataset +
   pipeline surface, RENDERING-DECISIONS #6/#7, and the literal-cubit
   Temple.ts rebuild at (0, -5600)).
5. ~~Dwelling variation (delta #6)~~ **BUILT 2026-07-02** (dated late-4
   entry above: world-space two-band garden-court campus in Dwellings.ts,
   megaboxes gone, RENDERING-DECISIONS #8; follow-ups queued — allotment
   measurement seeding per ADR 0017, campus zone tint, court orchards).
6. ~~Arrival experience~~ **BUILT 2026-07-06** (dated entry above: descent
   rite + staged cinematic hide + camera arrival ease + procedural audio;
   direction 2 stills-carousel remains an open later layer, pending Scott's
   verdict on the shipped direction 1). Original scoping kept below for the
   invariants record. **(added 2026-07-02, Scott):** MAJOR overhaul of the
   boot/loading screen (`src/core/BootUI.ts`, "The Preparation" rite) — the
   current line-art ziggurat + gem diamonds screen is "really bad, clunky,
   outdated" vs the world's new bar; open to a complete rethink of how to
   hold the user through the 60–90 s world-gen. Deliberately LAST so it
   reflects the finished art direction, and paired with the audio first
   deliverable (spawn-meadow ambient bed + south-approach score cue,
   roadmap Operational backlog) as one coherent arrival package.
   **Scoping pass done (2026-07-02):** BootUI is a self-contained
   DOM/SVG/Canvas2D overlay (~810 lines incl. index.html CSS), zero GPU
   dependence; progress flows main.ts → `bootUI.set(0.1 + p*0.85, msg)`;
   `window.__laas` progress/ready is the tooling contract every probe
   depends on. HARD INVARIANTS for any redesign: first ~8% of boot has no
   GPU; the main thread stalls 0.5–2 s between rAF frames throughout gen
   (pace on wall-clock, never dt — existing pattern at BootUI.ts:388);
   overlay must vanish <1 s after hide() for shoot.ts unless a `?rite=0`
   tooling bypass ships with the change; keep `#boot` id (Diagnostics
   force-hides by id), reduced-motion paths, ESV short-excerpt+citation
   rule, and the FOUNDATION_GEMS import (the one visual link to the city).
   Candidate directions, effort-ranked: (1) richer 2D cinematic rite
   in-place (S-M, zero risk); (2) pre-rendered stills carousel of the real
   world via shoot.ts captures (S, needs a one-line ADR exempting
   self-produced captures from the zero-asset rule + a regen step);
   (3) live WebGPU shader background after 8% (M, must be
   stateless-per-frame or it hitches on gen stalls); (4a) cinematic hide():
   exposure ramp + staged dissolve + camera ease after engine.start()
   (S, fully GPU-safe — the ending is where the bar is felt);
   (4b) early-start flythrough descent from ~95% (M-L, needs a
   render-while-finishing audit). Recommended shape: (1 or 2) + (4a) +
   the audio package; (4b) as fast-follow.

**(2026-07-01, evening) TERRAIN-INTEGRATED HOLY ALLOTMENT — ADR 0015.**
User verdict on the scene as it stood: "8-bit… OOMs below the bar." Root
cause was architectural, not rendering: the flat-box plateau covered the
ENTIRE ±2048 m detailed ring, the blanket scatter exclusion zeroed all
vegetation (`veg.trees: 0` in every 07-01 capture), and the 600 m lift put
grass/debris/water permanently below the visible ground. Fixed by making the
allotment REAL TERRAIN:

- `WorldConst.ts` keys `WORLD_SIZE` off `?scene=`: newjerusalem runs a
  12,288 m domain (ring ±6,144 m, ~3 m/texel macro), wild scenes keep
  4,096 m at 1 m/texel untouched (regression-shot verified at bm4).
  `FAR_RADIUS` + far-band anchors derive from `WORLD_HALF`; the literal
  `4096` in `WaterMaterial`'s flow lookup is fixed to `WORLD_SIZE`.
- `MacroParams.plateau` (new, via `ctx.macroPatch`): broad gently-rolling
  rise composited inside `macroTerrain` — bake and far shell agree at the
  seam by construction. Flat core rides the roll's CREST (a low core became
  a city-ringing hydrology lake on first boot — fixed). Approach basin pond
  SE of the spawn (Willis "water at the approach").
- `ctx.scatterExclude` is a rect LIST (city+forecourt, approach sightline,
  dwelling/temple campus); larger domains thin scatter per class (unbiased)
  so instance caps can't truncate in dispatch order (extras pinned its cap
  exactly on first boot — biased-band risk, now budgeted).
- `Allotment.ts`: platform/skirt/chunks/fields/hedges/perimeter-wall boxes
  REMOVED; dwellings + temple snap per-object to the rolling meadow; extents
  compressed to fit the far shell (placeholder proportions, ADR 0009 r6).
- `RiverOfLife`: channel width now `cityModel.RIVER.width` (the tier-scaled
  width was an 800 m water sheet filling the spawn view). Spawn moved to the
  river's east bank ~2.2 km out so the whole mountain-city composes.
- VERIFIED (shots/wip/ti-*): spawn = grass underfoot, treeline, luminous
  city rising (Willis hero composition); high oblique = rolling meadows,
  forest stands, kettle ponds, dwelling grids on the plain; counters 508k
  trees / 597k under / 1.2M stones / 137k extras (was 0/0/0/0).
- REMAINING (next passes): city massing materials are now the dominant gap
  (CITY-QUALITY-BAR #1/#3 — flat boxes vs real trees beside them), zone-map
  manicured planting (orchards/hedgerows/fields), trees-of-life quality
  (#5), dwellings/temple close-up check on the north plain, far-shell
  close-up softness if the rim is walked.

**What's built** (`NewJerusalemScene.ts`, `CityMassing.ts`, `Allotment.ts`,
`RiverOfLife.ts` — corresponds to integration-spec M1–M2, partial M3):

- City: a 5-tier gold→crystal box massing (`CityMassing.ts`), each tier faced
  with flat arch-window panels + a "blind-arcade" frieze band, gold cornice
  lips, a self-luminous glory sphere at the summit (throne + glory-light
  conflated into one primitive, aniconic per ADR 0010).
- **(2026-07-01) Base tier is now a real jasper WALL, not a solid box.**
  `CityMassing.ts` now imports `cityModel.ts`'s `GATES`/`FOUNDATION_BANDS`/
  `FOUNDATION_GEMS`/`GATE_OFFSETS`/`GATE_WIDTH`/`CITY_HALF` (previously
  unimported dead code — this closes that desync) to build: a solid inner
  plinth (structural support for the terraces above) + an outer wall ring
  split into segments with real gaps at the twelve named gates in Ezekiel
  48:30–34 order (RENDERING-DECISIONS #2) — a camera can fly/walk through a
  gate gap, not past a decorative panel — each gate framed by gold jambs and
  a pearl arch head, plus a twelve-stone jewelled foundation course (Rev
  21:19–20 order, per-gem stylised hues) girdling the wall's outer base.
  `RiverOfLife.ts`'s hand-duplicated tier table is unaffected (tier
  half-widths/heights unchanged, only how tier 0 is *constructed*
  internally changed) — still a latent desync risk if tier dimensions
  themselves are edited (see `docs/plans/world-tooling-and-scriptural-
  grounding.md` §1 Phase B). **Not yet re-verified live** — the session's
  screenshot tooling malfunctioned (see STATUS.md's usual verification
  discipline note below); `tsc --noEmit` and `vite build` both pass clean.
- River of life cascading the tiers to the plain + 6 pairs of tree-of-life
  (trunk + two offset spheres + glowing "fruit" points) flanking it
  (`RiverOfLife.ts`) — river tier table is a **manually duplicated copy** of
  `CityMassing.ts`'s, not shared (latent desync risk, see below).
- Holy Allotment (`Allotment.ts`): a lifted grass-topped rock plateau
  (perimeter sandstone wall, rock-chunk cliff edge), hedgerow crop fields E/W
  of the city, a 12×7 priestly dwelling grid (flat dark boxes) N of the city,
  and a standalone temple (Ezek 48:10) N of that — same box-massing idiom as
  the city, smaller, no interior.
  Fields/dwellings/temple are new content **ahead of** `docs/roadmap.md`'s
  Phase 3 scope (they belong to Phase 4's Ezekiel 40–48 / Holy Allotment
  milestones) — built here first because the engine invites it, not because
  Phase 3 required it. Reconcile roadmap sequencing before adding more.
- Citywide scale: `NJ_SCALE = 20` (~2.5 mi), per
  [ADR 0014](../../docs/adr/0014-citywide-scale-rendering.md) — supersedes
  every reference to a "~200 m placeholder" for this scene specifically.
- De-haze / self-emissive tuning so the city reads as the brightest thing in
  frame against km-scale aerial perspective (`aerialFogK`/`aerialClarity`
  overrides in `NewJerusalemScene.ts`, tier emissive curves in
  `CityMassing.ts`).

**What's NOT built** (present on the legacy `/world` R3F scene, retired per
ADR 0013, and not yet ported — see `RENDERING-DECISIONS.md` entries #1–#4 for
the decisions these owe):

- ~~Wall/gate collision of any kind~~ **BUILT 2026-07-06** (dated entry
  above: `hooks.moveProbe` + `src/nj/cityCollide.ts`, gates as real
  passages, foundation course notched at the gates). ~~Walkable floors~~
  **BUILT 2026-07-18** (later-2 entry above: plaza slab, plinth top,
  terrace rings and crown top are groundProbe floors). Still open:
  dwellings/temple collision and floors.
- Distinct throne (rainbow halo + sea of glass, RENDERING-DECISIONS #4) — only
  a plain emissive sphere.
- Mini-map / click-to-teleport.
- Any descriptor/citation HUD, any click-picking, any entity interaction at
  all — only the engine's generic debug HUD (fps chip, `F3` panel) exists.
- Symbolic-vs-literal tier badges or a visual key.
- Population (multitude, angelic hosts) — not started on either scene.

**(2026-07-01) Navigation reworked: mouse-steer, no pointer lock.**
`FlyCamera.ts` previously used click-to-lock pointer-lock (hidden cursor, raw
mouse-look) — the generic rig, not the legacy scene's later approachable
navigation. Ported the legacy scheme (commit `e94c3c1`): cursor stays
visible; view eases toward wherever it points (dead-zoned, eased response),
steering only while the cursor is over the canvas. Applies uniformly to both
walk and fly modes. `tools/probe-pointerlock.ts` (tested the removed
pointer-lock cooldown behavior) deleted 2026-07-01. **LIVE-VERIFIED
2026-07-01 via `tools/probe-mousesteer.ts` — ALL PASS** (dead-zone hold:
zero drift; right/left edge holds ease yaw in opposite directions; top/bottom
holds ease pitch in opposite directions). Playwright's `page.mouse` emits
real trusted CDP input events, so interactive-input checks do NOT need the
Chrome extension — use that probe as the template.

**(2026-07-01) Plateau lift raised 12 m → 600 m.** The Holy Allotment's fixed
lift above the origin's terrain height was tuned for the pre-citywide-scale
footprint; at `NJ_SCALE=20` the allotment (up to ~21 km north-south) reaches
far into the engine's analytic far-shell, where wild terrain can rise well
above a 12 m lift, producing a visible collision at the plateau edge (worst
near the temple). Raised to 600 m — also thematically correct (the plain
should sit clearly above the surrounding land, not barely above it). **Not
re-verified live this session** (see below); if the seam is still visible or
600 m reads as excessive, treat this as a starting value to tune by eye, not
a derived constant.

**Known issues found 2026-07-01** (visual audit via `?scene=newjerusalem`,
`__laas.setPose`, before this session's fixes):

- **Massing quality is far below this engine's own bar.** The city is flat
  `BoxGeometry` + `MeshStandardNodeMaterial` primitives with no per-instance
  variation, no PBR gem/crystal transmission, no macro-meso-micro surface
  detail — the exact failure mode (ADR 0013) that motivated forking LAAS in
  the first place ("hand-built primitives... the redeemed multitude is 760
  cone-plus-sphere figures"), now recurring in the new engine's own city
  content next to its ~5M-tri, per-instance-unique forest. Central input to
  Task 1's city-specific quality bar (`CITY-QUALITY-BAR.md`). **Wall/gate/
  foundation geometry landed 2026-07-01 (above); crystal/gem transmission
  materials and per-tier surface relief (delta #1/#3) remain open.**

**VERIFICATION TOOLING — RESOLVED (2026-07-01).** The generic `preview_screenshot`
tool hung (30s timeout) on every attempt against this engine's WebGPU canvas
this session, and a `canvas.toDataURL()`-via-eval fallback produced corrupted
output; the Chrome extension was also not connected. **Fix: use the engine's
own `apps/world-engine/tools/shoot.ts` Playwright harness directly (already
built, `docs/DELTA.md`/STATUS.md's established tool) — it works reliably.**
It launches Chromium with `channel: 'chromium'` (not Playwright's default
GPU-less headless shell) and gets a real adapter (verified: Intel Xe-LPG on
this Windows dev machine). Run it against the world-engine's own Vite dev
server on **port 5173** (`npm run dev` in `apps/world-engine`, NOT the
`apps/web` :3030 iframe wrapper — `tools/launch.ts`'s `PROBE_BASE` is
hardcoded to `localhost:5173`):

```
npx tsx tools/shoot.ts --scene newjerusalem --cam "x,y,z,yaw,pitch,fov" \
  --out shots/wip/name.png --w 1280 --h 800 --settle 12 --timeout 180000
```

Then read the PNG directly (`Read` tool) — no MCP screenshot tool or Chrome
extension needed. A `.claude/launch.json` `"engine"` entry (port 5173) now
exists alongside `"web"` for this. **This is the go-to verification path for
this engine going forward** — reach for it before the generic preview tool.

**Live verification results (2026-07-01, via the above):**
- **Plateau/terrain seam (12m→600m lift): CONFIRMED FIXED.** Wide establishing
  shots (`?cam=0,1300,8000,0,-0.1,55`) show a clean plateau edge, no visible
  mountain intrusion.
- **Wall gate gaps: geometry CONFIRMED REAL** — the flanking gates (offsets
  ±50, e.g. Simeon/Zebulun) show genuine daylight through the wall from
  outside (`?cam=0,1500,2600,0,-0.5,80`). The gate-order/segmentation logic
  works.
- **GATE BLACK VOID — ROOT-CAUSED AND FIXED (2026-07-01, later session).**
  The recorded hypothesis (plinth face missing an emissive floor) was WRONG —
  the black was never the city's geometry or materials at all. Bisect trail
  (all live, `tools/shoot.ts` + `tools/probe-blackvoid2.ts` raycast
  attribution + in-page material swaps): black pixels were exact RGB(0,0,0);
  survived `?ablate=` of taa, bloom, ao, contact, clouds, froxels, gi, pcss,
  shadows; survived an aerial-perspective passthrough; vanished under
  `?postmin=1` AND under `?postmin=1&postmrt=1` ⇒ the grade. ROOT CAUSE:
  `PostStack.ts` graded() saturation `mix(lum, c, uSat)` EXTRAPOLATES at the
  golden-hour script's sat ≈ 1.14 (ColorScript t=15.5→19) — any channel with
  ch/lum < (s−1)/s ≈ 0.12 crosses NEGATIVE, and the following
  `pow(c, uContrast)` is NaN for negative bases in WGSL → AgX renders the
  pixel pure black. The city was the only victim because its shadowed pixels
  are uniquely DARK+SATURATED: city materials get no probe-GI injection
  (that's a per-material opt-in the city never opted into), the hemisphere
  ambient is floored at 0.15×, and the gold/gem albedos are high-chroma
  (shadowed gold sits at ch/lum ≈ 0.123 — right at the cliff; the gem hues
  far under it). The screen-space "bounce disc" black blob shared the root
  (warm saturated bounce add tipped marginal pixels over). FIX: clamp
  `c = c.max(vec3(0))` after the saturation mix, before pow — also catches
  TRAA variance-clip undershoot. VERIFIED at the original repro framing, the
  120 m close framing, and a `?scene=world` bm4 regression shot (unchanged).
  Pillar B holds: gate recesses now sample warm-lit (e.g. rgb(105,85,35)).
- **SECOND FIX unmasked by the first: tier-0 piers stood ON the gates.**
  The base tier's decorative pier rhythm (u = 0, ±50, ±100 per side) lands
  exactly on the three gate offsets — a 340 m (17-unit) gold pier stood
  immediately outside each real wall gap, reading as a blocked door head-on
  (this, plus the grade-black in front of it, is what the original "void"
  framing was actually showing). `CityMassing.ts` now skips base-tier piers
  within a gate width of any `GATE_OFFSETS` entry. Head-on shot now shows an
  open, walkable portal: recessed corridor, jamb reveals with sky fill,
  pearl arch head visible.
- Center (offset-0) gates: **re-judged with a dedicated framing** (east/
  Benjamin, `?cam=2700,1000,0,1.5708,-0.1,60` — the river covers the south
  one). Open lit portal, and the ONYX foundation band (east-centre, Rev
  21:19-20 order) renders its correct slate hue. No voids.
- Mouse-steer navigation: **live-verified ALL PASS** via
  `tools/probe-mousesteer.ts` (see the navigation entry above).

## Current focus

**Phase 2 — atmosphere, shadows, clouds, post** + USER FEEDBACK BATCH 1 (2026-06-11).

User feedback (all four addressed, commits e939266/575b621/next):
1. PERF "~40fps before objects": root-caused via new `?ablate=` + `--gpusample` median
   harness → terrain splat material was ~52 ms of a 73.5 ms GPU frame (35 live noise
   evals/px). Fixed: `NoiseBake.ts` baked value/fbm/ridged + PRE-DERIVED GRADIENT
   textures; GTAO samples 16→8 (defaults cost ~50 ms on vistas); clouds half-res RTT +
   baked weather; 3D-distance quadtree split; castShadowPositionNode (nearest, no morph);
   CSM maxFar 3200. NOW: 19–23 ms GPU @1080p all views (was 73–134). Phase 7 finishes
   (vsync-real fps; spikes re-check on live flythrough).
2. EROSION "sharp diagonal/straight 1-cell trenches, predictable lake patterns": particle
   trace was D8 (8-direction snap) → continuous bilinear-gradient descent w/ inertia;
   strength field blurred before carve (channels have width); carve faded inside lakes;
   particles STOP on filled flats (ε-tilt alignment printed parallel lines) and in lakes;
   hardness-aware talus relax (26 it) post-carve rounds trench walls, towers protected;
   trench enforcement got V-profile (was rectangular select) + fine meander warp octave
   (61 m / ±16 m) so spline trenches aren't ruler-straight; kettle ponds render dark
   (were gravel-gray dots). VERIFIED shots/wip/fix-round2-*.png.
3. LOD "center always high detail": VERIFIED FALSE for the quadtree (live setPose test:
   rings follow camera; `?view=lod` debug added). Real causes user saw: far shell beyond
   world edge + coarse cliffs (see 4). 3D split distance stops altitude over-refine.
4. MESHING "stretched verts on slopes": skirted patches (PlaneGeometry +2 ring, clamp +
   drop in shader → crack-proof) + error-biased splits (height-range mip pyramid; rough
   tiles split earlier and down to 32 m → 0.5 m quads on cliff close-ups). Snow dither
   gated near boundary (white speckle on rock fixed).

Phase 2 items: 1–5 BUILT as before (atmosphere LUTs, SunSky, CSM+PCSS, clouds, post).
CLOUDS NOW VISIBLE AND CORRECT — root causes were (a) quad-pass camera uniforms
(cameraPosition/WorldMatrix/ProjectionMatrixInverse are the POST QUAD camera inside
RenderPipeline.outputNode → explicit uCamPos/uProjInv/uCamWorld uniforms now) and
(b) depth convention is CLASSIC here (sky d=1.0, not reversed) → isSky + maxD fixed.
Aerial perspective only became truly distance-correct with the same fix.
`?cloudview=1..9` probe ladder kept (tone mapping auto-off when probing).

PHASE 2 CLOSED 2026-06-11 (see checklist + DELTA.md). All listed items landed: cloud art
pass (contrast-stretched weather, isotropic phase floor, base-darkened ambient, default
cov 0.62), contact shadows (?ablate=contact to A/B), black facets root-caused to GTAO
(NOT PCSS — depth-derived normals fixed it), gate + shadow-color test PASSED.

**Phase 5 — BUILT, gate pending.** The world is planted end-to-end:
- `Scatter.ts`: boot GPU clustered-Poisson (162k trees / 467k understory /
  7.4k extras at seed 1), per-class density fns (biome/slope/treeline/moisture/
  snow/rockExp/water), ecotone warp, parent-clump field doubling as canopy
  proxy for understory (ferns under crowns, flowers in gaps, pink shrubs at
  clump EDGES). pcg2d integer hash (pure expression — usable in materials).
  + `buildCanopyMap`: crowns splatted to a 1024² coverage field; attenuates
  probe ambient under canopy (terrain ×0.55, veg ×0.4) = forest interiors no
  longer sky-bright (user "washed out" + shadow-visibility fix).
- `VegLibrary.ts`: K=4 variants/species; R1/R2 ring geoms from the SAME
  skeleton (no-pop LODs); ring diet in TreeBuilder (bark stops below anchor
  level; cards thin+enlarge ≈ sqrt(stride)) → R1 avg 8.4k tris, R2 1.8k.
  Impostor capture per species.
- `Forests.ts`: per-frame clear→cull→indirect computes. Cull = per-class
  dist bound + 6-plane frustum + terrain-occlusion march (camera→crown-top
  against height buffer) + ring classify w/ overlap bands → atomic append
  into per-(pool,ring) compact regions → `geometry.setIndirect` draws (one
  shared IndirectStorageBufferAttribute, byte offsets). Rings: R1 cards
  ≤150 m → R2 ≤460 m → octahedral impostors (D-4 runtime: 4-tile hemi-oct
  bilinear blend, relit normals, per-instance yaw/tint) — IGN-dithered
  crossfades. Tree rings 1+2 cast shadows; terrain casts via `ShadowProxy`
  (512² grid; CDLOD castShadow=false; saved ~54 ms).
- `GroundRing.ts`: toroidal-clipmap grass (3072², 136 slots/m², 4/2-blade
  CLUMP geoms near/mid + tuft cross far; ≈520k blades visible at meadow
  framings) + debris ring (cobble/pebble/twig/chip/litter; streambed
  override density — beds read cobbled). `CanopyShell.ts`: far forests as a
  lit lumpy aggregate beyond 620 m.
- Veg materials: GI-patched (IrradianceNode), canopy-attenuated, per-instance
  tint, vec4-alpha shadow contract + maskShadowNode cutouts,
  castShadowPositionNode, instance NORMAL rotation (normalLocal.assign).

## Next actions (always keep current)

- **USER DETOUR COMPLETE (2026-06-14, commit e790e07): WALK MODE +
  SPAWN + MINIMAL HUD.** FlyCamera is now a walk/fly rig — walk is the
  interactive default (spawn = first dry low-slope spot from map center,
  eye 1.7 m, facing NE massif), V toggles fly. Gravity/jump (input-
  buffered)/sprint + industry camera effects (stride-phased bob, landing
  dip spring, sprint FOV kick — CsmCached refits cascades on fov change).
  CONTRACTS: every programmatic pose (setPose/?cam/?shot/bookmarks/
  flythrough) auto-switches to FLY; getPose/P strip effect offsets; the
  fly soft-collision + underwater guard moved from TerrainScene into the
  rig. ?walk=0 escape hatch. HUD: debug panel now HIDDEN by default
  (always-on fps chip instead; F3 toggles; ?hud=1 boots open — shoot.ts
  passes hud explicitly so tooling is unaffected). PENDING USER CONFIRM:
  walk feel (speeds/bob amplitude/jump height/FOV kick are constants at
  the top of FlyCamera.ts).
  FOLLOW-UP FIXED (2026-06-12): clicks during the browser's ~1.25 s
  post-ESC pointer-lock cooldown were dropped with a console SecurityError
  ("pointer lock cannot be acquired immediately after exiting") — the rig
  now records unlockAt on pointerlockchange, DEFERS in-cooldown clicks to
  the cooldown's end (the click's transient activation still authorizes
  the deferred call), and retries bounded (3.5 s intent window) on
  pointerlockerror/rejection. Verified HEADED via tools/probe-pointerlock.ts:
  first-click lock 2 ms; click-right-after-exit re-locks unaided in
  1270 ms; no unhandled rejections.
  BROWSER GATE ADDED (2026-06-12, user-requested — Safari/Firefox fail
  to boot): src/core/BrowserGate.ts runs BEFORE any engine work:
  (1) mobile/tablet → "a computer is required" (userAgentData.mobile,
  classic UA markers, iPadOS Macintosh-UA + maxTouchPoints masquerade —
  never screen size); (2) non-Chromium → "Google Chrome is required"
  (UA-CH brands first, "Chrome/" UA token fallback — HeadlessChrome
  passes both, tooling unaffected, verified by a headless sanity boot);
  (3) Chromium without navigator.gpu → actionable checklist (update /
  hardware acceleration / chrome://gpu / Linux Vulkan flag). Adapter-null
  keeps the richer probeWebGPU diagnostics overlay (Safari 26+ claims
  dropped from its text). ?nogate=1 escape hatch. PENDING USER CONFIRM:
  live Safari/Firefox/mobile messaging (user testing themselves).

- **USER FEEDBACK BATCH 2 — COMPLETE (2026-06-12, commits f245787..ca941b9).**
  All 11 items + 3 live follow-ups landed, each verified by shots and
  committed separately:
  1. WIND REWORK (f245787→7fa4fc3): fake-skeletal hierarchy — mean lean
     ∝ strength²·exposure (cantilever (y/(y+h0))²), per-instance natural
     frequency sway 0.15–0.45 Hz/√scale (amplitude ∝ gust, NEVER
     frequency; no time×varying-freq anywhere — the phase-explosion bug
     and the shared sine tempo are gone by construction), branch motion
     lags via downwind-offset gust sampling, aperiodic flutter from
     advected fbm GRADIENT channels, all motion fades 380–480 m
     (impostors rigid). Pools: trees{1,1,6}, understory{1,1.8,0.9},
     snags stiff{0.45,0.8,6}. Grass keeps its feel + lean² rule.
     LIVE FOLLOW-UP (b9badf8): "leaves shaking wildly" — flutter was
     ±11 cm @ ~3.4 Hz decorrelation → ±2.5 cm @ ~0.75 Hz (6 m features,
     4.5 m/s advection, amp 0.3→0.07). Cards translate rigidly (vdata
     phase is per-card — verified).
  2. FOG (bce5013): fogK 1.0→0.4, noon near-zero (todK floor 0.12),
     ground-hug dominates (0.8 w, 20 m scale) vs altitude blanket (0.2),
     moisture-selective m²+0.25 floor, ambient in-scatter 0.045→0.018
     × (0.4+0.6·sunVis). Morning meadow no longer whites out at 50 m;
     dawn-lake mist survives (thinner — judge live).
  3. CAUSTIC TILING (9186b2f): tile 6→11 m w/ lattice scaled ×1.83 (same
     physical k-band), 9 waves (2 diagonals break lattice symmetry),
     STATIC fbm-gradient domain warp ±0.9 m. No repeat along 40 m of
     channel (?view=caust2 top-down).
     LIVE FOLLOW-UP (ca941b9): "horribly strong in shallow water" —
     FOCAL RAMP smoothstep(0.04,0.5,depth) (cm-deep water can't focus
     0.3–1.1 m waves); gains terrain 2.2→1.7, rocks/debris 1.6→1.3.
  5. IMPOSTOR HALO (5233b8d): capture clears to transparent BLACK and
     edge taps mixed it in → per-tile ring-BFS RGB dilation (albedo +
     normal + depth) into the empty space before composing the atlas.
  6. LOD DITHER HOLES (f245787): COMPLEMENTARY dither — fade-IN edges
     draw IGN ≥ 1−fade so paired rings partition pixels exactly; bands
     must MATCH across each boundary (ring2 got inBand=BAND1/band=BAND2
     for the impostor edge). Grass cull now double-appends boundary-band
     cells to BOTH layers (single-list assignment halved density even
     with complementary dither); caps 512k/1M/1.75M.
  10. SUN DISC (1431777): 0.014 rad (3× physical), softer limb, radiance
     120→50 SUN_E (flux ×3.7, not ×9).
  11. SILVER WASH (51e5d0d): user flagged trees, then terrain too — F0
     0.04 Schlick saturation at glancing sun. MeshPhysicalNodeMaterial
     + specularIntensity: cards 0.18 / hero leaves 0.3 / impostors 0.25
     / canopy shell 0.2 / terrain 0.35 / rock 0.4 / bark+deadwood 0.45.
     (MeshStandardNodeMaterial hardcodes F0 — physical variant is the
     sanctioned hook, same lighting model, zero cost.)
  7+9. GRASS NORMALS (a1d664f): half-cylinder rounding BAKED into
     blade/tuft vertex normals (±38°), material yaw-rotates the normal
     (was unrotated!) and blends toward TERRAIN normal 0.5→0.85 with
     distance. Sward lights like its hillside; shadows drape smoothly.
  8. FAR GRASS (a1d664f): g3 layer — coarse toroidal grid (768²×0.7 m =
     ±269 m, the fine grid physically ends at ±161 m) of wide
     super-tufts 150→265 m, kernel-density ramp-in, full terrain-normal
     shading, bend-only wind; grassThin far-collapse (120/d)^1.6; splat
     gains view-dependent directional sheen (forward-scatter toward sun,
     gated >60 m). veg.g3 counter added.
  4. SNOW: fine per user — untouched.
- **EXPOSED while fixing fog (was fog-covered; ablate-discriminated
  2026-06-12): large-lake FAR RIM = solid black stripe at grazing.**
  NOT caustics/biofilm (survives ?ablate=caustics), IS water pixels
  (vanishes with ?ablate=water): grazing fresnel mirrors the flat dark
  SSR-miss fallback where off-screen trees can't be hit. This RAISES the
  planar-lake-pass priority (was optional polish) — the old "thin dark
  band" diagnosis (min-reduced far field) is the same symptom family but
  the dominant term at bookmark 2 is the reflection fallback.
- **BLOB ROCKS — DIAGNOSED (2026-06-12), fix queued as polish.** The
  smooth featureless gray blobs (bm4 foreground, meadow top-down) are
  cls 20/21 scatter stones — ?clsdbg=1 flat-colored them hue-220 blue =
  StoneL/StoneM. They sit WITHIN the detailed ring (≤120 m), so it's the
  source geometry, not an LOD swap: VegLibrary stonePools build StoneM
  with the 'cobble' preset (d1:2/d2:1) and StoneL 'boulder' — a smooth
  river-rounded cobble at 0.5–1 m scale on a meadow reads as a shaded
  blob. FIX (when picked up): meadow-scale stones need the craggy/
  boulder-style surface (strata + fracture detail) or a detail-level
  bump in buildRock for 'cobble' ≥ ~0.4 m; verify vs bm4 foreground.
  Predates batch 2 (visible in the first fog-before shot). Also: bm7
  (forest interior) frames a trunk close-up — re-pose during Phase-7
  bookmark polish.
- **PHASE 6 COMPLETE (2026-06-12, commits eef662f..51aba85) — all six
  systems built, verified by shots, gate DELTA written.** What landed
  this session (beyond the user-confirmed water v1):
  (a) CAUSTICS: per-frame analytic bake (7 integer-lattice gravity waves,
  closed-form inverse-Jacobian — Caustics.ts), sampled by terrain + rocks
  + debris albedo w/ sun-refraction parallax, flow advection, depth
  defocus; wet waterline fringe + submerged biofilm/algae darkening;
  underwater camera guard (cpuWaterY mirror); ?caustk/?view=caust(2)/
  ?caustlit probes; tools/find-water.ts finds shallow framings from the
  CPU hydrology mirrors.
  (b) WATER LOOK FIXES: fresnel on FLATTENED normal (ripple-steep normals
  saturated Schlick → every stream mirrored noon sky as a white sheet —
  ?waterdbg=1..6 ladder diagnosed it); ripple amp to physical range; SSR
  miss fallback now terrain-horizon-tested (4 nearest height probes) w/
  probe-GI irradiance toward the ray (gorge water reflects WALLS); foam
  keyed to ≥3% grade steps; STRICT HYDROLOGY (user mandate): WATER_T
  220→320, rSurf sat 1.5/pow 2.2/cap 1.5 m — water only in channel cores,
  washes stay dry cobbled scars (shots/phase-6/aerial-strict.png).
  (c) BANK/BED DRESSING: grass/debris gates moved off the blurred
  riverDepth apron onto the ACTUAL water surface (gorge floors regrew),
  channel-scar grass thinning, cobbles persist through ≤0.55 m water,
  submerged organics float off, cobble-core boost.
  (d) HIERARCHICAL WIND (Wind.ts): gust fronts = 2 advected fbm octaves;
  whole-plant sway scaled by BAKED vdata.y flex + 3–5 Hz flutter via
  vdata.z phase (fades by 220 m); shadows share the node; trees+understory
  sway, deadfall/stones/proxies rigid (cls<15); grass tip² cantilever in
  GroundRing; canopy map = shelter. ?wind/?winddir/?ablate=wind.
  (e) FROXELS (Froxels.ts): 160×90×64 grid → scatter (height fog +
  moisture + wind billows; sun vis = terrain horizon march × canopy
  crown-band pierce × cloud shadow; HG g=0.5) + per-column closed-form
  integrate → 3D LUT composited BEFORE aerial. Dawn lake mist + glow
  verified. ?fog/?ablate=froxels.
  (f) PARTICLES (Particles.ts): 131,072 (floor 100k ✓) in ±36/±24 m
  camera box; type re-rolls from environment (snow biome / canopy leaves /
  pollen); lit quads + probe-GI ambient; ?partdbg=1/2.
  (g) WEATHER MOTION: cloud field translates downwind 22 m/s, detail
  churns at 1.35×; shadow map re-bakes every 2.5 s w/ residual-drift
  lookup; world-time driven (freeze-deterministic).
  Lakes: SSR satisfies spec ("SSR or planar"); planar pass = optional
  polish if user flags lake reflections.
- **NEXT: PHASE 7 (task #8)** — perf pass (60fps@1440p / reduced preset;
  current ~25–45 ms GPU at 1080p mixed framings), HUD per-pass GPU
  timings (fix timestamp-query overflow warning), 9 composed bookmarks
  (fold in the gate's art-direction deltas: fg hero boulders, overhang
  framing, wall-veg density, shallow-trickle reach for the final
  two-frame test — see DELTA.md Phase 6 top-10), 90 s flythrough, full
  verification battery, final two-frame test, self-score rubric.
- Phase 5/6 carried debts (fold into 7 where natural): geometric wall
  plants, moss volume geometry, noon-dapple gap re-judge, impostor depth
  parallax (D-4), distant-forest felt at vistas, 2nd cloud layer + god
  rays (froxel shafts partially cover; judge at golden-hour bookmarks),
  lake planar reflections (optional).
- PENDING USER CONFIRM: water look after fresnel/strict-hydrology rework
  (esp. river width/coverage now matching their "too much water" ask);
  wind feel (amplitude/speed live); fog density taste (?fog=N); particle
  visibility. Shadow-flicker live check still outstanding from Phase 5.
- **PHASE 7 PERF — USER DIRECTIVE (2026-06-12, BINDING; overrides the
  spec's 60fps@1440p floor upward):**
  - User: "Performance is dogshit. On my M1 max the FPS is around
    10-15." (their live interactive session; headless 1080p shots
    measured 22-30 ms GPU = 33-45 fps — gap is likely window size/DPR
    ~1.5-2 on the 3456×2234 display + TRAA history + motion. REPRODUCE
    THEIR SETUP FIRST when measuring.)
  - "Maximise performance WITHOUT sacrificing any of the visible
    detail." A UE5 scene of this complexity "would easily hit 120FPS —
    the issue isn't the scene or visible detail complexity. Everything
    in the render pipe must be optimized the hell out of WITHOUT
    sacrificing ANY quality."
  - FORBIDDEN optimization class (their example): pulling the far
    field / impostor distances closer — ANY change that reduces visible
    detail, density, draw distance, or resolution. (So: no LOD-distance
    pulls, no upscalers/dynamic res, no density cuts, no fog-as-cover.)
  - "You WILL be iterating on non-quality-decreasing optimizations
    until we hit 120FPS on my m1 max. This is not up to debate."
    Target = 120 fps ≈ 8.3 ms frame (GPU AND CPU-submit) on M1 Max.
  - PLAN (measure → rank → fix → re-measure, loop until 8.3 ms):
    1. INSTRUMENT FIRST: finish HUD per-pass GPU timings (fix the
       timestamp-query overflow warning); add per-pass labels around
       every render/compute (cascades×casters, veg rings, water, froxel
       scatter/integrate, GTAO+upsample, TRAA, bloom chain, grade,
       caustics bake, particles, probe GI slices). --gpusample medians;
       measure at the USER's real viewport (big window, DPR 2) AND
       1440p, at the heaviest bookmarks (forest hero, gorge, vista).
    2. CPU side: frame-loop profile (three.js submit overhead, 905
       draws, per-frame uniform churn, indirect-draw validation) —
       10-15 fps could be partly CPU-bound at DPR 2 + TRAA.
    3. Candidate quality-preserving whales (validate against
       measurements, not assumptions):
       - VEG RASTER: depth-only ALPHA-TESTED PREPASS for cards/grass,
         then color at depth-EQUAL → fragment shading runs ~once/px
         (classic overdraw killer, zero visual change); tighter card
         geometry hulls (trim transparent border off the quads — same
         texels, less raster); front-to-back draw order per ring.
       - SHADOWS: cache cascades — far cascades re-render every N
         frames (sun static between ToD edits; identical output),
         caster compaction already per-cascade.
       - POST: merge bloom downsample chain into compute w/ shared
         memory; merge grade/vignette/composite passes; GTAO already
         half-res+bilateral.
       - WATER: SSR hierarchical march / early-exit (same result,
         fewer steps); skip SSR entirely on pixels with no water
         (stencil/mask).
       - FROXELS: skip scatter march where T≈0 early-exit; halve Z
         slices ONLY if output-identical (verify by diff).
       - WIND/VERTEX: consolidate the 5 texture taps (gust/lag/
         exposure/flutter share fetches where math-identical).
       - Probe GI time-slicing budget; caustics bake is 0.05 ms (fine).
    4. After EACH change: tsc, visual diff at 3 bookmarks (must be
       pixel-equivalent or imperceptible), --gpusample re-measure,
       commit with numbers.
  - STATUS of pass 1 (pre-directive): 48→32 ms at forest-hero 1080p
    (half-res GTAO + bilateral, ring-1 casters to near cascades only,
    ?ablate=casters). Both changes quality-checked.
- PHASE 7 PROGRESS (2026-06-12): perf pass 1 DONE — 48→32 ms GPU at the
  forest-hero framing (half-res GTAO + joint-bilateral upsample −12 ms;
  ring-1 casters to near cascades only −4 ms; ?ablate=casters knob).
  BOOKMARKS + FLYTHROUGH DONE: keys 1–9 / ?shot=N (pose + per-bookmark
  ToD), ?fly=1 or F = 92 s Catmull-Rom tour (src/debug/Bookmarks.ts).
  Remaining Phase 7: more perf (below), reduced preset wiring, full
  battery, final two-frame test + self-score rubric, fold gate
  art-direction deltas into the bookmarks, re-pose bm7.
- **PHASE 7 PERF PASS 2 (2026-06-13, commits 0a86032..bac5cff) — landed:**
  1. PER-PASS GPU PROFILER (GpuProfiler.ts): labels every render/compute
     timestamp uid (tagGpu / ComputeNode.name / RT texture names /
     shadow.cN); Engine resolves timestamps EVERY frame (the 10-frame
     cadence overflowed the 2048-query pool — that WAS the overflow
     warning; boot world-gen still overflows once, harmless). HUD top-16
     passes; shoot.ts --gpusample prints per-pass medians.
  2. CASCADE SHADOW CACHING (CsmCached.ts): cascade i re-fits+re-renders
     every [1,2,3,6] frames, staggered phases; light pose + map freeze
     TOGETHER (a moved light over a cached map translates every shadow);
     forced refresh on sun move / >4%-span fit drift / updateFrustums.
     ?shadowcache=0. −3.9 ms avg, fps 20.1→22.2 at bm4 user-viewport.
  3. VERTEX-STAGE SHADING HOISTS: grass (albedo/normal-blend/translucency/
     AO + ring fetches), cards (hue×age factor — hueShift is LINEAR in
     base; translucency; edge fade), hero leaves, probe-GI varying in both
     patchGI's (probe grid 16 m, canopy residual 4 m ⇒ vertex eval is
     sub-quantization on ≤2 m primitives). bm4 scene −1.4, bm7 −0.5.
  4. DEPTH PREPASS (VegPrepass.ts): depth-only twins for GRASS layers +
     CARD parts (alphaTest>0), sharing geometry/indirect slot + the live
     position/mask/opacity nodes; color pass at depthFunc=EQUAL.
     Requires WGSL @invariant on clip position (installPositionInvariance
     patches the builder prototype) or Metal FMA-fuses depths apart.
     bm4 GPU 49.6→39.4 ms (r.scene 16.4→6.4). bm7 neutral (hero-ring
     vertex ×2 offsets it). Opaque bark/rock twins REMOVED — wall loss.
  5. SHADOW-PASS HASH STORM KILLED (ThreePatches.ts, d1aeb48): CDP
     profile showed ~328 FULL material node-graph hashes/frame
     (getMaterialCacheKey + cyrb53 + _getNodeChildren = top JS cost,
     scaling with cascade renders). Root cause: Renderer mutates the
     shared per-light shadow override material PER OBJECT and Material's
     alphaTest accessor bumps `version` on every 0↔cutout crossing
     (bark=0 / cards=0.32 alternate) → every shadow render object
     sharing the material re-validates + re-hashes per frame. Fixes:
     instance-own PLAIN alphaTest on shadow-pass materials (value stays
     live for the per-draw uniform; version stops thrashing) + a
     per-RenderObject getMaterialCacheKey memo keyed (material identity,
     version, contextNode.version). NOTE: a material-keyed memo COLLIDES
     builder states across geometries (getAttributes crash) — must be
     per render object. Verified: hash functions absent from a 200-frame
     profile; cpu.submit bm7 15.7→11.7 ms.
  - **FINAL COOLED BASELINE this pass (user viewport 2592×1676, 24-sample
    averages): bm1 wall 29.1 ms (~34 fps) · bm3 25.3 (~40) · bm4 42.8
    (~23) · bm7 38.0 (~26); cpu.submit 11.4-14.2; cpu.update 0.4.
    Session start (hot, bm4): 85.4 ms ≈ 12 fps. GPU-sums exceed wall
    where passes overlap (TBDR).**
  - **BUG RESOLVED (2026-06-14, commit 9728eee): CLOUDS LAG CAMERA
    MOTION** — root-caused to THREE stacked mechanisms (probe:
    tools/probe-cloudlag.ts — frame-locked orbit runs, same absolute
    frame across runs so jitter index + frameU phase match; unaligned
    in-session captures were 20-27% phase noise and useless):
    (1) TRAA SKY VELOCITY ZERO (candidate a — confirmed): sky pixels
    rasterize nothing, velocity MRT = clear 0 → resolve reprojected
    history from the same screen UV at 95% weight → clouds smeared and
    caught up over ~20 frames. Mid-pan-stop sky-band diff vs converged:
    12.24% (TAA) vs 0.17% (ablate=taa) = conviction; fixed → clouds
    region reads BLACK in the motion-stop diff.
    (2) STALE CAMERA UNIFORMS (candidate b — real, different mechanism
    than guessed): subsystems copy camera state in their own updateFns,
    but FlyCamera registered LAST in main.ts — every copy (uCamPos/
    uCamWorld/uProjInv/uView in PostStack; same pattern elsewhere) read
    the PREVIOUS frame's pose during interactive motion while the
    renderer posed geometry fresh at render time → clouds/aerial/
    froxels/contact shifted against geometry by one frame of rotation.
    setPose-driven probes can't reproduce this (they mutate between
    frames) — it's interactive-only. FIX: PostStack syncs its camera
    uniforms at render() time (after ALL updateFns, immune to order),
    FlyCamera registers FIRST and calls updateMatrixWorld() in
    update()/setPose(). NOTE the jitter half of (b) was structurally
    false: TRAA clears the view offset after every pipeline render, so
    between-frame copies are always unjittered.
    (3) DISCOVERED EN ROUTE — GEOMETRY VELOCITY GARBAGE: the velocity
    MRT is broken for ALL positionNode-displaced geometry (terrain
    CDLOD morph, instanced veg, canopy shell): three's VelocityNode
    projects raw undisplaced positionLocal, so the buffer reads
    |v|~0.5-1 NDC with a STATIC camera (?skyveldbg=raw paints it) →
    TRAA history was REJECTED (weight→1) on most geometry pixels all
    along — TAA was silently OFF for geometry. FIX: TRAA's velocity
    input is now full analytic camera reprojection from each pixel's
    own depth (exact for the static world incl. translation parallax;
    far-plane limit covers sky, no branch; wind-sway/water self-motion
    falls to variance clipping as before, now with valid history).
    VERIFIED vs 4×SSAA ground truth (HF Laplacian energy, 3 crops):
    HEAD read ~144-198% of reference (aliasing posing as sharpness),
    fixed reads 82-91% — textbook TAA reconstruction, big net quality
    win. Residual softness recovery (Catmull-Rom history sampling)
    folds into the TRAA-resolve audit below. Velocity MRT attachment
    dropped from the default path (unread rg16f write+clear saved);
    ?skyveldbg=raw|ana|err keeps the diagnostic. ?lockexp=1 freezes
    auto-exposure (pitch-orbit probes were exposure-confounded).
    FOLLOW-UPS: (i) pixel-equivalence floors RE-BASELINE after this
    commit (TAA accumulating on geometry changes converged output);
    (ii) optional future: per-material object motion vectors for wind
    sway (proper velocity instead of variance-clip rescue);
    (iii) user live-confirm the lag is gone (interactive mechanism 2
    can't be probed headless).
    1. POST-CHAIN CONSOLIDATION — DONE 2026-06-14 (commits c21867c,
       955d9ab): (a) contact-shadow march first-hit-wins early exit
       (contribution strictly decreases with step index ⇒ identical
       output; megaquad 1.64→1.51 ms at bm7 1728×1117); (b) clouds +
       GTAO + bounce merged into ONE half-res MRT pass (HalfResMrt.ts;
       Gtao.ts = faithful GTAONode port — sky discard becomes ao=1;
       attachments map by TEXTURE NAME; fragmentNode must be the MRTNode
       DIRECTLY or the WGSL output struct loses members). Per-pass at
       bm4 2592×1676: clouds.half 2.75 + GTAO 2.42 + bounce ~0.5 →
       half.mrt 2.75 (−2.4 ms encoder spans, one raster). All ablate
       combos verified. Bloom stays stall-dominated phantom — skipped.
    2. RE-ATTRIBUTION DONE (2026-06-14, user viewport, warm): NO
       per-bookmark whale — r.scene ≈ 11.8-12.3 ms at bm1/bm3/bm4 alike
       (water SSR and impostor far-field are NOT standouts); GPU passes
       overlap heavily (TBDR) and wall tracks ~24 ms while GPU-sum reads
       28-44. **cpu.submit ≈ 12-15 ms IS the binding constraint for the
       120 fps directive** (resolution-independent, draw-count driven).
    3. CPU ROUND 2 — IN PROGRESS. CDP re-profile (bm4, 200 frames):
       Bindings._update 2.64 + UniformsGroup.update 1.1 + nodes
       updateForRender 1.6 + updateMatrixWorld 0.67 (static objects
       recomposing matrices!) + _projectObject 0.51 ms/frame.
       LANDED (0f73791): runiform() = uniform().setGroup(renderGroup) —
       per-object group walks become once-per-shader-per-render-call;
       audited render-only set tagged (wind/vegViewPos/instancing
       bases/water clipmap/sun override/post+gtao uniforms). Effect at
       this slice size within thermal noise — the BULK of material
       uniforms is still object-group. NEXT STEPS, ranked:
       (a) expanded runiform sweep: audit the compute-shared set
       (camU cull copies, cloud density/drift→shadow bake, particle
       respawn, probe gather, caustics focusK) — either split material
       vs compute uniforms or verify compute update ordering, then move
       the heavy per-material params (probe-GI patch uniforms, species
       params are CONSTANTS — ideal); measure with cooled ABAB only.
       (b) matrixAutoUpdate=false sweep for static meshes (veg pools,
       terrain tiles, prepass twins) — 0.67 ms/frame of pure waste.
       (c) draw-count reduction: hand-rolled bundle path (BundleGroup
       broken in 0.184: records before async compiles, ignores
       renderOrder, bypassed per-cascade caster layers — REVERTED).
    4. TRAA CUSTOM RESOLVE (~4.4 ms at user viewport + the largest
       remaining post item): now DOUBLY motivated — leaner resolve AND
       Catmull-Rom history sampling to recover the last ~10-18% HF vs
       the SSAA reference (see cloud-lag entry). Quality-risk item:
       full shot battery + HF-energy checks against 4×SSAA required.
    5. shadow.c0 renders EVERY frame (period-1 cascade): 4.5-7.9 ms
       encoder span at user viewport — investigate quality-invariant
       reductions (caster set already compacted; check span vs stall).
    6. The 120 fps directive at 2592×1676 native on M1 Max is ~8.3 ms
       wall — after exhausting 3-5 plus format/bandwidth passes
       (R11G11B10 post RTs, f16 math in post), present the data; the
       user pre-authorized a 60 fps floor ONLY once every
       quality-invariant path is exhausted.
  - Post-chain floor after scene fixes ≈ TRAA resolve 4.4 + megaquad
    (aerial/AO-apply/contact/bounce) 3.9 + GTAO 2.4 + clouds.half 2.5 +
    bloom-real ~1-2 + screen ~0.4 ≈ 15 ms at this viewport — the next
    GPU tier once CPU is fixed: merge half-res passes (GTAO+bounce+
    clouds one MRT pass), contact-march early-exit, leaner TRAA resolve.
  - MEASUREMENT METHODOLOGY (BINDING for all Phase-7 numbers):
    (a) M1 Max THERMAL DRIFT: cross-run medians drift +50% when hot —
    only ABAB pairs / in-session 24-sample averages count; cool-downs
    between batches; (b) per-pass GPU timestamps are ENCODER WALL SPANS
    incl. dependency stalls (bloom 'cost' 9-13 ms ablated to ~1 ms wall:
    fps flat) — rank with them, VERIFY with wall fps + ablation deltas;
    (c) pixel-equivalence checks MUST use tools/shoot.ts --framealign N
    + --wind 0 + --lockexp 1: unaligned captures differ 20-27% from
    frame-indexed jitter alone, and WITHOUT lockexp the auto-exposure
    feedback amplifies wall-clock particle/water drift between capture
    times into whole-frame shifts (a 0.04%-real diff read 9.85% — flat
    surfaces cross the threshold coherently and look like a lighting
    change). Deterministic floor when fully pinned: ≤0.2%. Water itself
    still animates on wall-clock TSL time — exclude or accept;
    (d) headless fps ≈ wall only when GPU-bound; with the prepass, bm4
    became CPU-submit-bound and 10 ms GPU savings moved fps <1.
- **BUG RESOLVED (2026-06-12): HORIZON TURNS FULL BLACK — was the GTAO
  path, not aerial/CSM.** (User screenshot: shots/wip/horizon-black-user.png.)
  REPRO: lake-basin ground poses (eye ~131 m) — solid RGB(0,0,0) band at
  the far-rim/horizon line at 6 of 8 yaws (tools/probe-horizon.ts: one-boot
  yaw sweep + --scan flat-sightline finder + auto band-scan). Highland and
  spawn poses were CLEAN at every yaw — the band needs long grazing
  sightlines inside the basin, which is why bookmark sweeps never caught it.
  BISECT at the repro cam (-1400,131.6,1250,yaw45,T11): persists under
  ?ablate=water (terrain pixels — the user was right), vanishes under
  ?postmin=1 (post chain), persists under ?ablate=contact, vanishes under
  ?ablate=ao ⇒ GTAO. TWO STACKED MECHANISMS, each sufficient for black:
  (1) JOINT-BILATERAL UPSAMPLE COLLAPSE (PostStack aoFaded): tap weights
  exp2(−3.5·|Δz|) — near the horizon one half-res texel spans 10s–100s m
  of view depth, ALL four taps reject, wsum stays at its 1e-4 seed, and
  aoRaw = acc/1e-4 → 0: the upsampler FABRICATED ao=0 for every grazing
  far surface. Black is then guaranteed: the band sits INSIDE the 700 m AO
  fade-in (from a 1.7 m eye the flat-ground "horizon" is only ~300–700 m
  away ⇒ k≈0) and the dim strip gets no sun-lit exemption (directK=0) →
  aerial × 0 AFTER the haze composes — which is why it beat the atmosphere
  (Pillar D inverted). FIX: gated fallback — wsum > 0.02 (any tap within
  ~2 m) keeps the bilateral result EXACT; support-free pixels fall back to
  the plain 4-tap average. (A global +0.01 weight floor was tried first
  and REJECTED: amp-diff showed a ~1% AO wash across the bm7 hero trunk.)
  (2) GTAO KERNEL SUB-TEXEL DEGENERACY (Gtao.ts; stock GTAONode carries
  the same hazard): past a few hundred meters the 1.6 m world radius
  projects below one depth texel — samples land on the center's OWN texel,
  pass the thickness test with quantization-dominated directions
  (normalize(≈0)) and drive cosHorizons → 1 = "fully occluded". FIX:
  same-texel samples rejected (no horizon information; near-field offsets
  span many texels — unaffected) + f32 guard clamping cosHorizons to
  [−1,1] before sqrt(1−cos²) (NaN at grazing).
  VERIFIED: repro cam black-rows 5→0, min channel 0→105; 8-yaw lakeshore
  sweep 0 black rows (was 6/8); frame-aligned A/B vs pre-fix (--framealign
  200 --wind 0 --lockexp 1, 1280×720): bm7 mean-abs 0.336% with the hero
  trunk BIT-EXACT in the amp-diff (residual = sparse distant-foliage
  speckle where sub-texel noise-occlusion became valid samples — a
  correction, not a loss), bm4 0.275% pond-excluded (pond = wall-clock
  water drift vs a 40-min-old baseline, the known methodology confound).
  bm2 far-rim re-judge: see the entry below.
- KNOWN LIMITATION RE-JUDGED (2026-06-12, after the GTAO horizon-black
  fix above): the far-rim BLACK-stripe component shared that root and is
  FIXED — grazing water hits the same bilateral collapse (verified:
  lakeshore 8-yaw sweep 0 black rows, was 6/8 with solid RGB 0 bands).
  The older diagnosis trail (min-reduced far field dips, SSR-miss
  fallback at grazing fresnel) remains valid for residual NON-black
  dimming; planar-lake pass stays queued as polish.
  **NEW BUG SURFACED by the re-judge shot (NEXT IN QUEUE):** bm2
  (dawn lake, alt 9, T 7.5) renders the near water as giant faceted
  swells with bright white triangular shards at the frame edges
  (shots/wip/bm2-rejudge.png). NOT this session's AO work — ?ablate=ao
  renders identically (shots/wip/bm2-ablao.png) — and NOT present at
  noon lakeshore framings (same lake, dead flat in this session's
  sweeps: shots/wip/horizon-yaw*.png). BISECTED (same day):
  (a) ?ablate=water at bm2 — the dark swells PERSIST (they are wet
  TERRAIN: hummocky wetland-margin/bed geometry with moisture darkening,
  not water; whether that look is acceptable is an art-direction
  question, separate item) while the white shards VANISH ⇒ shards are
  water-surface fragments; (b) same pose at noon (shots/wip/bm2-noon.png)
  — identical tent row along the far shore ⇒ not ToD-specific.
  HYPOTHESIS 1 (margin salt-and-pepper wetness → coarse-vertex tents)
  REFUTED by CPU probes (tools/probe-wetmargin.ts): the area is 93.5%
  wet with ZERO isolated wet texels, and a transect along the bm2 ray
  (--transect) shows a textbook flat lake — W smooth 271.35→271.22
  over 460 m, no adjacent-sample jumps > 0.6 m, fully wet, ground
  10–26 m below W. NOTE: the bm2 water body is an UPPER lake at fill
  ~271 m, not the 131 m SW lake (and FlyCamera's fly-mode ground clamp
  silently lifts too-low --cam y values — a "y=140" probe shot
  actually rendered from ~253 m; harmless here, but remember when
  posing probes). CURRENT BEST CANDIDATE: the documented min-reduced
  FAR-FIELD DIP — levels with cell ≥ 12 m sample block minima, and
  shore-overlapping blocks pull surface patches meters below the fill
  level; those PIT WALLS seen edge-on are tilted facets that now read
  WHITE under sky fresnel. The original bm2 "thin dark band" was
  diagnosed as these same dips — the Phase-6 fresnel/SSR reworks
  plausibly flipped their read from dark to white. The tent row's
  range sits in the level-12 annulus (±384–768 m). CONFIRMATION NEXT:
  add a water-surface GEOMETRY debug (?waterdbg=7: paint
  positionWorld.y minus a reference level as emissive) at the bm2
  framing — tents colocated with min-reduce block boundaries ⇒
  confirmed. FIX SKETCH (test against the documented regression set):
  replace far-level min-reduce sampling with full-field + a
  mixed-footprint vertex gate (5 taps at ±cell/3; spread > ~1.5 m ⇒
  collapse) — polarity needs care: dry-dive values sit BELOW W on
  beaches but ABOVE W on tall banks (terrain depth-test already clips
  banks, so collapse-to-min may suffice). Regression set: tall banks,
  dry land below fill level behind the outlet dam, the inlet
  lens/dome cases that killed min-of-wet, narrow channels at
  distance, level-boundary pop. Alternatively the long-queued
  planar-lake pass / per-water-body far field solves it structurally.
  ROUND 3 (2026-06-12): the min-reduce-dip hypothesis was TESTED AND
  REFUTED for the visible shards — the mixed-footprint vertex gate
  (full-field sampling all levels + 5-tap collapse for cell ≥ 6) was
  implemented, verified present in the served module, and the white
  shards at bm2 AND both SW-lakeshore framings were UNCHANGED. The
  gate was REVERTED (never committed) per ship discipline: it didn't
  fix the target and its own benefit (flat far lakes) was never
  independently verified — re-derive from this entry if the far-dip
  item is picked up again. NEW EVIDENCE, foam channel (?waterdbg=1
  at bm2): foam SATURATES in a broad gradient across the far half of
  the lake exactly where the slabs sit ⇒ the white slabs are
  SHORE-FOAM (colorNode = white × foam, sun-lit) painted far beyond
  any real shallow zone. shoreFoam keys on vDepth =
  thick·max(|viewDir.y|, 0.06) — suspects: (a) the 0.06 grazing
  floor manufacturing "shallow" at grazing views; (b) thick =
  fragZ − zScene collapsing where the opaque depth behind far-rim
  water belongs to the BANK at the waterline (ray-thin ≠ shallow);
  (c) something zeroing thick wholesale at this framing — the
  ?waterdbg=5 (thick/vDepth) probe at bm2 painted the ENTIRE lake
  black (thick ≈ 0 everywhere?!) but that frame is UNREADABLE: the
  near-zero emissive debug dragged auto-exposure way up and the dawn
  grade washed the rest red. RERUN ?waterdbg=5 with exposure killed
  (NoToneMapping like the ?cloudview path, or ?lockexp=1, and at
  T=12 — bm2-noon shows the slabs too) before trusting any thick
  conclusion. ALSO RE-EXPLAINED: the "dark hummocky swells" — the
  waterdbg opacity-1 view shows the water mesh covering that whole
  area, so the swells are the BED REFRACTED through near-transparent
  water (opacityNode keys on the same vDepth → one false-shallow
  root, two symptoms: foam white + see-through). The earlier
  "swells persist under ablate=water ⇒ terrain" read needs
  re-judging — the bed may itself be hummocky AND the water may be
  wrongly transparent; both can be true.

## Key decisions log

- **D1** Pin three@0.184.0; mitigation for API drift: read installed source, keep notes in
  docs/THREE-NOTES.md. Downgrade to 0.180.x only if 0.184 breaks something structural.
- **D2** Tracking: STATUS.md (this file) = source of truth; harness task list mirrors phases
  (tasks #1–#8 = phases 0–7); git commit per milestone. DELTA.md / DEVIATIONS.md per spec.
- **D3** World macro-layout is code-guided for art direction (composed, per Pillar E): main
  glacial U-valley NE→SW with river → lake in SW low corner; serrated alpine massif N/NE
  (Witcher frame); tower-karst forest ravine biome center-S (scene1/3); meadows + rolling
  forest between; wetland margin at lake. Detail fully procedural + seed-driven.
- **D4** Verification screenshots: prefer headless Playwright Chromium with WebGPU/Metal flags;
  fall back to headed if headless adapter unavailable. (Resolved Phase 0 → record flags above.)
- **D5** Per-instance tree uniqueness strategy: K structural variants per species per LOD ring
  + continuous per-instance GPU deformation (lean/droop/crown asymmetry/age/hue) + bespoke
  unique meshes for nearest hero trees (background-generated, cached). Document in DEVIATIONS.
- **D6** Erosion default 2048² active grid (spec floor) on 4096² synth field; `?quality=ultra`
  runs 4096². Decide final default by measured load time (~budget ≤15 s gen).

## Architecture map (planned; update as built)

```
src/core/      Engine, Diagnostics, Params, Seed, Profiler, Quality presets
src/gpu/       passes/ (Heightfield, Erosion, Flow, Biome, Scatter, Cull, Probes, Clouds,
               Froxel, Wind, Particles, TexSynth), HiZ, indirect helpers, noise lib (TSL+WGSL)
src/world/     Heightfield(owner of terrain textures), TerrainTiles(quadtree+meshlets),
               Streaming, Biomes, Rivers, Lakes, Snow
src/vegetation/ TreeBuilder + species/, RockBuilder, GrassSystem, Shrubs, Flowers, Ferns,
               Debris, Deadfall, Dressing, Impostors
src/render/    Materials (terrain/bark/foliage/rock/water TSL), ShadowSetup(CSM+PCSS+contact),
               GIProbes, PostStack (TAA/GTAO/bloom/grade/DoF), AutoExposure
src/sky/       AtmosphereLUTs, SkyModel, SunIBL, Clouds
src/debug/     HUD, Scenes (gallery/terrain/...), Bookmarks, Flythrough, Compare overlay
tools/         shoot.ts, compare.ts, battery.ts (Playwright verification battery)
shots/         screenshot output (gitignored except curated phase closes → shots/phase-N/)
docs/          THREE-NOTES.md (API gotchas), DELTA.md, DEVIATIONS.md, COLOR-SCRIPT.md
```

## Reference image analysis (art targets)

- `scene1.png` 1920×1080-class, noon ravine: cobbled dry streambed w/ trickle, rounded mossy
  boulders, dark cliff overhangs framing top corners, lush karst towers midground, luminous
  white-blue haze bg. Shadows: blue-gray on rock, green-filled in foliage. Value structure:
  dark frame → lit mid → bright bg.
- `scene2.png` gully close-up: deadfall logs across cobbles, deep-green mossy overhang (shadowed
  but COLORFUL), sunlit tower behind.
- `scene3.png` karst forest vista: dozens of vegetated rock towers receding through 4+ haze
  layers; canopy sea between towers; soft broken-cloud toplight.
- `02_Silver_Demo_Wallpaper...png` (Witcher IV, 3840×2160): golden hour alpine; dark foreground
  outcrop + figure (silhouette framing); serrated rust-red peaks w/ slope-correct snow; conifer
  slopes down to huge hazy valley; cloud sea BELOW summits wrapping ridges; god rays from
  upper-left sun; teal-orange split (warm rock/lit conifers vs cool snow shadows/valley haze);
  scattered dead snags on right slope.
- Implied landforms: serrated ridged massif + vertical-walled tower karst + glacial valley.
  Terrain synthesis needs an explicit tower/mesa formation term, not just ridged fBm.

## Phase 1 progress snapshot (2026-06-10)

Done: synthesis (macro layout + karst towers + anisotropic ridges), pipe-model erosion
(hardness-aware thermal), multigrid lake fill, particle flow accumulation, river carve +
channel enforcement, lake w/ outlet, moisture; debug hillshade preview + `?view=hydro`.
Remaining for phase close: TerrainTiles (CDLOD quadtree + far shell), real PBR terrain
material (triplanar/splats/snow/macro variation), biome+snow classify pass, `?scene=terrain`
split view, ground-clamped camera helper, silhouette/tiling gate + DELTA.md.

## Gotchas / lessons learned (append-only)

- WebGPU secure-context + headless-shell traps → see "Verified environment facts".
- TSL `.assign()/.addAssign()/.toVar()` require an active stack (inside `Fn()`); material node
  graphs are NOT inside Fn → shared TSL helpers must be pure expression builders (NoiseTSL is).
- @types/three 0.184 types nodes generically: use `Node<'vec3'>` aliases from `src/gpu/TSLTypes.ts`
  (`NF/NV2/NV3/NV4…`); bare `Node` has no operators/swizzles.
- `three` and `three/webgpu` both re-export from `three.core.js` — safe to mix imports.
- `StorageTexture` defaults rgba8unorm + `mipmapsAutoUpdate=true` (auto mips after compute
  writes when generateMipmaps). For float data set `.type = FloatType` etc.
- Verify cast shadows w/ custom `positionNode` on instanced meshes when real shadows land
  (Phase 2) — sanity scene shadows looked absent; may need `material.shadowPositionNode`.
- Compute storage-buffer limit: default 8 per stage — request more via
  `requiredLimits` (done in Engine; adapter max here = 10) AND keep kernels lean.
- TSL atomics: `instancedArray(n,'uint').toAtomic()`; then ALL access via
  atomicStore/atomicAdd/atomicLoad; `float(atomicLoad(...) as unknown as NU)` for reads
  (AtomicFunctionNode lacks value-typed methods in @types).
- mx_noise/mx_fractal outputs are SIGNED — remap explicitly or lowlands sink below
  lake level ("puddle plague").
- Relaxation-style fills propagate ~1 cell/iter: ALWAYS multigrid them.
- A lake without an outlet river floods its valley to the spill saddle.
- Endless-loop debug rule: when iterating visual passes "with no effect", first verify the
  served code changed (curl the module), THEN check upstream state assumptions.
- Per-component Rng streams (seed.rng('x')): adding draws must never re-roll other systems.
- 1D dispatch >65535 workgroups: three auto-splits to 2D and instanceIndex stays linear —
  but pad-guard every kernel (`If(i >= N) Return()`).
- RenderPipeline.outputNode runs on a QUAD camera: `cameraPosition`/`cameraWorldMatrix`/
  `cameraProjectionMatrixInverse` resolve to THAT camera (silently wrong values, no error).
  Pass scene-camera uniforms explicitly (this is why three's GTAO/TRAA take `camera`).
- Depth here is CLASSIC convention (sky/clear = 1.0). Verify per pass — don't assume
  reversed-z. Probe in-shader (paint values) rather than reasoning from docs.
- Tooling traps: vite fsevents misses tool-driven writes → `server.watch.usePolling` in
  vite.config; esbuild strips comments from served TS → grep served code for IDENTIFIERS
  only; numeric literals get rewritten (1000 → 1e3).
- `fps` in headless ≠ GPU throughput (CPU submits ahead). Use gpuPasses timestamps,
  median over many samples (`tools/shoot.ts --gpusample N`), plus `?ablate=` attribution.
- GTAONode defaults (16 samples) cost ~50 ms on 1080p terrain vistas; resolutionScale 0.5
  produced row-streak artifacts — keep full res, 8 samples.
- Filled-DEM flats have a UNIFORM ε-tilt: particles crossing them all align to it and
  print parallel straight lines. Stop particles below ~2× the ε slope (and in lakes).
- device.onuncapturederror is wired in Engine — silent black frames usually mean a
  LOGIC bug (wrong uniforms), not a validation error.
- WebGPU `readRenderTargetPixelsAsync` rows are TOP-left origin — flipRows()
  before building DataTextures or every capture is v-flipped (was invisible on
  near-symmetric sprays, obvious on trees).
- Capture scenes MUST use DoubleSide materials — leaf blades facing away from
  the ortho camera get backface-culled and the atlas comes out empty (bit the
  broadleaf tiles; conifer needles survived by accident of normal tilt).
- Real-geometry needles at true scale are sub-pixel at review distance — they
  vanish under TRAA. The ez-tree lesson: lushness = BIG captured cluster cards
  (one card = a whole painted spray); real needle geometry is for the hero ring
  where pixels exist. Hybrid (cards + mesh) wins close-up.
- Tree structure realism (user feedback): foliage must sit on a FINE twig level
  (planar two-sided branchlet lattices for conifer boughs / distichous beech
  twigs), never directly on primaries — `planar` LevelParams flag.
- Auto-exposure note again for assets: albedo tweaks barely move the frame;
  judge materials by RELATIVE contrast (bark vs foliage vs ground).
- 8-bit capture of dark albedos bands — sqrt-encode at write, square at sample
  (foliage atlases, bark, impostors all do this).
- Broken-trunk taper: trunk points span only the kept length — taper must use
  t×brokenTop or the break ends in a spike and the jagged cap never triggers
  (also: don't double-cull children above a break that's already shortened).
- TSL toVar/assign (incl. inside helper fns like a hash!) need a Fn() stack —
  material node graphs DON'T have one. Shared helpers must be PURE expression
  chains (pcg2d was rewritten for this).
- WGSL buffer indices must be i32/u32: a float select-chain `.toInt()` can
  still emit an f32 var as index — use int(0).toVar() + If-assigns.
- sim-res hydrology vs full-res height: W−h and riverDepth comparisons need
  generous thresholds (≥0.25 m) or interpolation mismatch flags whole
  floodplains as "under water" (silently deleted 53k trees + all grass there).
- three shadow contract for custom materials: shadow alpha = colorNode.a ×
  alphaTest copy — vec3 colorNodes silently discard ALL caster fragments.
  Pin vec4(rgb,1) + maskShadowNode for alpha-tested cutouts. Instanced
  positionNode ALSO needs castShadowPositionNode set explicitly.
- Custom instancing must rotate normals: assign normalLocal inside the
  positionNode Fn (three's own InstanceNode mechanism). "Quasi-radial normals
  don't need rotation" is wrong — per-fragment lighting flips sides.
- frontFacing-based debugging on DoubleSide cards is ambiguous (rolled quads
  show both faces) — verify winding on closed tubes or single-sided geo only.
- FlyCamera owns camera orientation: scenes can't lookAt; pass spawn pose via
  hooks.initialPose (applied after the rig exists). ?pitch= now works.
- Indirect-draw stack that works on three 0.184/WebGPU: Mesh (not
  InstancedMesh) + geometry.setIndirect(attr, byteOffset) + instanceIndex
  reads via compact list; counts written by compute into the SAME
  IndirectStorageBufferAttribute via storage(); frustumCulled=false.
- CSMShadowNode (three 0.184): cascade shadows CLONE light.shadow — set
  sun.shadow.camera.near/far EXPLICITLY (defaults near .5/far 500 <
  lightMargin → empty maps, no errors). Lazy _init samples the projection
  at first material build (TRAA jitter/boot transients → NaN extents cached
  forever); apps must call updateFrustums() after camera changes — we
  refresh jitter-stripped + verify finite + resize hook (ShadowSetup).
- Shadow-debug traps that burned hours: (1) judge shadow PRESENCE only with
  the sun positioned so shadows fall TOWARD the camera (they hide behind
  casters otherwise — false "doesn't cast" reads); (2) FlyCamera owns
  orientation — debug scenes MUST set hooks.initialPose or every shot frames
  the wrong spot; forward = (−sin yaw, 0, −cos yaw); (3) headless static
  shots ≠ user's interactive session (DPR 1.5, window resizes, continuous
  motion, TRAA history) — verify BOTH before declaring lighting fixed;
  (4) ablate evidence goes STALE after upstream fixes — re-run the matrix.
- vdata trick for artifact triage: ?clsdbg=1 flat-colors every veg class
  (hue = cls·47°) — identified "dark slabs" as beech cards in minutes after
  hours of wrong guesses (they were SPECULAR-washed cards: one flat normal
  per card ⇒ uniform silver sheen at glancing sun; foliage cards must be
  near-diffuse, roughness .92).
- **TSL `cameraPosition` is PER-PASS** — in the shadow pass it's the cascade
  shadow camera (~lightMargin away from everything). ANY camera-distance
  logic that discards/collapses geometry (LOD fades, distance culls,
  billboard shrink) silently deletes those casters from EVERY cascade map
  while the main view stays perfect ("vegetation casts no shadows" bug —
  weeks of misdirected CSM debugging). Route fade distances through an
  explicit main-camera uniform (vegViewPos in VegInstance).
- maskNode vs maskShadowNode (three 0.184): maskNode discards in the MAIN
  pass; the shadow pass uses maskShadowNode ?? maskNode. Dither-fades belong
  in maskNode with maskShadowNode pinned (cutout or bool(true)) — if both
  rings of an LOD crossfade dither the SHADOW pass with the same IGN,
  correlated texel holes thin the shadow exactly at every ring band.
- Differential debugging beats layer-bisection when a system "half works":
  the user's "terrain casts, vegetation doesn't" + "stones cast, trees
  don't" observations localized in minutes what ablate-matrix bisection
  (filter/post/GI/material/cascades) couldn't — ask WHICH objects differ,
  not WHICH pipeline stage.
- Shadow-proxy lessons (user-reported "small objects, massive flickery
  shadows in a circle"): (1) proxy dims must FIT the pool's real geometry
  (class-max cull bounds oversize small variants ~2×); (2) NEVER dither
  shadow casters with screen-space IGN — cascade boxes refit every frame
  so the pattern swims = flicker; anchor dither in WORLD space
  (hash12(positionWorld)); (3) texel-metric PCSS penumbra caps are
  cascade-relative — 14 texels = 28 cm near, 21 m far; convert blur to
  WORLD meters via reference('left/right/near/far', shadow.camera);
  (4) any caster-reach cutoff by camera distance prints a visible CIRCLE
  on the ground from altitude — fade casters out (impostor-band proxies
  to 1.1 km), never hard-stop them.
- An "identical render" after a lighting change usually means auto-exposure
  re-normalized it away: judge lighting work by ablate A/B DIFFS and the
  ?view=probes ambient view, not by absolute frame brightness.
- MeshGrower enforces NO winding convention — every generator owns its own.
  Tube basis (N, B=T×N) needs base-ring-first quads (a[k], a[k+1], b[k+1],
  b[k]) for outward fronts; an x/z lathe param (cos a, ·, sin a) is LEFT-
  handed → the MIRROR order; caps advancing along −T flip handedness again.
  DoubleSide masks reversed winding silently (bark "insurance" hid the tube
  bug for two phases) — FrontSide materials (deadwood/mushroom/rock) expose
  it. User-reported on logs/stumps/branches; fixed at source 1a80f86.
  Also: tubes have no ring-0 cap — fine attached to a parent, an OPEN HOLE
  on free-lying deadfall (capBase opt). Verify new closed geometry with
  ?facedbg=1 (front green / back red) before shipping it.
- flowStrength is a SHARED driver (carve depth, moisture, splat beds, veg
  gates, boulder affinity). NEVER retune its threshold for rendering — the
  whole world re-layouts (rivers move, forests shift). Split thresholds:
  RIVER_T = terrain texture, WATER_T = visible water (FlowRivers).
- Pond/lake water surface must be the FILL LEVEL W (flat per pond, meets
  terrain at the true shoreline). bed + blurred(depth) builds 30 m faceted
  water towers wherever deep pots abut high ground (blur smears depth onto
  ridge cells). Dry cells in the render field sink below the 3×3
  NEIGHBORHOOD-MIN bed (own-bed−2 still stands above channel water on tall
  banks = water walls). Wet cells get 2 smoothing iterations (wet-masked)
  or cascades render as 2 m staircase shards.
- Water clipmap traps: (a) far levels MUST sample a min-reduced field —
  coarse verts on the full field stretch one wet texel across a 48 m cell
  ("mountains half under water" from afar, gone up close); (b) clamp-to-
  border sampling extends any wet border texel into an infinite off-world
  sheet — hard world-bounds mask in the material; (c) animated foam must
  advect with the TWO-PHASE flowmap like the normals — linear time
  advection slides thresholded fbm level sets into hard white stripes.
- Water fresnel MUST use a flattened normal (n.xz × ~0.3): per-pixel
  ripple tilt explodes (1−cosθ)^5 at ANY view angle → 100% sky mirror =
  "white sheet over every stream". Ripples shape WHAT reflects (rdir),
  the MEAN surface decides HOW MUCH. Debug ladder ?waterdbg=1..6.
- SSR sky fallback must be terrain-horizon-tested: a gorge stream "sees"
  walls in its mirror, not open sky — 4 nearest height probes along the
  reflected ray + probe-GI irradiance toward the ray as the occluded
  fallback (the probe field already knows wall/canopy brightness).
- Veg/debris water gating must key on the ACTUAL water surface (waterY),
  never the riverDepth apron (widen-blurred ~0.12 m floor flags whole
  gorge floors "river" → bald banks). Generous ≥0.25 m thresholds only
  apply to W−h comparisons (sim-res interpolation), not waterY−h.
- Per-frame StorageTexture mips DO auto-regenerate after renderer.compute
  (mipmapsAutoUpdate default) — .bias() depth-defocus on the caustic tile
  works; verify mips with a forced-bias debug view before trusting them.
- AUTO-EXPOSURE eats naive emissive debug probes: a 131k-quad emissive-40
  wall crushed the whole scene black and read as "particles broken" — when
  a debug overlay must be judged, render it DIM (≤2) or kill exposure
  (?cloudview-style NoToneMapping path), and remember transparent quads
  behind water depth-fail (water writes depth).
- TSL `time` is NOT frozen by ?freeze=1 (only engine worldTime is): two
  shots with different --settle counts sample different wind/water phases
  — that's the cheap motion A/B; anything that must stay deterministic
  per-shot (cloud drift) must run on WORLD time via a CPU uniform.
- UPDATE-ORDER CONTRACT (cloud-lag postmortem): updateFns run in
  registration order; anything that MOVES the camera must register before
  anything that COPIES camera state, and movers must updateMatrixWorld()
  (matrixWorld otherwise recomposes only at render). FlyCamera registers
  first in main.ts; PostStack ignores the contract entirely by syncing at
  render() time. The flythrough (installBookmarks, registered late in the
  scene build) still moves the camera after earlier-registered subsystem
  copies (cull/water/froxels) — one-frame staleness there is bounded
  (overlap bands absorb it) but don't add new screen-space consumers to
  onUpdate; sync them at render time like PostStack.
- Headless setPose probes CANNOT reproduce interactive camera-motion bugs
  in updateFn-order territory: setPose mutates between frames, so every
  updateFn sees the fresh pose. Mid-update mutation only happens via
  FlyCamera/flythrough — reason from code order, verify live.
- Pointer-lock verification traps: headless Chromium rejects EVERY
  requestPointerLock with WrongDocumentError ("root document not valid") —
  pointer-lock UX is only probeable HEADED (chromium.launch headless:false),
  and the window needs page.bringToFront() or macOS never grants focus and
  the request silently never resolves. A Playwright-synthesized Escape does
  NOT reach the browser's pointer-lock accelerator — exercise the cooldown
  via document.exitPointerLock() instead. Also: tsx/esbuild injects a
  `__name` helper around named function expressions inside page.evaluate
  callbacks → ReferenceError in the page; pass big instrumented blocks as
  STRING evaluates (tools/probe-pointerlock.ts documents the pattern).
