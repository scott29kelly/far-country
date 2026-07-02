# Plan — World-building tooling + Scripture-as-grounding-data

> **Status:** ANSWERED 2026-07-02 — Scott responded to all §4 open questions
> (answers recorded inline there). The plan is now actionable: Phase A (live
> panel) → B (config) → C (staging), and the Scripture-as-data track starts
> with the temple (Ezek 40–42) proof-of-concept. Next artifacts owed: the
> concept ADR for Scripture-as-grounding-data (§3 step 1), the units/scale
> ADR building on ADR 0014, and a `debated`-tier RENDERING-DECISIONS entry
> for the Ezekiel-city/John-city harmonization when rendered.
> **Nature:** This is a *planning + investigation* doc, not an accepted decision.
> When the Scripture-as-data approach (§3) is decided, open a real ADR for it
> (ADRs are append-only decisions; this draft is not one).
> **Why it exists:** so the 2026-06-22 discussion is not lost. It distills a
> research pass over an external reference and the design conversation that
> followed.
>
> **Overtaken by events (2026-07-02, M3 city material pass):** Phase B's
> "latent tier-table bug" is FIXED (`cityModel.CITY_TIERS` is now the shared
> source of truth for CityMassing + RiverOfLife), and Phase C's "instance the
> repeats" is partly DONE (arcade arches, piers, dentil courses instanced;
> trees of life rebuilt as real pipeline trees). Scope Phases B/C against
> the current source, not §2's snapshot.

---

## 0. Origin & context

The seed was an X profile Scott flagged: **Playda (@PlayDaaa)**
(`https://x.com/PlayDaaa`). Primarily a crypto/on-chain trader, but for ~2 weeks
in June 2026 he has been build-in-public on **procedural 3D world generation** —
our exact problem space. Extracted from his June 2026 timeline:

**His explicit "full stack" (Jun 21 2026):**
- **Data:** Copernicus DEM (10–30 m elevation), OpenStreetMap via Overpass/osmnx,
  ESA WorldCover (land cover), Google Photorealistic 3D Tiles
- **Geoprocessing:** Python + GDAL + rasterio + shapely/geopandas
- **3D:** Three.js / React Three Fiber, Blender + Blosm

**Pipeline concept** ("Monaco, Hour 1→3"): *bounding box in → playable city out.*
DEM → heightmap; OSM footprints extruded to real heights; roads/water/parks/
coastline from open data; baked low-poly; 2,671 buildings + ~15,800 trees
real-time at 165 fps in-browser, zero hand-modeling.

**Techniques worth stealing:**
- UTM projection so **1 unit = 1 meter**
- **Staged assembly cascade** you can watch: relief → footprints → extrude →
  roads → greenery → final light & grade
- **"Every element is an editable, typed, instanced mesh — not a baked
  screenshot. Swap one asset, the whole city restyles. Regenerate from fresh
  data anytime."**
- Per-target export profiles (UE5 Nanite; Roblox mesh limits)

**His thesis (Jun 22 2026) — the real gold:**
> *"Sometimes you have to take a step back and build the right tools before
> building the world."*
- **"Atelier"** — in-app procedural editor: select a map zone → it lists every
  prop there → edit / **batch-edit grouped props** (by size/style/category) →
  save → instantly reflected.
- *"I haven't manually sculpted a Roblox environment in weeks… hand-building game
  environments is about to feel as outdated as hand-coding HTML."*

**The honest fit:** his *actual pipeline* (real place → game map via geo-data) is
the **least** transferable part — the New Jerusalem is a scriptural, symbolic
city with no OSM footprints or DEM, and matching a real location would violate
our grounding. What transfers is his **engineering discipline** (tooling-first,
data-driven, instanced, staged, live-editable) — and §3 below, where Scott
reframed the "grounding data" idea into something much stronger.

Credits/links he mentioned: @alightinastorm (the spark), his studio
@Aurumworkstudio (Roblox incubator, game "dust haven"), and a linked demo/
write-up `t.co/kIpkbbgulV` (**not yet opened** — TODO if we want more detail).

---

## 1. Plan — ideas #1–3 (world tooling)

Dependency: **#2 (a config object) is the spine**; #1 (panel) binds to it; #3
(staging/instancing) optimizes it. But a live panel can ship *before* the full
refactor because many params are already live-mutable. Phased:

### Phase A — Live tuning panel, quick win (`?edit=1`)
A small **Tweakpane** panel, gated behind a URL flag so it never ships to the
public world. Bind to handles we *already* mutate live (no refactor needed):

| Control | Bound to | Live today? |
|---|---|---|
| Time of day | `sunSky.setTimeOfDay()` | yes |
| Aerial clarity / fog | `atmosphere.aerialClarity / aerialFogK .value` | yes |
| Glory intensity | `gloryMat.emissiveIntensity` | yes |
| Gold / crystal palette | `mass.color` / material refs | yes |
| River emissive / tone | `water` material ref | yes |
| Camera pose bookmarks | `__laas.setPose` | yes |

Kills most of the rebuild→screenshot loop. **Effort: low. ROI: highest.**

### Phase B — Data-driven city schema (idea #2)
Lift scattered constants into one typed source of truth:
**`apps/world-engine/src/nj/config.ts` → `NewJerusalemConfig`** (scale, tier
table, palette, emissive curves, glory, river, allotment dims, atmosphere
overrides, ToD).

- **Fixes a real latent bug:** `RiverOfLife.ts` currently *re-declares* the
  city's tier table — if `CityMassing` tiers change, the river silently desyncs.
- Builders (`CityMassing`, `RiverOfLife`, `Allotment`) consume the config.
- Add **`rebuildNewJerusalem(config)`** so structural params (tier widths, arch
  counts, scale) change live via a "Rebuild" button; add **"Copy config → JSON"**
  to persist a tuned look back into code.

**Effort: medium. ROI: high — foundation for #1's full version *and* for §3.**

### Phase C — Staged assembly + instancing (idea #3)
- Refactor `buildHolyAllotment` into **named, toggleable stages** (plateau →
  massing → arcade detail → river → trees → temple → glory): better debugging
  now, bones of a "city assembles itself" intro later.
- **Instance the repeats** (trees of life, dwelling grid, arcade arches, piers)
  → `InstancedMesh`. The LAAS engine already instances ~190k vegetation, so
  there's precedent and headroom.

**Effort: medium. ROI: medium, compounding.**

**Sequencing:** A → B → C. Phase A is shippable in one pass.

---

## 2. Build state at time of writing (continuity)

- Branch `claude/fable5-world-demo-by2tyh`, pushed through commit `cd30b47`.
- Done this session: scale → ~2.5 mi (`NJ_SCALE 20`, [ADR 0014](../adr/0014-citywide-scale-rendering.md));
  glow/de-haze/front-light (self-luminous tiers, `aerialClarity`/`aerialFogK`
  uniforms, default `T=17` afternoon sun); river of life + trees
  ([RiverOfLife.ts](../../apps/world-engine/src/nj/RiverOfLife.ts)).
- **Queued material passes** (paused to do this planning): gold-as-glass + real
  arch depth (the next pass we were about to start); twelve jewelled foundation
  courses (Rev 21:19–20); glazed summit pavilion + warm the washed upper tiers;
  twelve distinct pearl gates; tone the river water bluer.

---

## 3. Idea #4 — Scripture *is* the grounding dataset (investigation)

**Scott's reframe, which flips my original take.** I had dismissed real-world DEM
as the wrong data for a scriptural city. Scott identified the *right* data: the
inspired text already contains a detailed dimensional survey.

### The analogy is exact
Playda feeds his generator open survey data (DEM elevations, OSM footprints with
real heights) and geometry places itself to those coordinates — *measured, not
hand-tuned.* **Ezekiel 40–48 is literally a survey:** a man with a measuring reed
walks the temple and calls out exact cubit dimensions for every gate, court, and
chamber, plus the land allotment. Revelation 21 gives the city's overall
dimensions. So we can treat those cited measurements as our grounding dataset and
**derive the geometry from them**, exactly as he does with OSM/Google data.

This is the **strongest possible expression of the project's #1 non-negotiable**
("every claim carries a citation"): today `NJ_SCALE = 20` and tier widths are
hand-tuned to *look* right; under this approach **every dimension traces to a
verse** — the geometry itself becomes cited, directly attacking the "geometry
can't footnote itself" problem in [ADR 0009](../adr/0009-symbolic-vs-literal-rendering.md)
rule 4.

### Raw dataset — what Scripture actually measures
| Source | Gives us |
|---|---|
| **Ezekiel 40–42** | The temple complex, exhaustively — gates, courts, sanctuary, chambers, in long cubits (reed = 6 cubits, 40:5) |
| **Ezekiel 43:13–17** | The altar |
| **Ezekiel 45:1–6** | The holy portion — priests' / Levites' / city strips (25,000 × …) |
| **Ezekiel 48:8–22, 30–35** | The whole allotment; the city 4,500 cubits/side + 250-cubit suburbs; twelve named gates (3/side); the prince's land; the city's name "The LORD Is There" (48:35) |
| **Revelation 21:15–21** | The New Jerusalem — 12,000 stadia (L=W=H, 21:16), 144-cubit wall (21:17), twelve pearl gates, twelve gem foundations (21:19–20) |

Much of this is **already captured** in
[willis-new-jerusalem-model.md](../sources/willis-new-jerusalem-model.md)
(size / cubit / Ezekiel-harmonization section) — groundwork is partly done.

### The interpretive layers (where hermeneutic discipline earns its keep)
1. **Units are contested.** Ezekiel's *long* cubit (≈0.52 m, 40:5/43:13) vs the
   common cubit; stadia (≈185 m) vs **Willis's "12,000 stadia = the area, not the
   edge" reading** (≈12 mi/side). Numbers are exact *in the text*; their metric
   realization is a **decision** to document (an ADR building on
   [ADR 0014](../adr/0014-citywide-scale-rendering.md)).
2. **City ≠ Temple.** Ezekiel's measured structure is the **temple + allotment**,
   distinct from and adjacent to the New Jerusalem (Rev 21:22 "I saw no temple";
   Willis). We already model these as two things; the dataset must tag which
   measurements belong to which.
3. **Measured vs. interpretive.** Scripture gives the temple exhaustively and the
   city's *overall* cube/wall/gates/foundations — but **not** the New Jerusalem's
   step-pyramid tier subdivision (Willis's reading, logged in
   [RENDERING-DECISIONS #1](../../RENDERING-DECISIONS.md)). The generator must
   distinguish **grounded** dimensions (drive geometry directly, cited) from
   **interpretive** ones (a documented rendering choice) — Playda's "from OSM" vs
   "hand-tuned" split.
4. **Harmonization is itself a position.** Whether Ezekiel's 4,500-cubit city and
   John's 12,000-stadia city are the *same*, *nested*, or *distinct* is a
   `debated` call to record.

### How it merges with #2 (the elegant part)
`NewJerusalemConfig` (idea #2) becomes the **bridge**: its values aren't
hand-typed, they're *produced by* a **units/scale resolver** that reads the cited
measurement dataset and applies the chosen hermeneutic.

> **Cited measurements** (Ezek/Rev, tier-tagged) → **units/scale resolver**
> (applies the documented reading) → **`NewJerusalemConfig`** → **parametric
> builders** → WebGPU scene

Payoff mirroring Playda's "regenerate from fresh data": **you restyle by changing
the *interpretation*, not the model** — toggle Willis's ~12-mi reading vs the
mainstream ~1,380-mi vs our viewable ~2.5-mi, all from one dataset.

### Investigation / pursuit steps
1. **Concept ADR** — "Scripture as grounding data for parametric geometry": the
   inventory above, the units problem, the city/temple split, the
   grounded-vs-interpretive boundary.
2. **Measurement extraction** — the cited dimension dataset for Ezekiel 40–48 +
   Rev 21 (a new "measurement"/dimension record type alongside descriptors; real
   Phase-1 dataset work, not just rendering).
3. **Units/scale resolver** module + the ADR fixing the cubit/stadia
   interpretation.
4. **Wire into `NewJerusalemConfig`**, temple/allotment first.

**Recommended proof-of-concept:** start with the **temple (Ezek 40–42)** — most
exhaustively measured, currently just a placeholder, and *viewable at literal
scale* (it's small), so no city/cube interpretive baggage. Cleanest first win.

---

## 4. Open questions for Scott — ANSWERED 2026-07-02

**Ideas #1–3**
- a. Confirm sequencing A → B → C, starting with Phase A (the live panel)?
  **✔ Confirmed** — A → B → C, Phase A first.
- b. GUI lib: **Tweakpane** (my pick — small, modern) vs lil-gui / dat.GUI?
  **✔ Tweakpane.**
- c. Gating: panel stays dev-only behind `?edit=1`, never in the public build — agreed?
  **✔ Agreed** — dev-only; the panel never ships in the deployed `/world-preview`.
- d. "Copy config → JSON" round-trip — paste-back into `config.ts`, or write to a
  file the build reads?
  **✔ Copy → paste-back into `config.ts`** — config stays typed, in source, reviewable in git.

**Idea #4 (Scripture-as-data)**
- e. Start the extraction with the **temple (Ezek 40–42)** as the proof-of-concept? (recommended)
  **✔ Yes — temple first** (doubles as the CITY-QUALITY-BAR delta #8 temple-identity rebuild).
- f. Cubit/stadia interpretation to fix first: keep the **viewable-scale
  compromise** ([ADR 0014](../adr/0014-citywide-scale-rendering.md)) layered on
  top of literal measurements? Proposed split: **temple = literal-grounded**
  (it's small/viewable); **city = grounded-form + interpreted-scale.** Confirm?
  **✔ Split confirmed** — record it as an ADR building on ADR 0014.
- g. Does the **measurement dataset** live in the same canonical store as
  descriptors (new record type), or separate?
  **✔ Same canonical store, new `measurement` record type** — same citation +
  review discipline as descriptors; needs a `docs/data-model.md` addition.
- h. Harmonization stance (Ezekiel city vs John city: same / nested / distinct) —
  your call, or hold as `debated` and render Willis's harmonization?
  **✔ Hold as `debated`; render Willis's harmonization** — record a
  RENDERING-DECISIONS entry when rendered; the dataset commits to no position.
- i. Want me to **open the linked Playda demo/write-up** (`t.co/kIpkbbgulV`) for
  any extra technique detail before we build?
  **✔ Opened 2026-07-02:** it redirects to `play-monaco.vercel.app` — the live
  "Monaco in 3D" WebGL demo itself (app shell, no write-up). No technique
  detail beyond what §0 already distilled. Closed; nothing to fold in.

---

## 5. References
- Source profile: `https://x.com/PlayDaaa` (Playda — procedural city pipeline, build-in-public)
- [willis-new-jerusalem-model.md](../sources/willis-new-jerusalem-model.md) — size/cubit/Ezekiel-harmonization research (partly done)
- [ADR 0014](../adr/0014-citywide-scale-rendering.md) — citywide viewable-scale decision
- [ADR 0009](../adr/0009-symbolic-vs-literal-rendering.md) — symbolic-vs-literal rendering (rule 4: geometry can't footnote itself)
- [RENDERING-DECISIONS.md](../../RENDERING-DECISIONS.md) #1 — city as terraced step-pyramid (Willis's interpretation)
- Code: [`nj/CityMassing.ts`](../../apps/world-engine/src/nj/CityMassing.ts), [`nj/RiverOfLife.ts`](../../apps/world-engine/src/nj/RiverOfLife.ts), [`nj/Allotment.ts`](../../apps/world-engine/src/nj/Allotment.ts), [`nj/NewJerusalemScene.ts`](../../apps/world-engine/src/nj/NewJerusalemScene.ts), [`sky/Atmosphere.ts`](../../apps/world-engine/src/sky/Atmosphere.ts)
