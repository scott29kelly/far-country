# CITY QUALITY BAR — the New Jerusalem's own reference-delta spec

`PROJECT_LAAS_v2.md`'s six pillars, floors, and reference-delta discipline were
calibrated entirely against a forest/alpine demo. The city (`src/nj/`) has
never had the same treatment, and a visual audit this session (2026-07-01,
`?scene=newjerusalem`, screenshots via `__laas.setPose`) confirms it: **the
city is currently the single biggest quality gap in the whole engine**, worse
even than the terrain's Phase-1 "flat lighting" state, because the *geometry
itself* — not just lighting/atmosphere — is primitive. This document is that
missing spec: reference images, city-specific floors, and a ranked delta list.
It supplements `PROJECT_LAAS_v2.md`; it does not replace it — the terrain
pillars and floors are unchanged and still govern everything the city sits on.

See `apps/world-engine/STATUS.md` "New Jerusalem scene" section for the
build-state inventory this document's delta list is drawn from.

---

## The bar

The visual target is **"a luminous gemstone megastructure rising as a holy
mountain"** — not a forest, not a generic sci-fi tower, not a beige office
ziggurat. Two reference families, seeded in `apps/world-engine/reference-city/`
(attribution in that folder's `ATTRIBUTION.md`; expand this set over time,
same as the terrain's four-image set):

1. **Material/light references** — `hagia-sophia-interior-gold.jpg` (a
   gold-ground surface that *catches and redistributes* light rather than
   sitting flat-lit; deep window reveals; dark accents that make the gold
   read brighter by contrast) and `gemstones-raw.jpg` (translucency, internal
   color variance, faceted light break-up — what "jasper," "gold like clear
   glass," and the twelve named gems are gesturing at; ADR 0009 rule 2 governs
   how far to stylise this, not whether to attempt it at all).
2. **Form/silhouette references** — `borobudur-stupa-terraces.jpg` (a stepped
   terrace monument that reads as a *mountain* at a distance and as *finely
   coursed relief* up close — exactly the two-scale legibility our step-pyramid
   needs and currently has neither of).

A result that looks like a **beige municipal building with tinted office
windows** — flat box masses, matte opaque "gold" paint, no relief deeper than
a cornice lip — is a **failed task**, no matter how correct the tier
proportions or citation math are. That is, verified by screenshot, what
`/world-preview` currently looks like.

---

## City-specific translation of the six pillars

**A. Geometry, not textures.** Every gate is a real recessed portal with
voussoirs and jambs a person could stand inside, not a flat emissive rectangle
with a painted arch. Every foundation gem is a distinct faceted volume with
its own cut geometry (or at minimum true parallax-occlusion facets), not a
flat colour swatch. Coursing, cornice dentils, and pilaster fluting are
modeled relief, not normal-map illusion. *Rule: within 20 m of camera, no
single flat, unbroken face may occupy more than a small fraction of screen —
every wall plane needs at least ~0.3 m of real coursing/reveal depth.*

**B. Light transport.** The city is the brightest object in the world (Rev
21:23) — not merely emissive-flat, but bouncing: the gold plaza throws warm
bounce light up onto overhanging cornices, crystal terraces scatter/transmit
light into their own shadowed recesses, arch reveals show ambient occlusion
gradients rather than solid unlit black. *Rule: no arch reveal, gate recess,
or cornice underside may read as flat dead-black — sample it; it should carry
warm bounce or cool sky fill, same no-black-shadows law as Pillar B in the
main spec.*

**C. Nothing is bare.** Every tier carries coursing detail, not a single
extruded box. The dwelling grid gets roofs, doors, window openings, and
per-building variation (not identical grey slabs). The temple gets its own
distinct architectural identity — courts, a distinguishable sanctuary massing
— rather than being a smaller unlabelled copy-paste of the city. Fields show
furrow/crop relief, not a flat green plane with box hedges.

**D. Distance holds.** The stepped silhouette must read as a mountain from
kilometers away — crisp terrace edges at range, not a soft beige blob (the
current failure mode: from altitude the city all but disappears into the
haze). The summit glory is a wayfinding beacon visible from anywhere in the
visible landscape (Rev 21:23 — nations walk by its light, Rev 21:24).

**E. Art direction.** A deliberate colour script — warm gold at the base
ascending to pale luminous crystal at the summit (the existing `GOLD`→`CRYSTAL`
lerp in `CityMassing.ts` has the right instinct; flat unlit-reading materials
undermine it). Composed establishing views: the south approach along the
river (the "water at the approach" Willis directive already noted in
`RiverOfLife.ts`'s header comment), a gate-level human-scale view, a summit
view. Mirrors the terrain's 9 bookmarks — the city currently has none.

**F. The world moves.** The river is a static flat plane today — it needs the
engine's own water shader (flow, foam, caustics — already built and proven
for the terrain's streams) rather than a motionless emissive slab. Trees of
life sway with the same wind field the surrounding forest already uses. The
summit glory may pulse or cast slow volumetric god-ray shafts using the
engine's existing froxel system, rather than sitting as an inert bright
sphere.

---

## City-specific floors

| Dimension | Floor |
|---|---|
| Wall/gate relief | Gates are modeled 3D portals (jamb + voussoir + recess depth ≥ 1.5 m at city scale) a camera can pass through; no flat "arch decal" gates |
| Foundation gems | Twelve distinct faceted volumes (real cut geometry or true POM facets), each a stylised hue per `FOUNDATION_GEMS`, not a flat colour swatch |
| Facade relief depth | ≥ 0.3 m real coursing/pilaster/reveal depth on every tier face within near range; no flat single-plane facade in a hero shot |
| Material behavior | City materials show transmission/subsurface response (crystal terraces) and specular gold response that varies with view angle — not flat Lambertian "paint" |
| Silhouette legibility | Terrace steps readable (as distinct bands, not a smoothed cone) from ≥ 3 km given the current ~2.5 mi (`NJ_SCALE=20`) scale |
| Population | At least a legible presence of the great multitude + angelic hosts near the throne and gates (RENDERING-DECISIONS #3) — an empty city fails Pillar C at the scene level |
| Wayfinding | Each of the twelve gates individually identifiable (tribe + compass label, matching legacy `/world`); the summit visible as an orientation beacon from anywhere on the plain |
| Motion | River flows (shader reuse, not a static plane); trees of life sway; no fully static hero element |
| Plateau seam | No terrain feature (peak, ridge, tree line) visually intersects or "grows out of" the plateau's cut edge in a hero framing — see delta #4 below |
| Distinctness | Temple and dwellings read as architecturally distinct from the city (not a smaller copy-paste of the same tier/arch module) |

---

## Benchmark: city-scale open-world design (not lighting)

Pulled for **density, scale-legibility, and single-landmark movement design**
specifically — these engines' offline-baked lighting is not a fair target for
a browser and is explicitly out of scope.

- **GTA V (Los Santos):** ~81 km² of land, laid out like a real city —
  sensible road hierarchy, and landmarks (the Vinewood sign, the Maze Bank
  Tower, Mount Chiliad) that stay legible as navigation anchors from many
  angles and distances. This is the model closer to our situation: **one
  dominant, unmistakable landmark** the player orients around, not competing
  skyscrapers.
- **Cyberpunk 2077 (Night City):** ~110 km², extremely vertical and dense, but
  explicitly **flagged by critics for weak landmark legibility** — too many
  similar-scaled towers, filler buildings blocking sightlines to anything that
  could serve as a wayfinding anchor, deliberately disorienting ("make the
  player feel small"). This is a **cautionary** reference for us, not
  aspirational: our world has exactly one megastructure, so we get GTA's
  single-landmark clarity for free *if the geometry earns it* — Night City's
  failure mode (a skyline of interchangeable boxes) is precisely what our
  current flat 5-tier box massing risks becoming instead of a mountain.
- **Assassin's Creed (Notre-Dame/pyramid-scale set-pieces):** the relevant
  lesson is kit-bashed modular density — a hero landmark built from many
  *varied, repeated* architectural modules (bays, buttresses, courses) so it
  reads as finely detailed up close and as a coherent silhouette at range,
  rather than one or two giant flat-shaded primitives. This is the direct
  fix for our "beige box" problem: the city needs a real architectural kit
  (arch module, pilaster module, cornice module, gem-course module) instanced
  around the tiers, not more box primitives.

> **Related research (2026-07-28):** the "architectural kit" recommendation
> below is developed further in
> [`docs/plans/procedural-asset-authoring.md`](../../../docs/plans/procedural-asset-authoring.md),
> which compares the city's authoring setup against the engine's own
> `src/vegetation/` pipeline (parameters-as-data + generator + gallery scene +
> budget tools) and against an external single-file procedural world. Research
> only — no decision taken.

**Net takeaway:** we are not trying to solve Cyberpunk's wayfinding problem —
we structurally don't have it (one landmark, not a skyline). We need GTA's
"legible from anywhere" quality and AC's "kit-bashed relief at every distance"
quality applied to a single mountain-city, which is a *geometry and detail*
problem, not a *navigation design* problem. Task 3's navigation work (mini-map,
click-to-teleport, gate labels) is what makes that landmark actually easy to
approach once it exists.

---

## Framings are now owned code, not coordinates in this file

**(2026-07-29)** The four framings listed with the 2026-07-01 delta list below
were absolute world coordinates, and by 2026-07-29 **not one of them still
framed the city** — the massing outgrew them (at `p:[0,1000,5200]` the city now
overflows the frame and is cropped at the top) and nothing flagged it. The
ranked list was being re-read against poses that no longer showed what they
claimed to show. Those coordinates are kept below only as the historical record
of that session.

The replacement lives in code: **`src/nj/reviewFramings.ts`**, nine composed
framings authored in LOCAL city units and resolved through the same owner
tables the geometry, collision and picks consume, so a rescale or a retuned
tier carries them along. Yaw and pitch derive from an aim point rather than
being typed. `tools/probe-framings.ts` pins them; `tools/cityshots.ts` shoots
the whole set from **one boot** (nine stills in ~2.5 min instead of ~8, and
sharing one world, one auto-exposure history and one cloud state, so a sheet is
comparable build to build).

| id | judges |
|---|---|
| `distant-silhouette` | Pillar D at ~10 km |
| `south-approach` | Pillar E, the composed hero |
| `three-quarter-aerial` | Pillars D/E, the massing read |
| `gate-approach` | Pillar A, gate portal as a real volume |
| `foundation-course` | the twelve-gem floor, close |
| `plaza-gallery` | Pillars A/B/C inside the wall |
| `terrace-pavement` | Pillar A on the HORIZONTAL |
| `arcade-bay` | Pillar A, relief depth on one repeated module |
| `crown-sea-of-glass` | Pillars B/F at the summit |

Use `npx tsx tools/cityshots.ts`; add `--framealign 0` (with `--only`) when a
sheet is going to be pixel-diffed rather than looked at.

---

## Re-judged on real hardware — 2026-07-29

The first GPU pass over the city since the 2026-07-02 material work. (Every
verdict below 2026-07-18 had been taken on a machine that could render; the
2026-07-24 to 07-28 cloud sessions had **no GPU at all**, so the visual state
had gone eleven days unlooked-at while docs work continued on top of it.)
Captured through the framing set above on an Intel Xe-LPG part: ~25–35 fps at
1280×800, 19.6 M triangles, 1368 draw calls. Note for any later perf verdict:
GPU render+compute is ~16 ms while `cpu.submitMs100` is 2430 (24 ms/frame), so
these frames are **draw-call-submission bound, not GPU bound**.

**The headline: the city is no longer a beige box, and it is now a wedding
cake.** The 2026-07-02 pass genuinely landed — there is real instanced relief,
voussoir arch frames, fluted piers, dentil courses, recessed gate portals with
jambs and tribe inscriptions, and the gold trim has a convincing specular
response at close range. What the sheet shows is that the failure moved rather
than closed.

1. **The cornice pavements are blank, and they are the largest surfaces in the
   composition.** In `three-quarter-aerial` four enormous flat white terrace
   tops occupy more screen than all the ornament combined; in
   `terrace-pavement` the pavement is ~65% of the frame and carries nothing at
   all. Pillar A is written for *wall* planes ("every wall plane needs at least
   ~0.3 m of real coursing/reveal depth") and the horizontal surfaces slipped
   through the clause. **They are now the single biggest gap.**
2. **One module, tiled, with no variation axis.** Every bay on every face of
   every tier is the same arch at the same spacing. This is the Assassin's
   Creed benchmark inverted — kit-bashed density requires *varied* repeated
   modules — and it is the strongest independent argument for the kit
   extraction in `docs/plans/procedural-asset-authoring.md` lever 1: not a
   code-organisation preference, the visible failure.
3. **The plaza gallery is an empty corridor of two flat planes.** Gold plinth
   wall one side, blue-grey jasper wall the other, blank floor taking half the
   frame, no coursing or relief on any of them. The logged debt ("interior
   plaza/wall dressing is thin at walking range") understates it, and this is a
   place the walker is *guaranteed* to reach on foot via the processional
   ascent.
4. **The foundation gems read as opaque low-poly slabs.** At close range
   (`foundation-course`) a band is a flat teal mass with a handful of large
   triangular facets — no transmission read, no dispersion, no internal
   structure, despite the material carrying `transmission 0.6`, `ior 2.0` and
   `dispersion 0.25`. Closer inspection makes it *worse*, not better, which
   inverts the intended two-scale legibility.
5. **The tier glass bays read as flat printed panels.** In `arcade-bay` the
   mullion grid behind the gold arch has no depth, no transmission read and no
   glow — wallpaper inside a good frame. (Pillar B does hold here: the arcade
   shadows are soft warm grey, not black.)
6. **The river reads as grey haze, not water.** A pale vertical band runs the
   full height of the south face and continues across the plain. A
   `?stages=-river` ablation confirms the owner: it is the river of life, and
   at close range it carries no flow, refraction, specular or foam — it reads
   as fog laid over the facade. Delta #7 was recorded closed "to first pass" in
   2026-07-02; at walking range it is not.
7. **The silhouette holds its steps but loses its presence.** At ~10 km the
   terrace bands stay legible (Pillar D's geometric half passes) but the city
   goes pale tan against pale sky and reads smaller than it is.

**Not chased, flagged only:** thin vertical bright streaks scattered across the
sky in `crown-sea-of-glass`, most likely the particle system rather than the
light-pillar hosts, which do not appear in that framing at all.

**Ranking for the next execution pass**, by visual impact ÷ effort: **1 and 2
together** (they are one kit-and-variation problem, exactly as #1/#3 were one
material-and-mesh problem in 2026-07-02), then **4 and 5 together** (one optics
pass over the transmissive families, now that `NJ_CONFIG.palette` gives them
one home), then **3**, then **6**.

### Executed 2026-07-29/30 — items 1-6 closed to first-pass quality

Branch `claude/city-review-framings`. Full description in `STATUS.md`'s
2026-07-29/30 entry; what closed, against the list above:

- **1 (blank pavements)** — merged concentric course bands on an authored
  border-and-field profile, plus a world-space paving lattice for the near
  ground. The lattice is a MATERIAL, and deliberately: Pillar A's ~0.3 m reveal
  spec is written for surfaces you look ACROSS, and a floor is looked ALONG,
  where the read comes from centimetre-wide slab joints. Modelling those in
  relief across a 490 m annulus is hundreds of thousands of boxes for a feature
  under a pixel at every angle a walker can take. On the WALL, by contrast, the
  rule is taken literally and the coursing is real geometry — see item 3.
- **2 (one module tiled)** — an authored ABCBA bay cadence plus heavier corner
  piers. Rhythm, not randomisation: per-instance colour jitter already existed
  and does nothing for this, because the eye reads cadence.
- **3 (empty plaza gallery)** — the wall's inward face coursed, an ENGAGED
  colonnade on the plinth face, and the street-of-gold apron paved. Engaged
  rather than free-standing because collision claims the band as open, so a
  colonnade in the walk space would be furniture the walker walks through.
- **4/5/6 (gems, glass, river)** — one bug in three places, plus the wall as a
  fourth: each carried real transmission or simulation under a CONSTANT
  emissive or opacity floor that erased the material's whole signature. All
  four grazing-weighted now. Gems additionally take per-species published
  refractive index and dispersion, so the twelve differ as the minerals do.
- **7 (silhouette value contrast at range)** — NOT addressed. Still open.

**Still open after this pass:** item 7; a real parapet or plinth course at the
terrace lip (needs a `cityCollide` change — a kerb a walker clips through is a
lie, so it was deliberately not built); the temple's architectural identity
(old delta #8); wayfinding (old delta #10).

**Needs Scott's call:** the gem optics are keyed to CONTESTED mineral-species
identifications (`Gem.species` records which reading each stone uses; jacinth,
chrysolite, agate and beryl each carry more than one credible reconstruction).
Flagged rather than settled — nothing entered the dataset and no descriptor
tier moved, but it is a step closer to a claim than a colour swatch is.

---

## Ranked delta list (worst-first, visual impact) — 2026-07-01

Framings (HISTORICAL — superseded by `src/nj/reviewFramings.ts`; see above):
south establishing view (`p:[0,1000,5200], yaw:0, pitch:-0.12`),
close facade (`p:[0,900,6500], pitch:-0.25`), summit top-down
(`p:[0,6000,-2000], pitch:-0.85`), north allotment overview
(`p:[0,3200,-20000], pitch:-0.15`). All screenshots this session via
`__laas.setPose`/`preview_screenshot`.

1. **Flat box/panel geometry with zero real relief** — the city reads as a
   beige municipal building with tinted-glass windows, not a mountain of
   jasper and gold. This is the single biggest gap and the root cause of most
   items below. `CityMassing.ts`'s tiers are literally `BoxGeometry`.
2. **No jasper wall, no distinct pearl gates, no jewelled foundation
   course** — the most citation-dense, most textually specific part of Rev
   21:18–20 is entirely absent. `cityModel.ts`'s `GATES`/`FOUNDATION_GEMS`
   tables exist but are unimported dead code (see `STATUS.md`).
3. **Materials are opaque matte "paint," not translucent crystal/gem** — no
   transmission, no subsurface response, no faceted light break-up. RENDERING-
   DECISIONS #1 calls for "translucent crystalline terraces"; none of the
   current `MeshStandardNodeMaterial` instances set transmission.
4. **Plateau/wild-terrain seam.** From several angles (e.g. north toward the
   temple) the surrounding alpine massif visually collides with the lifted
   plateau's cut edge — reads as a geometry bug, not "distant foothills."
   Confirmed in this session's north-overview screenshot.
5. **Trees of life are two spheres on a box trunk** — jarringly cruder than
   the ~100k-tri, per-instance-unique hero trees the surrounding forest
   renders meters away. The single starkest side-by-side quality contrast in
   the whole scene.
6. **Dwelling grid is 84 identical flat grey boxes** — no roofs, doors,
   windows, or per-building variation; violates the per-instance-variation
   law the terrain's vegetation already honours everywhere else.
7. **River is a static flat emissive plane** — no flow, foam, or caustics,
   despite the engine already having a proven water shader for terrain
   streams one function call away.
8. **Temple is a smaller copy-paste of the city's own tier/arch module** — no
   distinct architectural identity of its own (Ezek 40–42's temple is the
   *most* exhaustively measured structure in the whole dataset per
   `docs/plans/world-tooling-and-scriptural-grounding.md` §3, and currently
   the least distinct).
9. **No population** — the city is empty. RENDERING-DECISIONS #3 already
   settled *how* to render the multitude and angelic hosts; it just hasn't
   been ported to this engine.
10. **No wayfinding/scale legibility** — no gate labels, no HUD, no mini-map,
    no landmark hierarchy. A first-time visitor cannot tell a dwelling from a
    gate from the temple without reading source code. Silhouette also fails
    to hold at distance (city nearly vanishes into haze beyond ~3 km, before
    even reaching the "distance holds" bar the terrain already clears).

**Progress, 2026-07-01 (evening) — the LANDSCAPE side of the bar is
restored (ADR 0015).** Delta #4's plateau seam and the wider "the world
around the city is a flat box" failure are gone: the Holy Allotment is now
real terrain (scene-selected 12.3 km domain, plateau composited into
heightfield + far shell, scatter exclusions shrunk to built footprints).
The plain has the engine's own grass, meadows, groves, stones and ponds;
the wild scene is regression-verified untouched. With real trees now
standing next to the city, **#1/#3 (flat box massing + no gem/crystal
materials) and #5 (sphere-blob trees of life) are the dominant remaining
gap** — the M3 material-quality milestone is the next big lever. #6
(dwelling variation) and the zone-map manicured planting (fields, orchard
rows, hedgerows — replacing the removed box fields properly) follow.

**Top three for the next execution pass** (ranked by visual impact ÷ effort):
**#1/#3 together** (real relief geometry + true crystal/gem materials on the
existing tier structure — the two are one material-and-mesh pass, not two
separate efforts), **#2** (build the wall, gates, and foundation course from
the already-written `cityModel.ts` tables — much of this is "wire up dead
code," not new design), and **#4** (the plateau/terrain seam — likely a
scatter-exclude or plateau-skirt-radius fix, cheap relative to its visual
damage).

**Progress, 2026-07-01:** **#2 and #4 landed** (see `STATUS.md`'s "New
Jerusalem scene" section for the full description) — the base tier is now a
real wall-with-gaps consuming `cityModel.ts`'s `GATES`/`FOUNDATION_BANDS`/
`FOUNDATION_GEMS` tables (closing the dead-code desync noted there), and the
Holy Allotment's plateau lift was raised 12 m → 600 m to pull it clear of the
surrounding far-shell terrain. **#1/#3 (relief geometry + true gem/crystal
transmission materials) remain the top open item** — still flat
`BoxGeometry` + opaque `MeshStandardNodeMaterial`, no transmission, no
per-instance surface variation. Both landed changes have now been **live-verified** via
`apps/world-engine/tools/shoot.ts` (see `STATUS.md` — this is the resolved
verification path, use it going forward). Plateau lift: confirmed fixed. Wall
gates: the gaps are geometrically real (confirmed via a flanking-gate shot).

**#11 — gate black void: RESOLVED (2026-07-01, later session).** The
head-on "solid black gate" was root-caused to two stacked issues, neither
the one hypothesised (the plinth-emissive theory was wrong):

1. **An engine-wide post bug**: the golden-hour grade's saturation
   (≈ 1.14) extrapolates away from gray, driving deeply saturated dark
   channels negative, and the contrast `pow()` turns negatives into NaN →
   AgX paints the pixel pure black. The city was the only visible victim
   because its shadowed golds/gems are uniquely dark AND high-chroma (no
   probe-GI lift on city materials + 0.15× hemisphere floor). Fixed with a
   clamp before the pow in `PostStack.ts`; `?scene=world` bookmark
   regression shot unchanged. Full bisect trail in `STATUS.md`.
2. **Tier-0 piers stood exactly on the gate offsets** (u = 0, ±50 collide
   with the three gates per side) — a 340 m gold pier blocked each portal
   head-on. `CityMassing.ts` now skips base-tier piers at gate slots.

Verified after both fixes: head-on south (Simeon) framing shows an open
recessed portal with lit jamb reveals and the pearl arch head; recess
samples warm (rgb ≈ 105,85,35 — Pillar B holds); the center (offset-0)
east gate (Benjamin) was re-judged with a dedicated framing and renders an
open portal over its correct onyx foundation band. The south-centre
(Issachar) gate remains visually covered by the river approach — re-judge
it whenever the river/gate composition changes (delta #7 work).

**Progress, 2026-07-02 — the M3 material/geometry pass landed (#1/#3/#5/#7
closed to first-pass quality; #2 upgraded).** Tier faces are translucent
gold glass (real WebGPU transmission over a glowing interior core, emissive
mullion grids of small arched panes); all relief is instanced real geometry
(voussoir arch frames, fluted piers, dentil courses, ivory cornices,
gold-on-ivory arcade courses at every setback — the USER-REFS directive #1
composition); the wall is crystal-jasper with faceted transmission+dispersion
foundation gems and iridescent pearl gates; the trees of life are real
pipeline-built hero trees with wind/GI/fruit (delta #5 closed); the river is
real crystal water with SSR/refraction/foam, ribbon cascades, caustic gold
beds and a walk-guard (delta #7 closed to first pass); the summit carries
RENDERING-DECISIONS #4's rainbow halo + sea of glass. Full inventory and
verification log: `STATUS.md` "New Jerusalem scene" 2026-07-02 entry.
Remaining top deltas: #6 (dwelling variation), #8 (temple identity —
USER-REFS says red-sandstone Ezekiel compound), #9 (population), #10
(wayfinding), plus the logged polish debts (gem facet punch at range,
shaded-face glass read, fall ribbons at close range).

**Progress, 2026-07-02 (late) — delta #6 closed to first-pass quality.**
The dwelling grid is no longer "84 identical flat grey boxes": the campus is
a world-space, human-scale two-band build (`src/nj/Dwellings.ts`, RENDERING-
DECISIONS #8) — priests'-band garden-court blocks with attached row-house
perimeters (stepped facades/rooflines, hip corner houses, recessed timber
doors and warm window panes in open trim frames, gate posts, court wells;
per-cell deterministic variation, pillar C) and a Levites' band of podium-
ring blocks with hedged meadow courts beyond the detailed ring. The temple
now stands as the dominant structure of its precinct (the delta-#8/#6 scale
inversion is fixed). Remaining polish tracked in `STATUS.md`: campus zone
tint, court orchards, dwelling-scale door/window detail at sub-5 m range.

**Progress, 2026-07-18 — delta #9 (population) closed to first-pass
quality.** The city is no longer empty: the population floor ("a legible
presence of the great multitude + angelic hosts near the throne and
gates") is met by ~12,700 instanced white-robed figures in forty worship
assemblies on the plaza ring and terrace pavements plus twelve clusters
of light-pillar hosts ringing the summit (RENDERING-DECISIONS #3, ADR
0011; `src/nj/populationModel.ts` + `Population.ts`). Live-verified:
plaza crowd against the south wall, terrace congregation, host ring
flanking the glory (shots/wip/population-*.png); bloom contract intact.
Remaining population polish: figure idle motion, crowd contrast on the
pale pavements in flat light, M4.4's moving nations/pilgrims.

**Progress, 2026-07-02 (late) — the allotment zone map landed.** Pillar
C's "fields show furrow/crop relief, not a flat green plane with box
hedges" clause is first-pass real: the plateau top is an ordered
patchwork (per-plot crop tints + row striping through blades AND splat,
worn lanes, hedgerow bands, gridded orchard rows of real pipeline
trees, mown processional lawn) driven by `src/world/ZoneField.ts` /
`src/nj/allotmentZones.ts` through the engine's own scatter/grass/splat
systems. Full inventory and verification log: `STATUS.md` "New
Jerusalem scene" 2026-07-02 late-2 entry.
