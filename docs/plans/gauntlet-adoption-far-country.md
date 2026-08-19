# Plan: adopting the Gauntlet Loop and its verification doctrine in Far Country

Status: Proposed (2026-08-19). Owner: Scott. Drafted from
[`docs/research/2026-08-19-gauntlet-loop-and-agentic-build-methods.md`](../research/2026-08-19-gauntlet-loop-and-agentic-build-methods.md)
(read that first; this plan cites it as "the research doc").

## What this is

Far Country's Phase 3 goal — a maximally convincing, photoreal-leaning
explorable world — is exactly the problem class the Gauntlet Loop was
demonstrated on (Shumer's forest/Hogwarts, Claude of Duty, the F1 film).
This plan says what we adopt, what we adapt, what we reject, and in what
order. Nothing here changes WHAT we render (that stays governed by the
dataset, the ADRs and the hermeneutic policy); it changes HOW we push
quality and how we verify.

## Ground rules (non-negotiable, restated for gauntlet work)

1. **The bar is aesthetic, never content.** Reference images calibrate
   lighting, materials, atmosphere, composition — they never introduce
   features. No critic may add content to the world that lacks a
   descriptor or an established illustrative-wilderness basis (Rev 21:1,
   ADR 0015/0016). A critic saying "real canyons have X, add X" is
   proposing a CONTENT change and must be surfaced to Scott, not applied.
2. **House rules for every gauntlet run = the ADRs.** At minimum: 0010
   (aniconic policy — no depictions of God; this binds critics hardest),
   0011 (population rendering), 0009 (symbolic vs literal), 0014/0015/0016
   (scale and terrain), 0021 (asset licensing), plus the wildRing header
   invariants (drain law, spine z >= 5250, fixed anchors). Per Shumer's
   method, a dedicated rules-check agent reviews work against these before
   it lands.
3. **Scott's eye is the top instrument.** The F1 project's central
   finding: five rebuilds measured better and a human rejected every one.
   Scott's feel-pass verdicts are primary evidence; instruments get
   rebuilt to match his verdicts, never the reverse, and his blunt
   wording is treated as diagnosis, not noise.
4. **Shipped choices stay shipped.** Gauntlet passes polish the picked
   canyonlands variant etc.; they do not relitigate picks (macro anchors
   move only on Scott's say).

## What we already have, in gauntlet vocabulary

| Gauntlet concept | Far Country today |
| --- | --- |
| Inspectable artifact | `tools/shoot.ts` stills; five canonical wild-ring cams (`shots/wip/wildring/redo-batch.sh`); RimFalls cams |
| Gates | ~20 probe tools (13-probe battery verified 2026-08-18), PASS/FAIL, run against the live scene |
| Contract modules | `rimModel.ts` / `WorldConst.ts` constants imported by probes "so they can't drift" (probe-rimfalls already does this) |
| Engineering log | `STATUS.md` (narrative, editable) |
| Session reuse | Handoff prompts + memory + STATUS.md |
| The client ear | Scott's feel passes |
| Progress page | None (reports land in chat) |
| The bar | Implicit ("stunning, never basic") — NOT yet a concrete reference set |
| Builder/critic separation | None formalized |

The engine already satisfies Der Koloss takeaway #2's headline: we render
through a real post stack and tonemap with AgX (`src/render/PostStack.ts`).

## Workstreams, in order

### GA-1. Harden the instruments (do first; cheap; makes everything else trustworthy)

Apply the Broken Instruments doctrine (research doc §4a-4b) to our probes
and shoot pipeline. Concrete steps:

1. **Census + audit.** One session lists every probe in
   `apps/world-engine/tools/` and answers, per probe: does it open the
   live artifact (scene state, pixels) or a report? What are its
   thresholds and where did each number come from (design doc / physics /
   measured-off-the-current-scene)? Any threshold whose provenance is
   "the current scene" is flagged: it detects regression, not quality.
   Output: a table in STATUS.md plus per-probe header notes.
2. **Mutation-test the battery once.** Deliberately break one thing per
   subsystem (e.g. drop a doline pond's water, reverse a mesh's winding,
   zero the gamepad deadzone) and require exactly the right probe to
   fail. Any probe that stays green has no case to answer — fix or
   retire it. Record predictions before running (practice #4).
3. **Three verdicts.** Probes report PASS / FAIL / UNMEASURED, and
   UNMEASURED is never rendered as success (exit code distinct from 0/1,
   or a summary line the batch runner refuses to count as pass). Today's
   probes are two-valued.
4. **Black-frame gate in `shoot.ts`.** Decode every captured still and
   assert basic content statistics (mean luminance within sane bounds,
   nonzero variance, not >99% one color). The F1 farm shipped a
   structurally perfect all-black PNG because "nothing looked at the
   picture"; our GPU-flaky laptop (historical Code 43, createBuffer boot
   failures) makes this a live risk for us, and every critic pass will
   stand on these stills.
5. **Winding/inside-out check.** The F1 log's hardest lesson: reversed
   geometry renders plausibly, not black. Add a one-shot audit tool
   (normals vs camera on key meshes, or a two-sided-lighting diff shot)
   for our hero meshes (temple, gates, dwellings, figures).

Exit criteria: battery re-run green, mutation test on record, shoot.ts
gate in place. Everything later leans on this.

### GA-2. Fix the bar (Scott + one session)

Build the reference set that plays the role CoD screenshots played.
Proposal, per region (a handful of images each, stored under
`apps/world-engine/shots/ref/` — gitignored if licensing is unclear;
CC0/public-domain preferred so they can be committed):

- Wilderness band (canyonlands): real photography — southwest US canyon
  country, benched sandstone walls, desert varnish, plunge pools.
- Approach + plateau: high-steppe / alpine meadow photography.
- City exteriors: Scott's existing concept renders (Desktop "Far Country"
  folder: temple-complex, river-of-life, millenial-life series) serve as
  MOOD references; real architectural/stone photography serves as
  MATERIAL references. The two roles are labeled distinctly.
- Sky/atmosphere: photography at our fixed time-of-day.

Plus the standing sentence-form bar (Shumer §3): "a stranger flipping
between our still and the reference photo should hesitate before saying
which is the render." Scott approves the reference set before any
gauntlet run uses it; swapping a reference later is a logged decision.

### GA-3. First gauntlet run: wilderness-band material + atmosphere polish

Scope deliberately narrow for the first run: the canyonlands band only
(z 4400-6144), macro anchors FROZEN, content frozen — materials,
lighting, atmosphere, water shading, vegetation shading only. This is
the transformation mode (Der Koloss v1→v2), not greenfield.

Mechanics, adapted from the research doc:

- One lead session; per-piece builder subagents (rock faces, water,
  vegetation, falls ribbons) MAY fan out, but atmosphere/tonemap/exposure
  get ONE owner in ONE sequential pass (Claude-of-Duty: parallel agents
  on the coupled lighting system made defects worse, 60→66; a single
  owner cut them 66→26).
- Critics: fresh-context subagents that see ONLY (goal, bar images, house
  rules, our stills from the named cams) — never the builder's rationale.
  Blind A/B where possible. Critic output = the single biggest gap.
  Critics also obey the misdiagnosis lesson: measure before obeying
  (e.g. "untextured" may be crushed diffuse).
- Every round shoots the SAME named cams (our five canonical + RimFalls
  set), with the GA-1 gates green as a precondition — a round that breaks
  a probe is rejected before any critic sees it.
- Re-run probe-wildwater + probe-rimfalls after any rim-adjacent change
  (standing rule from the canyonlands work).
- Progress page: a single local HTML file the loop appends
  round-number + thumbnails + critic verdicts to (sent to Scott via
  chat); workbench.md is optional and off by default (external hosting;
  keep license posture simple).
- Stop condition: Scott stops it, or two consecutive rounds where the
  critic cannot name a gap that is not content-gated.

The ready-to-paste prompt for this run is in the appendix.

### GA-4. Renderer artifact hunt ("AAA is the absence of artifacts")

A standalone pass, separate from GA-3, walking Der Koloss takeaway #3
against our engine: shimmer at glancing angles, specular sparkle, shadow
stair-step/swim while walking, visible texture repetition on the mesa rim
and city walls, plus Claude-of-Duty's two-scale macro-variation check
(3-4 m AND ~12 m bands on monumental surfaces). Deliverables: a defect
list with still/clip evidence, then fixes. Techniques on the shelf:
shadow-texel snapping, normal-map fade by pixel footprint, roughness
widening by normal variance, source band-limiting before normal
derivation. Also port Claude-of-Duty's prewarm lesson: audit for lazy
pipeline creation hitches (their 728-1236 ms stalls; ours would be
WebGPU pipeline compiles) with a frame-time distribution, not average
fps.

### GA-5. M4.4 worship motion — procedural clips as the proposed default

The research gives us a third credible option beyond the stalled
download-vs-NVIDIA choice (memory: m44-dynamism-scoping): author the
worship cycles procedurally in the Claude-of-Duty clips.js style — euler
DELTAS in degrees on anatomically-named axes over the bind pose, layered
slow oscillators (breath, sway, weight shift), blended by lerping delta
arrays. Evidence it can carry reverent, low-intensity motion: that
codebase's idle/breath cycles (exactly our register — no combat
dynamics needed); the F1 project animated everything as computed curves.
Licensing: zero external anim assets, zero attribution burden (keeps ADR
0021 simple). Proposal: prototype ONE figure with breath + sway + a
kneel-to-stand cycle behind a flag; Scott judges feel before we commit.
Quaternius CC0 clips remain the fallback if procedural reads robotic.

### GA-6. Engineering-log upgrade (adopt the F1 conventions, scaled down)

- Add `apps/world-engine/DEFECTS.md`: append-only numbered entries
  (`FC-0001 — one-line finding`), body = believed / measured / meant,
  corrections appended (never edited), a "next free number" line at top.
  STATUS.md stays the narrative; DEFECTS.md is the evidence trail.
  Gauntlet rounds, probe mutations, and Scott's feel-pass verdicts (his
  words verbatim) all land here.
- Adopt "which artifact is current": a small CURRENT table at the top of
  `shots/wip/` README naming the stills that reflect HEAD (the F1 client
  twice judged stale artifacts; Scott reviews stills asynchronously, so
  we have the same exposure).
- Once per phase: a doc-accuracy sweep hunting claims that were true when
  written and are false now (their DOC-ACCURACY-AUDIT method), settled
  against the tree/scene, not against other docs.

### GA-7. Audio layer (deferred until Scott opens it)

When the ambience layer starts, the recipe is now concrete: generate
candidates with ElevenLabs SFX (key already in local .env; never
client-side; vendored output only per memory), remediate with a local DSP
pass (Der Koloss scripts: transient alignment, decay envelopes, true-peak
ceiling), set a loudness ladder up front (theirs, re-based for a world
with no gunfire: water > wind > vegetation > birds/distant life > crowd
murmur floor), and gate shipped files with a measured manifest. Synthesis
(Claude-of-Duty IRs, F1 physical modeling) is the fallback for wind/water
beds where generation disappoints. Standing cautions: relative-only
audio metrics are gameable by silence (F1 §II) — include absolute SPL
floors; and voiced ESV still requires the Crossway licensing check first.

## Explicitly rejected / deferred

- Ultracode-by-default: even Shumer reserves it for foundations. Our
  foundations exist. Consider it only if we ever rebuild a core system.
- Pure-procedural maximalism: 11 critic rounds capped at 5.05/10 on
  code-generated textures (research doc §3). Our hybrid ADR 0020/0021
  posture stands; the forge techniques serve variation/weathering on top.
- vast-render / farm rendering: no current need; noted (Apache-2.0) for a
  future film-shot or baking campaign.
- workbench.md as default coordination: local progress page first.
- f1-round2 code reuse: GPL — learn, never vendor.
- 26B-token-scale runs: our unit of work stays the scoped overnight run.

## Cost expectations (so nothing surprises Scott)

Community datapoints: ~$400 / 3 h for a one-shot game build on API
billing; "a big chunk of a Max plan's weekly limit" per serious run
(Shumer's warning); the F1 outlier at $20.7k/4 weeks; one builder maxing
two Max 20x accounts with four projects. Our scoped runs (GA-3, GA-4)
are a fraction of a greenfield build, but a full overnight gauntlet will
still eat a meaningful share of a Max week. Recommendation: one scoped
run at a time, launched at night, reviewed each morning.

## Sequencing and gates

GA-1 → GA-2 → GA-3 are strictly ordered (instruments, then bar, then
run). GA-4 can interleave after GA-1. GA-5 is independent (Scott's call
to start). GA-6 starts with GA-1's audit table as entry FC-0001. GA-7
waits.

Scott decision points: approve this plan; approve the GA-2 reference set;
pick the GA-3 launch night; judge the GA-5 prototype; (independently)
the still-owed canyonlands feel pass, seed-jitter call, and gamepad
session from the Phase 3 close-out.

## Appendix: the first-run prompt (paste-as-is once GA-1 and GA-2 are done)

Run recipe: fresh Claude Code session, this repo, a dedicated worktree,
dev server on :5173, no extra MCP servers connected. Paste:

```
Read docs/plans/gauntlet-adoption-far-country.md (workstream GA-3), docs/research/2026-08-19-gauntlet-loop-and-agentic-build-methods.md, apps/world-engine/src/nj/wildRing.ts (the header), and apps/world-engine/STATUS.md, then run a Gauntlet Loop on the wilderness band of the New Jerusalem scene (?scene=newjerusalem, the southern band z 4400-6144).

Goal: the band's rendered stills should hold up next to real canyon-country photography. The bar is the reference set in apps/world-engine/shots/ref/ plus this test: a stranger flipping between our still and a reference photo should hesitate before saying which is the render.

Hard limits: materials, lighting, atmosphere, water shading and vegetation shading only. Do not move macro anchors, do not add or remove content, and obey the house rules: ADRs 0009/0010/0011/0014/0015/0016/0021 and the invariants in the wildRing.ts header. Anything a critic wants that would change content gets logged for Scott instead of built. Atmosphere, exposure and tonemap changes get one owner in one sequential pass; other pieces may fan out to builder subagents.

Every round: keep the full probe battery green (re-run probe-wildwater and probe-rimfalls after any rim-adjacent change), reshoot the five canonical wild-ring cams and the RimFalls cams with tools/shoot.ts, and have a fresh-context critic subagent that has NOT seen the builder's reasoning compare our stills against the reference set blind and name the single biggest gap. Measure a critic's claim before obeying it. Append each round (thumbnails, verdict, gap) to a local progress page and to apps/world-engine/DEFECTS.md.

/loop until Scott stops the run or a critic cannot name a gap that is not content-gated. Do not stop because a round merely looks good.
```
