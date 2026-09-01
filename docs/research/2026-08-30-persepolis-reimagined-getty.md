# Research: Persepolis Reimagined (Getty)

Date: 2026-08-30. Author: Claude (Fable 5) session, commissioned by Scott.

Subject: https://persepolis.getty.edu/ — Getty's browser-based 3D reconstruction
of the ancient Persian ceremonial capital, launched April 2022 alongside the
Getty Villa exhibition *Persia: Ancient Iran and the Classical World*.

Method: the running site was loaded and driven in-browser on 2026-08-30
(intro, chapter 1 Gate of All Nations, chapter 2 Apadana, chapter 6 Hall of
100 Columns, the finale card, the map menu, the Art Index, the About panel,
and the accessibility modal). The JS bundles were fetched and fingerprinted.
Network traffic was logged while progressing. Written claims were then
verified against primary sources: Getty's own press pages and the
production studio's maker-written case study.

Primary sources:

- The running site: https://persepolis.getty.edu/ ("observed in-browser on
  2026-08-30" below always means this site, this session).
- Getty press release (2022-04-25): https://www.getty.edu/news/take-a-journey-to-ancient-persia-with-persepolis-reimagined/
- Getty follow-up video page (2024-08-29): https://www.getty.edu/news/persepolis-getty-youtube-video-ancient-persia-virtual-history/
- Media.Monks maker-written technical case study (Awwwards Site of the Month,
  June 2022): https://www.awwwards.com/case-study-getty-persepolis-reimagined.html
- Studio portfolio page (fetch returned 403; not used for claims):
  https://www.monks.com/case-studies/persepolis-reimagined
- FWA case page (award record): https://thefwa.com/cases/getty-villa-persepolis-reimagined
- Persepolis3D scholarly model lineage: http://www.persepolis3d.com/news.html

A testing caveat, stated up front: the embedded review browser never fires
`requestAnimationFrame` (compositor throttling in the hidden pane). The site's
entire boot — preloader percent, GSAP transitions, render loop — is
rAF-driven, so it froze at "0". I unfroze it by driving `gsap.ticker.tick()`
from a `setInterval` in the page. Every screenshot and network observation
below is real, but load *timing* was distorted by this. Frame-rate could not
be measured. Sizes and request sequences are unaffected.

---

## 1. What the experience is

Structure, observed in-browser on 2026-08-30 and confirmed by the Getty press
release:

1. **Load gate.** A percent counter (0–100) over a dark screen while the
   WebGL bundle and first assets stream. Observed in-browser: the counter,
   then a decorative ring, then a 2.5D landscape.
2. **Scroll-driven prologue.** Title cards over a foggy dusk landscape that
   clears to a sunlit distant view of the citadel: "Twenty-five hundred years
   ago…", "Built by powerful kings…", "Today, we know it as Persepolis,"
   "Getty presents," then the title card **Persepolis Reimagined** with an
   ENTER button ("Click enter to continue"). Observed in-browser.
3. **Cinematic descent.** After ENTER, more scroll-advanced cards ("Founded
   by Darius I around 518 BC…") while the camera flies over the full 3D
   citadel model, descends to the Grand Staircase, and hands the visitor a
   role: "Imagine you're a dignitary during this time, traveling to the
   capital to pay respect to the king…". Observed in-browser.
4. **Six numbered chapters**, in fixed order: Gate of All Nations, Apadana,
   Palace of Xerxes, Southeastern Palace, Royal Treasury, Hall of 100
   Columns. Observed in the map menu in-browser; the same order and count is
   in the Getty press release ("Visitors begin their tour at the Gate of All
   Nations… ending their journey with the impressive Hall of 100 Columns").
5. **Finale.** Inside the Hall of 100 Columns a closing card appears:
   "Present-day Persepolis — In 330 BC, the Macedonian king Alexander the
   Great invaded Persia and set fire to Persepolis. The remains of the city
   have endured…" with a "Learn about Persepolis Recovered" button. The
   reconstruction ends by returning the visitor to the ruins and the
   archaeology. Observed in-browser.

Movement model: **a hybrid of guided rail and micro-freedom.** The camera
rides a fixed path; the mouse wheel (or touch scroll) advances it. There is
no walk anywhere, no WASD, no drag-orbit, no pointer lock. At authored
points the rail pauses on a hotspot. Observed in-browser. The fixed path is
confirmed as a deliberate engineering decision by the maker case study
("fixed camera path", precomputed per-shot values — Awwwards case study,
URL above).

Chapter travel is non-linear on demand: a menu opens an aerial map of the
whole site with six numbered pins and a Current / Visited / To visit legend;
clicking a pin travels straight to that chapter through a fog transition.
Observed in-browser (jumped Gate → Apadana → Hall of 100 Columns this way).

Start-up gating: at a narrow viewport (~800 px) the site requested
`static/webgl/preloader/mobile/*` variants; at 1600 px it requested the
desktop variants. Observed in-browser (network log). The Vuex store carries
a `deviceState` enum (`XSMALL: 0 …`) read from window size. Observed in
`app.js`. The press release states the experience "is available across
desktop and mobile" and lists eight languages (Arabic, Farsi, French, Hindi,
Spanish, Traditional and Simplified Chinese, English) — the same eight I
found in the language selector in-browser.

Session length: Getty does not state one. Inference from driving it: a full
six-chapter pass with hotspots is roughly a 20–40 minute experience.

## 2. How it is built

### Engine identification (observed, then confirmed)

- The canvas context is **WebGL2** (`canvas.getContext` probing, observed
  in-browser). Not WebGPU, not Unity WebGL.
- No `window.THREE`, `pc`, `BABYLON`, `PIXI`, or `unityInstance` globals
  exist. Observed in-browser.
- The bundles contain **no Three.js fingerprints** (no `REVISION`, no
  `ShaderChunk`, no `WebGLRenderer` strings). They contain a **custom
  in-house renderer**: classes named in code as `RendererWebGL2` (console
  debug string), a `shaderIndex` with GLSL `#version` preprocessing, VAO
  management, parallel WebGL1 fallback classes
  (`webgl1ContextNames=["webgl","experimental-webgl"]`), and `destruct()`
  lifecycle methods throughout. Observed by fetching and searching
  `app.js` / `vendors.js` in-browser.
- App shell: **Vue 2 + Vuex + vue-router** (routes `/`,
  `/experience/:slug?/:id?`, and a bare `/webgl` debug route), webpack 4
  (`webpackJsonp`), **GSAP 3.9.1** (version read off the live object).
  A Vuex module named `vue-i18n-manager` handles the eight languages.
  dat.GUI styles ship in the page head (debug tooling left in). All
  observed in-browser.
- The maker case study confirms the stack: WebGL 2.0, Vue.js, GSAP, and —
  the key authoring fact — **scenes and camera animation are built in Unity
  and exported to a custom JSON format** ("set up in Unity and exported to
  our own JSON file format using a custom exporter" — Awwwards case study).
  Unity is the editor, not the runtime.

### Asset formats and streaming (observed in-browser, network log)

- **No glTF/GLB, no Draco, no KTX2/basis anywhere.** Geometry ships as
  per-scene JSON from the custom Unity exporter; textures ship as `.webp`.
- Per-chapter scene files under `static/webgl/scenes/<Name>/`:
  `Overview.json` 10.3 MB, `Apadana.json` 9.9 MB, `GateOfAllNations.json`
  1.6 MB, `PalaceOfXerxes.json` 0.5 MB, `HallOf100Columns.json` 0.5 MB
  (transfer sizes; smaller scenes reuse shared parts).
- Each scene has one baked `LightMap.webp` (2.5–4.4 MB).
- Shared material textures live in `scenes/full/` (e.g.
  `Mat_Bull_BaseColour.webp` 1.0 MB, `Mat_GroundPlane4k.webp` 8.0 MB,
  `apadana_stairs.webp` 3.3 MB).
- Sky: a classic six-face cubemap, `dome/2k/{left,right,top,bottom,front,back}.webp`,
  ~1.8 MB total.
- The maker case study explains the JSON approach: "We minimized the filesize
  of the geometry by splitting it up into reusable parts that are reassembled
  in WebGL."
- **Streaming behavior:** the preloader fetches the Overview scene plus the
  first chapter; travelling to a chapter fetches that chapter's JSON +
  lightmap; the app **prefetches the next chapter** while you are in the
  current one (PalaceOfXerxes.json arrived while I was still in the
  Apadana). Chapter swaps are masked by pre-rendered fog videos
  (`fogTransitionIn1080p.mp4` 0.9 MB / `fogTransitionOut1080p.mp4` 1.6 MB).
  All observed in-browser.
- Weight: ~75 MB transferred by the end of the intro; ~104 MB total after
  visiting three of six chapters. Observed in-browser
  (`performance.getEntriesByType('resource')`).
- The served build is versioned `/version/1659513005297/` — epoch
  milliseconds = 2022-08-03, i.e. the live bundle has not changed since
  August 2022. Observed in-browser (URL paths).

### Lighting, post, and performance techniques

- Lighting is **baked**: per-scene lightmaps + albedo textures; no realtime
  GI. Observed in-browser (asset names, `LightMap` strings in `app.js`);
  consistent with the case study's Clarisse look-dev pipeline.
- The maker case study (their words) lists the runtime optimizations:
  frustum culling, LOD ("reduce the number of triangles drawn to a
  minimum"), **dynamic instancing** ("All Objects that share the same mesh
  and material are drawn in one draw call"; `drawElementsInstanced` appears
  in `app.js` — observed), and normal mapping in place of geometry.
- The **fixed camera path is itself the master optimization**: because the
  camera can only be where the rail puts it, the team hand-authored which
  objects appear in floor reflections per shot and baked post-processing
  values (vignette, bloom, grain) into the Unity timeline. (Awwwards case
  study.)
- The preloader landscape is a 2.5D trick: `image_start.webp` +
  `image_end.webp` + `depth_map.webp`, two full renders (dusk and day)
  crossfaded in a shader with depth-parallax — "We combine two renders of
  Persepolis in a shader." (Observed asset names in-browser; technique per
  the case study.)
- The intro flyover blends pre-rendered video into realtime: a 26 MB
  `intro_masked.mp4` composited by chroma key in a WebGL shader ("using a
  WebGL shader to blit the video to the screen" — case study; file observed
  in-browser).
- Resolution is **capped at 1x device-pixel-ratio**: at CSS 1600×900 with
  `devicePixelRatio` 1.5, the backing buffer measured exactly 1600×900.
  Observed in-browser. Inference: a deliberate fill-rate cap.
- Authoring tools (case study): Maya, Substance Painter, Isotropix Clarisse,
  World Creator (terrain from satellite data), After Effects.

### Audio (observed in-browser + case study)

- 26 `.ogg` files, ~13.4 MB total: one music loop per location
  (`apadana-loop.ogg` 1.5 MB, `gate-of-all-nations-loop.ogg`, …), layered
  ambient loops (birds, water, torch fire, indoor/outdoor room tones), and
  ~12 UI one-shots (hover, click, `ui-hotspot-appears`,
  `ui-entering-new-room`, `ui-end-of-room`). Observed in-browser.
- Three WebAudio channels — MUSIC, AMBIENT, UI — each with a default volume
  of 0.8, overridable by URL query params `?music=`, `?ambient=`, `?ui=`.
  Observed in `app.js` source.
- Scoring approach (case study): traditional Persian instruments (kemenche,
  duduk, ney, daf, tombak, darbuka, zurna) chosen with historian input;
  "The goal for music and sound design was to enhance, not to overrule."

## 3. UX patterns for non-gamers

- **One verb: scroll.** The entire experience advances with the scroll
  wheel. "Scroll to continue" / "Scroll to explore" prompts appear with an
  animated down-arrow ring whenever input is expected. Observed in-browser.
- **Free look without commitment:** moving the mouse gently sways the camera
  toward the cursor (a few degrees of parallax). No drag, no pointer lock,
  cursor always visible. Verified by hovering at opposite screen edges and
  comparing frames. Observed in-browser.
- **The rail cannot lose you.** You cannot leave the path, fall, or get
  stuck; scrolling back retreats along the same path. Hotspots pause the
  rail rather than opening a second navigation mode.
- **Wayfinding is a picture, not a minimap:** the menu is an aerial render
  of the whole site with six numbered pins, colored by state (Current /
  Visited / To visit), plus a small world-map inset locating Persepolis in
  Iran. Click a pin to travel. Observed in-browser.
- **Progress affordances:** a numbered medallion badge introduces each
  chapter; a right-edge dot rail shows position within the chapter; the
  menu button is labelled with the current chapter ("Close menu and back to
  Apadana" — an accessible, context-aware label). Observed in-browser.
- **Role-framing as pacing:** the visitor is cast as a dignitary arriving
  to pay respect. Titles arrive one sentence at a time, in sequence, over
  the moving camera. Observed in-browser.
- **Three-layer content depth:** (1) chapter title + one paragraph; (2)
  hotspot cards in-scene (e.g. "Bull Statues", four sentences); (3)
  optional full-screen editorial articles ("Imperial Iconography") with
  museum photographs and citations. Each layer is opt-in; the tour never
  forces reading. Observed in-browser.
- **Accessibility modal:** Reduce Motion, High Contrast, Larger Text, No
  Dragging Interactions, and a language selector (8 languages). Observed
  in-browser. There is also a persistent volume control.
- **Population is non-blocking:** translucent, statue-like human figures
  (guards, robed attendants) stand at gates and doorways. They are scenery,
  not agents; nothing chases, talks, or requires response. Observed
  in-browser.

## 4. Narrative and interpretive framing (epistemic humility)

This is the section most directly relevant to Far Country's
citation-per-claim discipline.

- **Evidence reveal at hotspots.** Key hotspots carry a circular lens
  labelled "Click to reveal present-day view." Clicking crossfades the
  entire reconstruction into a modern photograph of the same spot from the
  same camera angle — painted colossi become the weathered, headless ruins.
  The visitor can always check the conjecture against the surviving
  evidence without leaving the scene. Observed in-browser (Gate of All
  Nations bull statues; comparison images ship under
  `image/past-present/`). The Getty press release confirms the feature
  ("Additional present-day views of surviving architecture and artworks can
  also be viewed within the website").
- **The Art Index.** A menu tab lists real museum objects in five
  categories (Sculptures, Vessels, Weapons, Jewelry, Coins and Seals). Each
  entry has: a description, a **full museum citation** (institution,
  accession number, date, material, image credit — e.g. "Archer,
  Achaemenid, 522–486 BC. Glazed brick. Musée du Louvre… Sb 23875"), and a
  "See it in [location]" link tying the physical object to the place in the
  reconstruction where its kind appears. Observed in-browser. The press
  release frames this as "bridging surviving physical artifacts with this
  standalone digital recreation."
- **Scholarly lineage is credited, not implied.** The About panel credits:
  exhibition curators (Timothy Potts, Jeffrey Spier, Sara E. Cole); a Getty
  project committee; "3D Model Adapted from Demanavision, K. Afhami, and W.
  Gambke"; consulting advisor Ali Mousavi; production Media.Monks. Observed
  in-browser. The underlying model is the **Persepolis3D** project, begun
  2001 by architects Kourosh Afhami and Wolfgang Gambke and built from
  excavation documentation (Herzfeld, Krefter, Schmidt, Stronach, Sami) —
  persepolis3d.com (news page) and the Media.Monks case study ("enhanced
  and retopologized" from the Persepolis3D models). Getty did not invent
  the geometry; it adapted a 20-year scholarly reconstruction and says so.
- **Method transparency from the makers.** The case study describes tracing
  archival photographs for reliefs, photographing intact on-site surfaces
  for textures, using "illustrations of similar gardens from the Persian
  Empire" where direct evidence is absent, and a curator-built "material
  style sheet" governing surface treatments per area. Awwwards case study.
- **Conjecture is asserted, not hedged, in the copy** — the interpretive
  humility lives in the *devices* (present-day reveals, Art Index, credits,
  the closing return to the ruins), not in hedged prose. Getty's press
  language claims "the most accurate recreation of Persepolis to date."
  Inference: for a general audience they chose confident narration plus
  always-available evidence, rather than per-claim uncertainty labels.
  Far Country's confidence-tier badges go further than Getty here.
- **The ending is an argument.** The tour's last beat is the burning of the
  city and its present ruins — the reconstruction closes by pointing back
  at the evidence and at the archaeology ("Learn about Persepolis
  Recovered"). Observed in-browser.

## 5. Who built it

- **Client/owner:** the J. Paul Getty Museum, as part of the Getty Villa
  exhibition *Persia: Ancient Iran and the Classical World* (April 6 –
  August 8, 2022). Getty press release, 2022-04-25.
- **Production studio:** **Media.Monks** (credited in the site's About
  panel, observed in-browser; named "MediaMonks" in the Getty press
  release).
- **Academic consultants:** UCLA (Getty press release); consulting advisor
  Ali Mousavi (About panel, observed in-browser).
- **3D model source:** Demanavision + K. Afhami and W. Gambke (About
  panel), i.e. the Persepolis3D reconstruction project
  (persepolis3d.com).
- **Maker postmortem:** the Media.Monks-written technical case study
  published as Awwwards Site of the Month, June 2022 —
  https://www.awwwards.com/case-study-getty-persepolis-reimagined.html.
  This is the single best technical source.
- **Awards:** Awwwards Site of the Month (June 2022, same URL); FWA of the
  Day/Month, and **FWA of the Year 2022 + FWA People's Choice of the Year**
  (https://thefwa.com/cases/getty-villa-persepolis-reimagined; award
  write-up at
  https://lbbonline.com/news/mediamonks-and-getty-win-fwa-of-the-year-and-fwa-peoples-choice-award-of-the-year).
- Getty published a follow-up flythrough video of the same reconstruction
  in August 2024 (Getty news, video page URL above).

## 6. Transferability to Far Country

Each note names the finding, then the application, then the governing
policy.

1. **Guided rail as a mode, not the world.** Persepolis proves a
   scroll-only rail can carry a non-gamer through a large 3D city with zero
   tutorial. Far Country already has free walk/fly + click-to-travel
   (`core/NavigationUI.ts`); the transferable piece is an optional
   **authored pilgrimage tour**: a fixed camera path through the gates, up
   the processional ramps, to the summit, advancing on scroll or a single
   key, pausing at cited entities, with "Scroll to continue" prompts and a
   right-edge progress rail. This satisfies the approachable-navigation
   requirement (mouse-driven, visible cursor, no pointer lock — Scott's
   standing preference) without touching the free-roam mode. Content on the
   rail must still be descriptor-anchored (ADR 0011 rule 5; hermeneutics
   §8).

2. **The evidence lens.** Persepolis' best interpretive device is the
   camera-matched "present-day view" reveal: conjecture and evidence
   occupy the same frame. Far Country's analogue is a **"show the text"
   lens**: at any cited entity, crossfade the rendered interpretation into
   the evidence layer — the descriptor statement, tier badge, citation, and
   symbolic referent (the data the EntityHud already fetches), or visually
   dim everything the render *adds beyond* the citations (the interpretive
   architecture already flagged uncited in RENDERING-DECISIONS, e.g. the
   ramp chains). This is ADR 0009's literal-vs-symbolic discipline turned
   into a single, wordless interaction. It composes with the existing
   reading key (M3.5) rather than replacing it.

3. **Index ↔ world deep links.** The Art Index's "See it in [location]"
   pattern: every catalogue entry links to the place in the world where it
   is rendered. Far Country already has both halves (browse UI entities;
   in-world click-picking off the same `/data/entities/*.json`); the
   missing piece is the **deep link from entity page into the 3D scene**
   (fly-to-entity on arrival). Low-risk, high-payoff for the
   citation-per-claim posture: the dataset becomes the index of the world.

4. **Chapter streaming behind a masking transition.** Persepolis splits the
   city into per-district scene files (0.5–10 MB JSON + 2.5–4.4 MB
   lightmap), prefetches the next district, and hides swaps behind a 1–2 s
   fog video. At Far Country's citywide scale (ADR 0014), the same shape
   applies to quick-travel: prefetch the destination district's heavy
   content while masking the jump with a glory-light/cloud transition
   (which the engine can render live rather than as video). Their numbers
   are a useful budget reference: a whole scholarly city district reads
   convincingly at well under 15 MB because lighting is baked and parts are
   instanced and reused.

5. **Fixed-path budgets vs. free roam.** Their headline optimizations
   (hand-picked per-shot reflection lists, post values baked into the
   authoring timeline, capped 1x DPR) all exploit the fixed camera. Far
   Country's free roam cannot precompute per-shot lists — but the
   pilgrimage tour mode (note 1) *can*: on the rail, the engine could run a
   heavier look (longer draw distances, richer reflections) than free roam
   allows, because visibility is authored. Also directly transferable
   today: the **DPR cap** as a quality tier on weaker GPUs.

6. **Audio zoning.** Per-location music loops + layered ambient beds +
   tiny UI sounds on three volume channels, crossfaded on zone entry
   ("ui-entering-new-room" / "ui-end-of-room" cues). Far Country's
   procedural ambience (RENDERING-DECISIONS #9) already covers the bed;
   the transferable pattern is **zone-keyed crossfades and threshold
   cues** at gates and the temple courts, still score-as-context, not
   cited content (entry #5 posture). Channel volumes as URL params are a
   cheap debug affordance worth copying.

7. **Population as non-assertive presence.** Persepolis renders people as
   translucent, statue-like, generic figures — legible as evocation, not
   as archaeological claim. Inference on their intent, but the effect is
   plain in-scene. Far Country's multitude has deliberately gone the other
   way (photoreal-anonymous, ADR 0019) for *clear*-tier populations — but
   the ghost treatment is exactly the "stylised, visibly unphysical"
   register ADR 0009 rule 2 demands for `symbolic`-tier beings. If the
   four living creatures or the twenty-four elders ever get their
   RENDERING-DECISIONS entry (ADR 0011 rule 4), Persepolis' translucent
   register is the reference art. Divine persons remain absolutely out of
   scope for any figure treatment (ADR 0010).

8. **Role-framing.** "Imagine you're a dignitary…" gives the visitor a
   motivated path and makes the guided tour feel like an arrival, not a
   slideshow. Far Country has a textually grounded equivalent: the nations
   making pilgrimage through the open gates (Rev 21:24–26; Zech 14:16 —
   already M4.4 scope). Framing the tour as *entering with the nations* is
   a narrative device, not a content claim, but the wording shown on
   screen must stay inside cited descriptors per hermeneutics §8.

9. **Confident narration + evidence devices, or tier badges?** Getty
   narrates confidently and concentrates humility in devices (note 2's
   lens, the Art Index, the credits, the ruins ending). Far Country
   surfaces per-claim tiers directly. Keep the tiers — they are the
   project's spine — but Persepolis shows the *pacing*: short assertive
   sentences on screen, one idea at a time, with the apparatus one click
   away. Our descriptor cards already match this shape; the tour titles
   should too.

10. **Accessibility floor.** Reduce Motion, Larger Text, High Contrast,
    No Dragging Interactions, and context-aware control labels are all
    cheap and all absent from Far Country's world UI today. A
    reduce-motion setting matters specifically for a scroll-rail tour
    (it is the setting that legitimizes heavy camera motion for everyone
    else). Worth a backlog line when the tour mode is scoped.

11. **What not to copy.** (a) The WebGL1-fallback + mobile-variant asset
    pipeline: Persepolis spent heavily to reach every device; ADR 0013
    already accepted the WebGPU gate, and the LAAS engine's realtime
    terrain/atmosphere is the quality bar Persepolis' baked approach
    cannot reach. (b) Baked lightmaps as the global strategy: they fit a
    dead-static stone city frozen at one hour of day; Far Country's glory
    light, water, and crowd dynamism are live systems. Partial bakes for
    static interiors (wall gallery, temple chambers) remain a plausible
    future optimization, but that is an engine-team call, not a policy
    one.

## Open questions

- **Frame-rate behavior at city scale** could not be measured: the embedded
  pane never produced compositor frames (the rAF stall described in the
  caveat). No primary source states target or achieved FPS.
- **Chapters 3–5** (Palace of Xerxes, Southeastern Palace, Royal Treasury)
  were not walked end-to-end in this session; their internal beat counts
  and hotspot inventories are unverified (their asset files were observed
  prefetching).
- **The exact end-of-experience behavior** after the "Present-day
  Persepolis" card (does "Learn about Persepolis Recovered" lead to a
  final editorial route, exterior ruins scene, or external link?) was not
  followed.
- **Mobile input mapping** (touch scroll vs. gyro, hotspot interaction on
  small screens) was not tested; only the mobile asset gating was observed.
- **"Demanavision"**'s exact role (the studio that adapted the
  Afhami/Gambke model for Getty?) is not documented in any fetched primary
  source; only the About-panel credit line was observed.
- **Whether `vue-i18n-manager` and the `destruct()`-style core are
  Media.Monks open-source libraries** is inference from naming conventions
  observed in the bundle; the case study confirms the stack but not the
  specific packages.
- The Media.Monks portfolio page (monks.com) returned HTTP 403 to fetches;
  its contents are unverified beyond search-result snippets.
