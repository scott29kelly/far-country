# Procedural asset authoring — what the single-file HTML worlds do, and what Far Country should take from them

**Status:** research note, 2026-07-28. Not a decision. Nothing here changes an
ADR or `RENDERING-DECISIONS.md`; where it proposes work, that work needs
Scott's go-ahead first.

**Question asked:** how are people generating 3D world assets as HTML, and how
does that apply to Far Country?

**Short answer:** the headline — "a whole world in one HTML file" — is the
least transferable part, and our engine's own spec already forbids it. The
transferable parts are four specific authoring disciplines, and we are missing
three of them on the city while already having all four on the terrain.

---

## 1. Provenance — what was actually examined

Primary source, read in full:

- **`Hoshi-no-Tani — The Valley of Stars`**, the CodePen behind the 2026-07-25
  post by [@Lentils80](https://x.com/Lentils80/status/2081136109778538917).
  Supplied by Scott as a zip export. **6,133 lines in one `index.html`**,
  three.js via importmap (`three@0.180.0`), no build step, 20 shader materials,
  50 inline GLSL blocks, one external URL in the entire file (the three.js CDN
  itself). No models, no textures, no audio samples.
- **The author's own method disclosures**, from replies in the same thread
  (supplied as screenshots): the build took **"1.5 hours or so on xhigh"**; the
  wind came from **"I told it to apply a wind dynamics paper to make it more
  realistic"**; and the lighting direction was one sentence — *"Painterly
  Ghibli-style, cel/toon shading with soft ramps, no hard speculars, warm
  slightly-desaturated palette, golden-hour sun, soft distance haze."*

Second-hand, **not verified** — this environment's egress policy allows only
GitHub and package registries, so x.com, codepen.io, arxiv.org and
assets.claude.ai were all refused at the gateway:

- Reports of a browser FPS ("Claude of Duty") at three.js r180 / WebGL2,
  ~55k lines, 11 subsystems, zero asset files
  ([explainx.ai](https://explainx.ai/blog/claude-of-duty-opus-5-procedural-fps-july-2026)).
- Reports of a dependency-free real-time wind tunnel page
  ([Min Choi's roundup](https://x.com/minchoi/status/2081414653146460668)).

Treat §2–§3 below as solid (read from source) and the second-hand items as
colour only.

---

## 2. The artifact, anatomized

### 2.1 It is one file, but it is not one module

This is the finding that matters most, because it defuses the apparent conflict
with our own spec. The file is organized into sixteen numbered sections,
declared in a header index:

```
§0  config & palette          §8  trees
§1  math / noise              §9  village + viaduct
§2  glsl library              §10 train + smoke
§3  terrain                   §11 life (pollen, birds, butterflies)
§4  sky + clouds              §12 shadow pass + post chain
§5  wind field                §13 camera & gait
§6  grass                     §14 audio engine
§7  river                     §15 boot + main loop
```

§2 is a hand-rolled shader include system — twelve named chunks (`GL_HASH`,
`GL_NOISE`, `GL_PAL`, `GL_SKY`, `GL_SHADOW`, `GL_LIGHT`, `GL_AIR`,
`GL_TERRAIN`, `GL_WIND`, …) composed into every material as template literals,
under the comment *"Shared chunks injected into every shader. One physics, one
palette, one sky."*

So the lesson is **not** "put it in one file." It is **one shared substrate,
consumed by every subsystem** — which is a modularity claim, not a
file-count claim. Single-file was the delivery constraint of a CodePen, and the
author worked *against* it with a manual module system.

### 2.2 One palette, named, in one place

§0b is ~90 named colours as sRGB hex under the comment *"Every colour in the
film, in one place"*, converted to linear once at load and injected into GLSL
as `vec3` literals:

```js
const P = {
  skyZenith:'#4E80B4', skyHorizon:'#E4DAC2', haze:'#A9BCC7',
  gTip:'#C6D46B', gMid:'#6C9A47', gBase:'#2B564F', gTrans:'#E9EE7C',
  cloudTop:'#FFF8EC', cloudUnder:'#B7ACC3', cloudCore:'#9791B0',
  sun:'#FFD79C', ambSky:'#9EC6E6', shadowTint:'#5C6E9E', /* … */
};
const LIN = {}; for (const k in P) LIN[k] = new THREE.Color(P[k]).convertSRGBToLinear();
```

Note what is encoded there: `shadowTint` is violet, `ambGround` is a warm
bounce, cloud undersides are mauve rather than grey. The one-sentence art
direction from the reply thread is *materialized as a data table* — the
palette is the colour script, in code, addressable by name from every shader.

### 2.3 Simulation grounded in named literature

The wind is not a sine wave, and the file says so:

> *"Real wind is not sin(t). It is a mean flow with a slowly-meandering
> direction, a Kolmogorov −5/3 cascade of eddies frozen into that flow and
> carried along with it (Taylor), coherent gust cells that outrun the mean and
> veer as they arrive, a logarithmic boundary layer, and terrain that speeds it
> up over crests, shelters the lee, and channels it down valleys."*

Concretely implemented: an Ornstein–Uhlenbeck meander on mean speed/direction,
divergence-free curl-noise turbulence with an inertial-subrange spectrum
(`amp *= 0.7937` — that is 2^(−1/3)) and per-octave turnover time τ ~ k^(−2/3),
and six advecting gust cells. The grass blades solve a quadratic Bézier for
quasi-static equilibrium of gravity, wind and Hookean recovery, cited inline as
**Jahrmann & Wimmer 2017**, with a section comment marking *"state corrections
(Jahrmann §5.2)."*

That is the "apply a paper" instruction from the reply thread, visible in the
output. It is the difference between a plausible-looking effect and one with a
defensible derivation.

### 2.4 One field, many consumers

The wind is evaluated once per frame into a single 256² texture *"that every
other system in the scene reads."* Grass, trees, smoke, pollen, birds, the
camera, **and the audio bus** all sample it — §14 notes the wind bus is driven
by the same field that bends the grass, *"so you hear a gust arrive a beat
before you see the near blades move."* Cross-system coherence falls out of the
shared substrate rather than being hand-synchronized.

### 2.5 Everything else is generated, including the audio and the failure modes

§14 is *"AUDIO — ALL SYNTHESISED. No samples. Noise buffers, oscillators,
biquads, and one convolution reverb whose impulse response is generated from
decaying noise."*

And the code defends itself. A two-ALU "NaN firewall" is injected into every
fragment shader:

```glsl
vec3 SAFE3(vec3 c){ return clamp(mix(vec3(0.0), c, equal(c, c)), vec3(0.0), vec3(64.0)); }
```

with the rationale that one non-finite fragment reads as a solid dark square
and the bloom downsample then smears it across a neighbourhood. Comments
throughout explain *why* a constant is what it is — the grass density exponent
is 1.5 rather than 1.45 partly because `x·x·inversesqrt(x)` is three
single-cycle instructions where `pow()` is ~ten, across ~12M grass vertices a
frame.

### 2.6 The boot is authored

Fourteen staged bake steps with written labels — *"carving the valley,"*
*"laying the permanent way,"* *"painting the ground,"* *"raising the far
hills,"* *"growing the meadow,"* *"stacking the cumulus,"* *"planting the
woods,"* *"sowing a million blades,"* *"mixing the paint,"* *"ready"* — each
yielding to the event loop so the progress bar actually moves. The loading
screen is part of the piece.

---

## 3. The workflow, as evidenced

Reconstructed from the author's disclosures plus what the code shows:

1. **A style directive compressed to one sentence**, covering shading model,
   speculars, palette temperature, sun angle, and atmospheric falloff. Short
   enough to restate in every subsequent instruction.
2. **A named paper for any subsystem where "looks right" is not good enough.**
   The wind got a literature grounding; the grass got a specific 2017 paper
   with a section reference.
3. **A long, high-effort single run** — ~1.5 hours at `xhigh` — rather than
   many short prompts. The section numbering, the shared GLSL chunk library and
   the palette table are the marks of a system designed once, not accreted.
4. **Self-verification in the loop.** The performance commentary (shuffled
   instance buffers so any prefix is a fair sample; depth prepass described as
   *"the single most valuable thing in this renderer"*; 16-bit normalized
   instance offsets to halve vertex-fetch bandwidth) reads as measured, not
   guessed.

---

## 4. Where Far Country actually stands

Verified against the tree at `main` (`49a9bd9`), not assumed:

| | Hoshi-no-Tani | Far Country engine |
| --- | --- | --- |
| Renderer | three.js 0.180, WebGL2, raw GLSL | three.js **0.184**, **WebGPU**, TSL + raw WGSL compute |
| Dependencies | three (CDN importmap) | three (**the only** dependency) |
| Shipped binary assets | none | **none** |
| Procedural scope | terrain, sky, grass, water, trees, buildings, audio | terrain, sky, clouds, grass, water, vegetation, city, **audio** |
| Determinism | `rng(seed)` per system | `WorldSeed` with string-keyed decorrelated streams |
| Scale | 2,400 m heightmap | 4×4 km, ≥4 km visible range |

`apps/world-engine/package.json` describes itself as *"fully procedural open
world in the browser (WebGPU)"*; 59 source files import `three/tsl` or
`three/webgpu`; the only images in the repo are three art-direction references
and a README hero, none shipped. `STATUS.md`'s hard-rules digest already
mandates *"zero external assets"* — and, pointedly, ***"no one-file
architecture."***

**So we are not behind this technique. We are past it, on a harder renderer.**
The gap is not procedural generation. It is that the *terrain* half of the
engine has the authoring disciplines from §2 and the *city* half does not.

### 4.1 The asymmetry, precisely

Vegetation is authored the way §2 describes — parameters as data, separated
from a generator, with a review surface and measurement tools:

- `src/vegetation/Species.ts` — declarative `SpeciesParams` per species
- `src/vegetation/Skeleton.ts`, `TreeBuilder.ts`, `LeafMesh.ts` — the generator
- `src/vegetation/VegLibrary.ts` — per-species LOD "diets"
- `?scene=gallery` (`src/debug/GalleryScene.ts`) — every species × 3 seeds on
  labelled pedestals under full world lighting, with `?row=` framing
- `tools/vegtris.ts`, `tools/herotris.ts` — triangle budgets and build times
- 9 named camera bookmarks; `docs/DELTA.md` reference-gap loop

The city has none of that shape. `src/nj/CityMassing.ts` is a **42 KB single
file** that *does* contain a kit — `archFrameGeometry`, `flutedPierGeometry`,
`arcadeArchGeometry`, `facetedBandGeometry`, `glassPaneGeometry`,
`instancedOnFaces` — but the kit is embedded rather than extracted, has no
parameter table, no gallery row, and no budget tool. Verified:
`GalleryScene.ts` contains **zero** references to `nj/`, and `Bookmarks.ts`
holds **nine landscape bookmarks and zero city bookmarks** — exactly what
`docs/CITY-QUALITY-BAR.md` pillar E already flags (*"Mirrors the terrain's 9
bookmarks — the city currently has none"*). `DELTA.md` tracks terrain phases
only.

`CITY-QUALITY-BAR.md` also already reached the §2.1 conclusion independently,
in its Assassin's Creed benchmark: *"the city needs a real architectural kit
(arch module, pilaster module, cornice module, gem-course module) instanced
around the tiers, not more box primitives."* This research note's contribution
is that we have a **working in-repo template** for how to do that — the
vegetation pipeline — and now an external confirmation of the same pattern.

---

## 5. What transfers — five levers, ranked

### Lever 1 — Extract the city kit into data + generator *(highest value)*

Mirror `vegetation/`. Something like `src/nj/kit/`: an `Orders.ts` declaring
architectural modules as parameters (bay width, voussoir count, reveal depth,
fluting, dentil pitch, gem cut) and a builder consuming them, with
`CityMassing.ts` reduced to *placement*. This is what turns "add more relief"
from bespoke geometry code into a tunable table — and it is the precondition
for Levers 2 and 3 being useful.

Serves `CITY-QUALITY-BAR` pillars A and C directly.

### Lever 2 — A city gallery scene and city bookmarks

`?scene=citygallery` on the model of `?scene=gallery`: every kit module × N
seeds on labelled pedestals under full world lighting, so review conditions
equal shipping conditions. Plus the missing city bookmarks (south river
approach, gate-level human scale, summit) that pillar E already asks for, and a
`tools/citytris.ts` for module triangle budgets.

Without this, every city visual judgment costs a full world boot and a manual
camera fly.

### Lever 3 — Promote `look` into a real colour script

`src/nj/config.ts` already has a `look` block — but it holds only
`timeOfDay`, `aerialFogK`, `aerialClarity`. Meanwhile `CityMassing.ts` carries
five loose module-level `Color` constants (`GOLD`, `CRYSTAL`, `PEARL`, `IVORY`,
`JASPER`), and the art direction itself lives as *prose* in
`CITY-QUALITY-BAR.md` pillar E.

Hoshi-no-Tani's §0b is the fix: one named palette table, in `config.ts`,
covering lit/mid/shade/bounce per material family plus the shadow tint, already
round-tripping through the `?edit=1` panel that `look` was built for. Pillar
E's *"warm gold at the base ascending to pale luminous crystal at the summit"*
becomes addressable data instead of five constants and a paragraph.

### Lever 4 — Ground the material physics in named literature

Our open deltas on the city are optics problems: gem facet punch at range,
shaded-face glass read, *"materials show transmission/subsurface response …
not flat Lambertian paint."* We have rigorous grounding for **what** to build
(Scripture, Willis, ADR 0017's measurement records) and essentially none for
**how light behaves** in it.

The Lentils move applies exactly: name the paper. Dispersion and Fresnel in cut
gemstones; subsurface transport in translucent minerals; daylighting in
high-window masonry interiors (the Hagia Sophia reference in
`reference-city/` is *about* light redistribution). The engine already proves
we can execute this class of work — `Wind.ts`, the Hillaire atmosphere, the
caustics pass.

This is the cleanest win: it is additive, it is orthogonal to the hermeneutic
questions, and it targets the highest-ranked open visual delta.

### Lever 5 — The single-file HTML harness, as an *authoring sandbox only*

We already do this for audio: `tools/ambience-harness.html` runs the real
`Ambience` graph against an injected `OfflineAudioContext` — explicitly
*"Dev-server only; never part of the built bundle."* `bootrite-harness.html` is
a second instance.

There is no visual equivalent. A `tools/kit-harness.html` — zero build step,
instant reload, one module under one light rig — would give a tight loop for
iterating a single kit module, of the kind the CodePen format enforces for
free. The output is then ported into `src/nj/kit/`, never shipped as HTML.

---

## 6. What does *not* transfer

**The single file itself.** `STATUS.md`'s hard rules say *"no one-file
architecture."* Per §2.1 the author was fighting that constraint anyway. Nothing
under `src/` should move toward it; harnesses under `tools/` are the exception
that already exists.

**The GLSL.** Their `GL_*` template-literal include system solves a problem TSL
already solves for us with type checking. Copying the pattern would be a
regression — but the *content* of `GL_PAL` (one palette, injected everywhere)
is Lever 3, and that does transfer.

**WebGL-era performance tactics.** The depth prepass, 16-bit instance offsets
and shuffled instance buffers are worth reading, but our engine already has its
own solutions (`VegPrepass.ts`, `ImpostorRuntime.ts`, GPU-side instancing under
a "no CPU per-instance updates" rule). Ideas to compare against, not to import.

**The painterly look, as a default.** Their cel/toon ramps and film-print grade
are a deliberate Ghibli pastiche. Whether Far Country should move toward a
stylized register is a **live art-direction question with hermeneutic
weight** — a painterly treatment arguably reads more honestly for
`symbolic`-tier content than a photoreal one does, and ADR 0009 rule 2 governs
how far to stylize. **That is Scott's call and it is not made here.** Noting it
only because the technique and the style arrive bundled and should be
unbundled.

### 6.1 The constraint that has no analogue in their world

A procedural kit generates unlimited detail. In this project **detail is a
truth claim.** A generated pilaster, a gem cut, a dwelling window — none of
these are neutral; each either traces to a source or is interpretive art, and
`CLAUDE.md`'s first pitfall is *"don't invent descriptors."*

The repo already has the right precedent: RENDERING-DECISIONS #10's
processional ascent is interpretive architecture and is therefore **uncited and
unpickable** — it exists in geometry but asserts nothing, and the reading key
and `entityPicks.ts` do not present it as citation. Likewise `rev-city-wall` is
deliberately *not* consumed by geometry (entry #12).

**Any kit extraction must carry that classification in the data.** A module
record should declare whether it is cited (and by what) or declared art, and
the pick/reading-key layer must keep honouring the distinction. Scaling up
detail generation without scaling up that discipline is the specific way this
technique could damage the project — it is the one risk in this note that is
not merely engineering.

---

## 7. Suggested pilot, if this is taken up

Smallest slice that proves the pattern, in dependency order:

1. **Lever 3** (palette into `config.ts`) — self-contained, no geometry churn,
   immediately improves every subsequent visual judgment.
2. **Lever 2** (city gallery + bookmarks) — the review surface; makes 1 and 4
   verifiable.
3. **Lever 4** (one material, literature-grounded: the foundation gems, the
   top-ranked open delta) — proves the "name the paper" move on our stack.
4. **Lever 1** (kit extraction) — largest, and worth doing only once 2 exists
   to review it against.

Verification stays what it already is: CPU probes plus `tsc --noEmit` and
`vite build` in the cloud, `tools/shoot.ts` on Scott's M1 Max for visual
judgment. **Note the real constraint:** there is no GPU in this container, so
the tight visual loop that made the 1.5-hour run possible cannot run here. Any
agent-side iteration is bounded by the probes; the visual verdict needs
hardware.

---

## 8. Open questions for Scott — ANSWERED 2026-07-29

1. **Is the stylized/painterly register on the table at all**, or is the target
   staying where `PROJECT_LAAS_v2.md` put it (UE5-class reference frames)? This
   is upstream of most art-direction work and touches ADR 0009 rule 2.

   **ANSWERED: the target stays photoreal.** ADR 0009 rule 2 is untouched and
   no superseding ADR is needed. The consequence for this note is that the
   city's remaining gap is re-diagnosed as an **optics** problem (flat
   Lambertian gold, no gem transmission read, dead-flat pavements) rather than
   a rendering-register problem — which promotes **Lever 4** from "cleanest
   win" to the substantive art-direction work, with Lever 3 as its precondition.

2. **Kit extraction now, or after the current Phase C remainder** (stage-granular
   `CityMassing` toggling, the timed arrival sequence)? They touch the same
   file and would conflict.

   **ANSWERED by delegation:** Scott's direction is to optimise purely for the
   quality of the finished world, and to sequence accordingly. Recorded order,
   with §7's pilot amended — **Lever 2 first, not Lever 3**:

   1. **Lever 2 (review surface).** Promoted to first because the constraint it
      removes is now the binding one. Every city framing in
      `CITY-QUALITY-BAR.md` had gone stale (the 2026-07-01 poses no longer
      frame the city at all — the massing outgrew them), and each still costs a
      ~50 s world boot, so a six-shot look at the city costs six minutes and is
      not repeatable across builds. A composed framing table plus a one-boot
      contact sheet makes that one boot for the whole set, and makes framings
      an owned artifact that cannot silently go stale again. Levers 3 and 4 are
      both judged visually, so this multiplies everything after it.
   2. **Lever 3** (palette into `config.ts`) — precondition for coherent
      material work, and now reviewable.
   3. **Lever 4** (material optics, literature-grounded) — the substantive win
      under a photoreal target.
   4. **Lever 1** (kit extraction) — last, and the point at which it collides
      with the Phase C remainder. Sequence that collision when we get there.

3. **Does an ADR belong here?** Lever 1 changes how city geometry is authored,
   which is arguably the same class of decision as ADR 0017 (Scripture as data).
   My read is that Levers 2–5 are plainly under existing decisions and Lever 1
   is the only candidate.

   **ANSWERED: yes, one ADR, written with Lever 1 rather than ahead of it.**
   Sharpening the rationale: the ADR-worthy decision is not "extract a kit" —
   refactors do not need ADRs. It is that a kit is a **detail-generating
   machine**, and per §6.1 detail in this project is a truth claim. What the
   ADR must fix is the rule that keeps generated detail from asserting
   anything. That is the same class of decision as ADR 0017.

4. **Confirm the classification rule in §6.1** is what you want before any kit
   data model is designed — it is cheap to build in and expensive to retrofit.

   **ANSWERED: confirmed, with one amendment — the classification is not
   binary.** The gates are the counterexample. A gate is *cited* in its
   existence (Rev 21:12 twelve gates and their tribes, Rev 21:21 each a single
   pearl) and *interpretive* in its articulation (voussoir count, fluting
   pitch, reveal depth, jamb profile — the text fixes none of these). A
   two-state `cited | declared-art` flag forces a choice between over-claiming
   the ornament and dropping the citation from a cited structure, and both are
   wrong. A kit module record must therefore carry its citation for **what the
   text fixes** and mark the remainder as articulation, with `entityPicks.ts`
   and the reading key keyed off the cited part only. The
   RENDERING-DECISIONS #10 precedent (the processional ascent: uncited,
   unpickable) remains correct for modules that are interpretive *all the way
   down* — it is the degenerate case of this rule, not a different rule.

5. *(asked 2026-08-03, with the ADR 0019 crowd rebuild)* **The multitude's
   near-ring photoreal tier: in-engine procedural only, or vendored
   offline-generated assets?** Faces/skin/hair at true photoreal quality are
   not honestly reachable as runtime-procedural geometry; the crowd LOD
   infrastructure and the seeded figure generator were built fork-independent
   (STATUS.md 2026-08-03) so either answer could land on them.

   **ANSWERED 2026-08-04: vendored offline-generated assets.** The same
   posture already adopted for the audio layer (generate offline, vendor the
   output into the repo; nothing generated at runtime, nothing fetched at
   runtime). Consequences: the seeded generator's archetypes remain the
   mid/far LODs and the identity/diversity source of truth; the near ring
   swaps in vendored anonymous photoreal figure assets keyed to the same
   archetype + parameter axes. The implementation session must open with an
   ADR fixing the pipeline's guards — ADR 0019 rule 2 (synthetic, anonymous,
   no real-person likeness) becomes a property of the *generation recipe*,
   and the vendored assets carry provenance notes the way the audio posture
   requires. That ADR is the ADR 0017/0019 class: what keeps generated
   detail from asserting anything the text does not.
