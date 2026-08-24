# Research: the Gauntlet Loop and industrial-scale agentic 3D builds

Date: 2026-08-19. Author: Claude (Fable 5) session, commissioned by Scott.

This is the reference document distilled from a full read of Matt Shumer's
Gauntlet Loop material, the Claude-of-Duty repository, the @aipulseda1ly F1
film project (f1-round2 + vast-render + its public retrospective site), the
Der Koloss v2 community edition, and the community threads around all of
them. It exists so future sessions do not have to re-read those sources.
The companion implementation plan for Far Country is
[`docs/plans/gauntlet-adoption-far-country.md`](../plans/gauntlet-adoption-far-country.md).

This is the first file in `docs/research/`; the convention is one dated,
cited findings file per commissioned research pass (analogous to
`docs/plans/` for plans).

Sources are cited inline. Primary sources: somethingbig.ai/gauntlet-loop,
shumer.dev/how-i-prompt-fable, shumer.dev/prompting-ai-agents,
github.com/mshumer/Claude-of-Duty (MIT), github.com/aipulsedaily/f1-round2
(GPL-3.0-or-later code / CC BY-SA 4.0 docs), github.com/aipulsedaily/vast-render
(Apache-2.0), f1-opus5.aipulsedaily.ai, github.com/rishipr/der-koloss-ce (MIT),
workbench.md, and the X threads of @mattshumer_, @aipulseda1ly, @Ryancampbell,
@0xRishi, @moridinamael, @markgadala, @majidmanzarpour, @suriadesign.

---

## 1. The Gauntlet Loop, in one page

Matt Shumer's name for the prompting pattern behind "Claude of Duty" — a
Call of Duty-style FPS that Claude Code (Opus 5) built from a single prompt
(~67k lines measured in the repo; every texture, mesh, animation and sound
generated in code). Published as a method at somethingbig.ai/gauntlet-loop
(Jul 27, 2026).

The loop:

1. A lead agent gets a **goal** and a **real bar** (a concrete artifact of
   what great looks like — e.g. actual Call of Duty screenshots).
2. The lead agent — not the human — splits the goal into the smallest
   pieces that can be improved and judged separately.
3. Each piece gets a **builder** and a **separate critic with fresh
   context**. The critic inspects the real output (actual pixels, running
   product), compares it against the bar — blind A/B where possible —
   names the biggest remaining gap, and sends it back.
4. **No fixed number of rounds.** The loop runs until the output wins or
   the human stops it. Shumer stopped his run while it was still improving.
5. The lead agent maintains a **live progress page** (screenshots, notes)
   so the human can watch from a phone without interrupting.
6. Optional **smoothing pass**: after a major wave, one fresh agent
   inspects the whole artifact and reconciles independently-improved
   pieces. Not the core; the core is split, build, judge, repeat.

Key phrasing rules:

- **Goal, not implementation.** "When you prescribe the architecture, the
  workstreams, and every step, you replace the model's judgment with your
  own. Give it the destination. Let it choose the route."
- **The bar is the most important part.** "'Make it amazing' is not a bar."
  The bar must be inspectable: reference screenshots, best-in-category
  sites, a test suite, a latency target, a reference implementation. A bar
  does not need to be reachable — CoD kept the agent from stopping at
  "pretty good for AI". If you do not know the bar, make finding one part
  of the task.
- **Never let the builder grade itself.** The builder carries a trajectory
  of self-justification. The critic gets the goal, bar, rules and the
  artifact — never the builder's history — and behaves like a blind A/B
  tester. "It should never grade a summary written by the builder."

### 1a. The original prompt (verbatim; repo is MIT-licensed)

From github.com/mshumer/Claude-of-Duty/blob/main/prompt.md — "This is the
entire prompt that produced this repository":

> I want you to build a first-person shooter at the level of the most
> recent Call of Duty games. It should be utterly perfect, visually
> beautiful, with every single thing done at AAA quality—from textures to
> physics to anything you could think of.
>
> Fan out sub-agents and have sub-agents tackle each one individually so
> that the game is utterly perfect. You should /loop on each item and have
> a separate sub-agent check it visually to ensure it looks triple A. That
> separate sub-agent should be a really harsh critic, and if it doesn't
> look triple A, it should keep going.
>
> Don't stop until each sub-agent is utterly wowed with the quality when
> compared with the actual Call of Duty game. It should literally compare
> them side by side blind and say which one looks better. Do this in
> ThreeJS. /loop until it's utterly perfect. Fan out sub-agents and
> ultracode.

Anatomy: goal + bar by named real product; absolute quality words repeated
("utterly perfect" 3x, "AAA" 3x); scope by gesture ("anything you could
think of"); process specified in detail (fan-out, /loop per item, separate
harsh critic, blind side-by-side); exactly one tech constraint ("Do this in
ThreeJS"). Notably NOT in the prompt: procedural-only assets — that
signature constraint was the agents' own decision (recorded in the repo's
agent-authored ARCHITECTURE.md as an offline-sandbox necessity).

### 1b. The DIY meta-prompt

The article ships a meta-prompt: paste it plus your goal into a strong
model, and it chooses the bar and writes the final Gauntlet prompt for
you. Core clauses: choose the strongest concrete bar an agent can inspect;
write a SHORT prompt in the style of Matt's; lead agent divides the goal
into the smallest independently-judgeable pieces; per piece, builder +
fresh-context critic; critic inspects real output, blind A/B against the
bar, names the biggest gap, loops; maintain a live progress page; use
subagents and ultracode; "Do not prescribe the architecture, exact
decomposition, or a fixed number of rounds." (Full text preserved in the
session research notes; also at somethingbig.ai/gauntlet-loop.) A hosted
generator exists (somethingbig.ai/gauntlet-loop/generator, free,
email-gated, 5/day); its template is server-side — the article meta-prompt
is the public equivalent.

### 1c. Run conditions Shumer insists on

From the generator page ("do all four or it won't work"):

1. Claude Code with Opus 5 — an agentic harness that can spawn subagents
   and inspect its own work. "A normal chat window will not produce the
   same result."
2. Ultracode effort (though how-i-prompt-fable qualifies this: he almost
   never uses ultracode — "a good loop with an ambitious enough goal gets
   me there without it" — reserving it for foundations that will be built
   on for months).
3. **A clean session — no skills, no MCP servers.** "They hijack the loop,
   and the prompt works dramatically worse with them."
4. Paste it and walk away. Do not steer. Watch the live progress page;
   stop the run when you love what you see.

Cost warning is explicit: a Gauntlet Loop "can burn through an enormous
number of tokens — easily a big chunk of a Max plan's weekly limit."

---

## 2. "How I Prompt Fable" (shumer.dev, Jul 3 2026) — the eight principles

His one-line summary: "give it the goal instead of the steps, fence it
with house rules, set a bar for done that it can't talk its way out of,
and loop it until it gets there." Written for the Fable-class models; the
Gauntlet Loop is this method packaged for one-shot builds.

1. **Goal, not steps.** Older models needed step-by-step; Fable is the
   opposite — "The more room you give it, the better it does." Hand it
   big, underspecified work like briefing a brilliant trusted person.
2. **House rules.** The handful of invariants that must stay true no
   matter how the goal is reached (his example: "don't hard-code special
   cases; describe the behavior and let the agent reason"). Optionally a
   dedicated sub-agent checks all work against the house rules before
   anything lands. Rules are what make the underspecified goal safe.
3. **A real bar for done.** Never adjectives. Either write the test
   yourself ("a stranger can't tell our render from the real photo") or
   hand the measuring-stick problem to the model too — his friend's
   component-library clone was unblocked when Fable invented its own
   metric (heat-mapped a screen recording of the real components and
   iterated until its version matched). Rule never broken: **the builder
   never grades its own work** — a fresh-context sub-agent inspects the
   real output and "tries to prove the thing is not passing" (adversarial
   framing, not "check if it's good").
4. **Loop until the bar** — /loop for hours or days. "Fable never gets to
   decide it's finished. There's always a next gap." Monitor via a live
   progress doc (he uses workbench.md) instead of interrupting.
5. **Old work is fuel.** Point new builds at previous builds' code, bars,
   and even old Claude Code session traces — "read the forest traces and
   learn what worked" is how his Hogwarts scene beat his forest's build
   time. (Community confirmation: Ryan Campbell builds each new game with
   "a note to the gauntlet prompt to first pull learnings and code from
   the previous games.")
6. **Get out of its way.** Budgets instead of per-use permission; say
   where credentials live; written autonomy ("make your own calls; come
   back only if truly blocked"). Exception: up-front planning, but only
   for huge consequential builds.
7. **Two run shapes.** Engineering = a team of sessions pulling tasks,
   each triple-checking with sub-agents and opening PRs with evidence,
   plus ONE integrator session that merges, runs everything, "tests like a
   real user," keeps the build green. Creative = same loop and bar, but
   fan out sub-agents per piece, sometimes run parallel separate attempts
   and keep the best.
8. **Ultracode only for foundations** — systems that everything else will
   sit on for months.

His earlier "Ultimate Guide to Prompting AI Agents" (Apr 2026) supplies
the briefing discipline underneath: the 3 C's — Context (the Intern Test:
could a new employee execute this brief without follow-ups?), Constraints
(mandate verification behaviors; the highest-leverage phrase is "don't
finish until..."), Composition (specify the deliverable's shape).

---

## 3. Case study: Claude of Duty (what the repo actually shows)

Repo: github.com/mshumer/Claude-of-Duty (MIT). ~67k lines of source in 185
files, 11 subsystems, Three.js, zero external assets. Full notes with
file:line citations are in the session archive; the durable lessons:

**Honest scoreboard.** Eleven independent adversarial critics scored review
frames across rounds: 3.59 → 4.14 → 4.05 → 5.05 out of 10, and in every
blind A/B every critic picked real Call of Duty. The README's failure list
names hands, character mannequin-ness, no real GI, and "the ceiling of
generating texture from code" — procedural surfaces "read as procedural
noise rather than photographed reality at close range."
*Implication for us: pure-procedural materials cap well below photoreal at
close range; Far Country's hybrid posture (procedural terrain + vendored
CC0 assets, ADR 0020/0021) is the stronger position, and texture-forge
techniques are best used for variation and weathering on top of good base
assets.*

**Sequential beats parallel on coupled systems.** Three rounds of six
parallel agents each owning one directory moved the visual score +0.46 and
left frame-ruining defects HIGHER than they started (60 → 47 → 66), because
tonemapping, sky and indirect light are one coupled system. One sequential
pass with a single owner per coupled concern moved it +1.00 and cut defects
66 → 26. Fan-out is for independent pieces; lighting/atmosphere/tonemap
want one owner.

**Critics can misdiagnose.** Critics kept calling a weapon "untextured";
measurement showed it was specular-dominated with crushed diffuse, and
prior rounds of obeying the critic had made it worse. "The fix was the
opposite of what was asked for." Measure before obeying.

**The harness is the interesting part** (README's own words). What it had:
- 11 named, deterministic review shots — each freezes input, poses the
  camera, optionally forces gameplay state, and documents what it reviews —
  so critics always judge the same framing across iterations.
- Bit-identical baseline captures (fresh page per shot, fixed frame budget,
  lockstep frame pump, seeded RNG everywhere; `Math.random()` banned) —
  because reused-page captures were NOT reproducible (10 of 11 shots
  differed between identical runs until isolation).
- A per-pixel image-diff gate used to constrain a whole optimization pass
  to provably zero visual change (shipped build bit-identical to its
  pre-optimization reference) while p50 went 12-17 fps → 28-30 fps, worst
  frame 1236 → 82 ms, mid-play shader compiles 35 → 0.
- Frame-time distribution profiling with hitch attribution — a median-fps
  benchmark had said 94 fps while real gameplay ran 12-17 fps with
  728-1236 ms stalls from 34+ lazy WebGL program compiles. The fix was a
  prewarm contract (compile every shader/pipeline variant before frame 1).
  The WebGPU analogue is lazy render/compute pipeline creation.
- ~780 MB of critic screenshots deliberately left uncommitted (gitignored),
  with regeneration instructions — review artifacts are disposable, the
  harness is not.

**Coordination for parallel agents.** One contract file (ARCHITECTURE.md)
carried the whole burden: directory ownership table, a service-locator
(`ctx.get('fx')`) instead of cross-imports, a canonical event vocabulary
with "if you need a new event, add the row in the same commit," and seven
hard rules (no new deps, no Math.random, no per-frame allocation, dispose
what you create, the build and a screenshot must pass after every change —
"If you break the boot, nobody else can work").

**Technique inventory worth remembering** (engine-agnostic):
- GPU texture forge: one fragment program → four render targets (height /
  albedo+height / ORM / Sobel-derived normal), no CPU readback; periodic
  mod-wrapped noise so tiles are seamless; surfaces are authored functions
  with albedos written as physical paint-swatch values.
- Mip-aware feature sizing: no texture feature under ~5 texels, or it
  bakes to noise at mip 0 and flat grey one mip down ("sandpaper close up,
  featureless at 2 m").
- Macro variation at TWO scales (3-4 m and ~12 m) so long walls never read
  as one value end to end — directly relevant to monumental architecture.
- A photometric contract pinned in one file (1 intensity unit = 25,000
  lux) that every subsystem tunes against; the repo's worst unfixed bug
  (a light rig at ~20x irradiance) is exactly what this prevents.
- Procedural humanoid animation as local euler DELTAS in degrees on axes
  with fixed anatomical meaning (x flexion, y twist, z lateral), layered
  oscillators for breath/sway/micro-motion — "readable as anatomy rather
  than as quaternion soup," blendable by simple lerp of delta arrays.
- Synthesized audio with zero files: 7-layer gunshots; reverb as
  synthesized impulse responses (image-source early reflections + diffuse
  late field with frequency-dependent decay) fed to ConvolverNodes;
  round-robin timbre variants + per-shot jitter so no two sounds repeat.

---

## 4. Case study: the F1 film (f1-round2) — the verification doctrine

The project: @aipulseda1ly had Claude (Opus 5 primarily; the account
report also lists fable-5, sonnet-5, opus-4-8) build, over ~4 weeks and
26.0 billion tokens, the complete generator for a 124-second 4K film of an
F1 car — one unbroken camera take, zero cuts, rendered in Blender Cycles
on three rented RTX 5090s that the system procured itself through
middleware another Claude agent built (vast-render). Nothing downloaded,
nothing hand-sculpted, zero texture files, no AI-generated assets — every
surface, sound and motion is code. A separate browser scene (55.2M
triangles vs the film's 17.7B evaluated per frame) ships on the project
site with an assemble-itself showcase and a playable drive.

The receipts (from the site's ledgers): model $20,740.23 over 25 days;
GPUs $229.76 total ($0.49-0.68/GPU-hour); $169 per second of finished
film. Token anatomy: 96.2% cache reads, 3.4% cache writes, 0.36% output,
0.004% input — "for every token produced, 275 were read back." 7,609 of
10,954 frame records were 720p-or-smaller rehearsals (cheap-proxy
iteration before 4K). The author's flat verdict: "The 4K film was the
cheap part by 90x" — the thinking is the cost.

What makes this project generationally useful is not the film — it is the
**published engineering record**: `docs/DEFECT-LOG-R2.md` (1,295+ numbered
append-only entries, 67k lines), curated by `docs/READING-LIST.md` (60
entries, ten-minute list on top), and distilled into
`docs/BROKEN-INSTRUMENTS.md` — an essay on one failure class found 26
times in subsystems that share no code:

> "A guard, gate, metric or report returned the same answer whether the
> defect it existed to catch was present or absent."

### 4a. The seven mechanism families (Broken Instruments)

I.   **The instrument never opened the artifact.** Gates that read a
     database row, a source tree, or a re-synthesized proxy instead of the
     delivered thing. Three of eight audio gates never read the audio
     file; a two-second tape loop tiled 16.5x passed the whole suite. The
     flagship: a render farm delivered a *structurally perfect PNG* —
     right dimensions, valid signature, matching checksum — containing
     mean 0.0, std 0.0: an all-black image. "Every check it had verified
     that the file was intact. Nothing looked at the picture." Lesson:
     count what fraction of the artifact your checks actually touch, in
     the artifact's own units.
II.  **The metric's best score was a degenerate case.** A quality gate
     measuring the span between loud and quiet moments is maximized by
     silence; a tuning loop "walked downhill toward a better score and
     arrived" at an inaudible passage that outscored real ambience. All
     the gates were relative (ratios, spans, correlations): "Digital
     silence has excellent ratios." Harmless if nobody optimizes against
     it; "a guided missile aimed at your product if something does."
III. **Calibrated against the artifact it judges.** Thresholds set from
     the current master can only detect regression, while everyone
     believes they detect quality. The fix (called the most reusable thing
     in the corpus): every threshold is a frozen record with a provenance
     tag — physics, published, or control-derived — an audit rejects
     source=artifact by name, and "a threshold with no derivation note is
     itself a violation."
IV.  **The instrument's own arithmetic destroyed the reading.** A loudness
     limiter ran up to eight passes; the "worst reduction seen" variable
     was reassigned each pass instead of min-reduced, so it reported the
     LAST pass (-0.12 dB) instead of the first (-19.93). "Every iterative
     refinement loop has this shape — the last iteration is by
     construction the one with the least left to do — and the direction of
     the bug is always flattering." A false "REFUTED, clean" verdict read
     off that number was carried for weeks.
V.   **The instrument had no case to answer.** A check comparing a value
     minus itself against 1e9; gates green on zero-of-zero items tested; a
     negative control whose own header said a PASS invalidates everything
     above it, piped into `tail -12` for four film generations with its
     verdict discarded. "A detection that does not reach an exit code is a
     rumour."
VI.  **The verdict existed and nothing was wired to it.**
VII. **The instrument measured the wrong quantity.** An honest harmonic
     metric that did not move across two complete engine rebuilds — it was
     measuring a grandstand (86% crowd noise in the scored band). "A time
     series of your metric across releases is a free and extremely strong
     test of whether it measures what you think."

Synthesis: the failure was never sloppiness — the authors had written the
exact failure modes in docstrings adjacent to the defects. "The knowledge
was present and written down... What was missing was a mechanism that
could act on it. Prose is not a mechanism." Fixes that stuck converted
intention into things that execute.

### 4b. What actually caught the broken instruments (the seven practices)

None were caught by code review. The catchers, all cheap:

1. **Negative controls that must FAIL:** feed the gates silence, white
   noise, tiled loops, and (sharpest) the artifact's own spectrum
   re-synthesized as stationary noise — preserves every spectral statistic,
   destroys every event. Run the controls before believing the gate.
2. **Positive controls that must PASS, built from first principles**
   (physics, not the artifact). These exposed two metrics as inverted, not
   mis-thresholded.
3. **Mutation testing on the gates:** perturb each check one at a time and
   require exactly one failure — "answers 'do my gates work' in a way that
   'all tests pass' never can."
4. **Predictions recorded before measurement** (and negative results
   written up).
5. **Watch the fix fail:** run the new test against the pre-fix tree first
   and record the score.
6. **Never move a threshold to make an artifact pass.** The response
   ladder: fix the artifact → retire the instrument (with the measurement
   that retires it) → re-scope it → declare it open with a measured null →
   move the bar only with a recorded derivation. "The move that is never
   available is the one everybody reaches for first."
7. **Three verdicts, not two:** PASS / FAIL / UNMEASURED-VACUOUS, where
   "?" is never rendered as "ok". Closing law: "A check that cannot be
   evaluated must never be indistinguishable from one that passed."

### 4c. The human ear as the load-bearing instrument

The soundtrack was rebuilt five to seven times; every rebuild measured
better than the last on the gate suite; the client rejected every one by
ear and shipped the ORIGINAL. His blunt notes were precise diagnoses:
"sounds like a hair blower" identified the actual component (broadband
compressor-wheel noise; engine harmonics truncated at 1.9 kHz, turbo tones
ultrasonic). One rebuild "sounds like a shitty musical" because the gates
demanded periodicity + non-flat spectrum, and the cheapest way to satisfy
both is sustained pitched material — music. The project's stated
conclusion: "Any future pass should treat [rejection by ear] as the
primary evidence — not as a reason to try a sixth with the same
instruments." Also on record: "NOBODY HAS LISTENED TO THIS FILM, and no
agent here can" — a capability gap named plainly.

### 4d. Other durable specimens from the defect log

- **Inside-out geometry renders plausibly, not black.** The car's
  bodywork rendered as glass (and its aero as untextured clay) for all of
  beat 1; a deck shipped 18% upside-down. "Cycles flips a back-facing
  normal for diffuse... wrong, plausible, and invisible to any check
  looking for absence." Signed-volume checks are structurally blind to it.
  A repair drove the headline metric to 0.0 while the actual defect got
  worse. Found only by a pass that opened frames instead of reading
  reports.
- **A constraint authored the subject:** a cypress rendered as a bay
  laurel because the foliage unit was sized to fit the triangle budget —
  and all 25 selftests including negative controls passed.
- **Budget panic vs measured reality:** a vegetation tier was declared
  unbuildable while a 33M-triangle library was already shipping in the
  film. "The number called impossible was the number the world already
  carried."
- **Fixing one instance is not fixing the defect** — the identical bug sat
  four lines below a verified fix.
- **"When an argument has been corrected twice and is still on the same
  axis, the next move is an instrument, not a third argument... a
  confident wrong answer and a confident right one feel identical."**
- Multi-agent hygiene: `pkill -f` friendly fire three times in one day,
  each by an agent that had read the warning doc ("make the wrong thing
  unreachable, not merely documented"); an agent clobbering another's
  staging file; an agent fabricating a subagent report that happened to be
  true ("a fabricated provenance pointing at a true fact survives review...
  A report is an instrument too").

### 4e. The documentation system (conventions worth copying)

- **Append-only numbered defect log** (`R2-nnnn — one-line finding`); body
  = what was believed, what was measured, what it meant; often a
  `Generalises to:` law. Corrections are appended as new entries — both
  stay; "follow the chain forward." Parallel agents write to per-range
  staging files; a coordinator merges "by identity, never by position."
  A "next free number" header + reserved-range table prevents collisions;
  when two entries collide, the number external code cites keeps it.
- **READING-LIST.md** — curation as a first-class artifact: 60 entries
  with one-line rationales, ten-minute list on top; its line-number
  anchors are gated by a tool that exits 1 if any anchor has drifted.
- **THE-BRIEF (client brief as the judging standard):** opens with STEP
  ZERO — inventory reality before planning ("the plan adapts to the
  inventory, never the other way around"); one absolute LAW everything
  bends to; a measurable deliverable spec; a workflow section pre-encoding
  verification culture ("Never claim a step done from memory — every
  'done' is backed by a rendered frame or assembled clip you actually
  inspected"; "Merely fine is not done").
- **watch/INDEX.md** — a CURRENT vs SUPERSEDED table for every reviewable
  artifact, with cut timestamps and content hashes, written after the
  client twice judged stale files. "Everything in watch/ is a claim about
  the current film whether it was meant as one or not."
- **DOC-ACCURACY-AUDIT.md** — a periodic audit hunting one defect class:
  claims true when written and false now, and corrections that never
  propagated. Every finding settled against a non-document (hashes, file
  headers, live databases, `--help` output), never another summary.
- **Generated sources of truth:** beat sheet and circuit spec are
  generated from JSON + telemetry — "regenerate rather than hand-edit";
  one contract module owns every number two modules must agree on
  (world_contract.py: "RULE 1: if two modules need the same number, it is
  defined HERE and nowhere else"), after three incompatible ground datums
  broke the assembled world. Author and gate import ONE implementation of
  shared functions "because if they disagreed... the gate would be
  measuring the author's opinion instead of the film."
- Commit subjects state the finding, not the file ("beat 1 was 14 dB below
  the threshold of hearing, and every gate called it clean").

### 4f. vast-render (Apache-2.0) — the GPU-rental middleware

A local FastAPI+SQLite render broker that rents vast.ai GPUs, ships a
Blender scene, renders frame ranges, fetches results, "verifies that there
is actually a picture in them," and destroys the fleet when done. Hardened
against: stopped-but-billing instances ("destroy, never stop"), orphaned
instances (watchdog self-destruct on stale heartbeat + four independent
destroy paths), hosts that pass health probes with 14 KB/s downlink,
re-renting yesterday's bad host (fleet-wide blacklist, 7-day TTL), and
blank frames (every frame decoded and measured). Explicitly agent-facing
(`docs/agents.md`; `--agent` fair-share; `--zoom` region renders for
pixel-peeping). Campaign economics: $229.76 for 393.5 GPU-hours; 3.68
renders per delivered frame. Failure-mode gem: during a real 5-minute
network outage, a failed reconcile defaulted to safe — logged "assuming it
still exists" — and thereby did not destroy three healthy GPUs holding 7.7
hours of work. License-clean to adapt if we ever need farm-scale baking or
film renders.

---

## 5. Case study: Der Koloss v2 — the "slop to AAA" checklist

Rishi (@0xRishi) took an existing Three.js zombie game (built with Kimi K3)
and ran ONE Opus 5 transformation prompt over it — fork the directory,
keep map/gameplay/logic, redo everything visual — with screenshots of
Shumer's demo attached as the visual reference. First shot nailed the
overhaul; he then spent the rest of the session on craft ("sweating the
details/infusing personal taste judgement (aka craft) doesn't come for
free"). Characters were the weak spot ("it did NOT do a good job
overhauling the soldier models"). Repo: github.com/rishipr/der-koloss-ce
(MIT; assets mixed CC0/OFL/original).

His published "5 takeaways from vibecoded slop to AAA," with README
corroboration:

1. **The look lives in the pipeline, not the assets.** v2 changed no
   geometry — the frame stopped going straight to the screen: HDR buffer
   (RGBA16F, MSAA) → SAO → volumetric raymarch → bilateral blur → SSR →
   motion blur → DoF → separate viewmodel pass → bloom → composite
   (tonemap, grade, grain) → FXAA. "AO and bloom on primitive boxes beat a
   $200 asset pack rendered raw."
2. **Color is most of what people mean by cinematic.** Render linear into
   a float buffer, tonemap at the very END; AgX over ACES ("highlights
   desaturate toward white instead of clipping to a saturated hue");
   author ONE exposure baseline as an art decision.
3. **AAA is the absence of artifacts, not the presence of effects.** "The
   real AI-slop tell": shimmer — brick crawl at glancing angles, specular
   sparkle, shadow stair-step and swim, visible texture repeats. Fixes:
   snap shadow maps to their texel grid; fade normal maps by pixel
   footprint; widen roughness by normal variance (geometric specular AA);
   band-limit sources (blur height fields before deriving normals — a 32%
   shimmer reduction in their tests). "Spend a weekend hunting shimmer
   instead of adding one more effect."
4. **Looking incredible is not feeling right.** None of it screenshots:
   stride-locked view bob, mouse-lag sway, landing springs, breath; recoil
   as a separate spring from aim so it recovers to where you were aiming.
   (For a non-shooter: camera/locomotion feel deserves its own pass.)
5. **Sound is half your fidelity, and it's mostly timing.** Their guns
   felt weak because up to 60 ms of silence preceded each transient — an
   alignment problem, not volume. Then a deliberate loudness ladder (LUFS
   targets, top to bottom): blasts -15.5, announcer -17, stingers -17.5,
   voices -19, UI -20, foley -21, impacts -22, ambience -23, footsteps
   -25, hit-ticks -26. "Most indie and AI-made audio is individually fine
   and collectively mush because nobody set the hierarchy."

Other Der Koloss details worth keeping: all 320 SFX + voices from
ElevenLabs, then remediated by a local Python DSP pipeline (transient
alignment to sample 0, two-stage decay envelopes, designed layered
transients, true-peak ceiling) with a validation gate (`manifest.py`
measures the shipped files → `audio-loudness.json`; a validator enforces
it so regenerated files that drift off target are caught). Verification =
27 headless validator scripts asserting gameplay/rendering invariants
instead of unit tests. Separate viewmodel render pass let them move the
world near-plane 0.05 → 0.15 for 3x depth precision.

---

## 6. Community evidence and cost reality

- Repo velocity: Claude-of-Duty hit ~1,547 stars/253 forks in 3 days.
  47 games in the community directory, "every game... from the same
  three-paragraph prompt." ~60% FPS; winners lean browser-native, small
  builds, fully procedural assets, and named commercial comps (Mario Kart,
  Wind Waker, Crazy Taxi, Homeworld...) — clones of things with abundant
  reference imagery. The bar mechanism works best when reference imagery
  is plentiful.
- A walking-sim datapoint (closest genre to ours): @moridinamael got an
  O'Neill-cylinder walking sim — a goal he had attempted yearly since
  2016 — in ~3 hours, one shot.
- Cost datapoints: @markgadala's one-shot zombies FPS: ~$400 of API
  tokens, ~3 hours. @majidmanzarpour: 9+ hours of looping agents.
  Head-to-head (Gonçalo Canhoto): same prompt, Opus 5 High 2h57m vs Kimi
  K3 3h35m — "not even close," Opus won. The F1 project: $20,740/4 weeks
  at the far end. @aipulseda1ly runs TWO Claude Max 20x accounts and maxes
  both with four projects.
- Transformation-of-existing-code is proven (Der Koloss v1 → v2), not just
  greenfield — the more relevant mode for an existing engine.

## 6b. X sweep follow-up (2026-08-24)

The X half of the original research was owed and is now done — a sweep of
the same eight accounts, logged out, five days after the doc was written.
Anything already covered above is omitted; this is only what is NEW or
what changes a conclusion. Logged-out X shows roughly the five most recent
posts per profile and truncates reply threads, so treat this as a
recency skim, not an exhaustive read.

**The loop has left games, which matters for us.** Shumer posted a call
(Aug 21) for prompts modified for non-game work; the visible replies
include a browser paludarium (a living-terrarium sim), and one user who
pointed the loop at an existing mobile app and "had it catch like 40
bugs". @Ryancampbell used it on a fishing knowledge app (Aug 20) with no
game in sight. This is the first outside evidence that the loop's value
is the CRITIC-AND-MEASURE cycle rather than anything game-specific — which
is what GA-3 assumed when we pointed it at a world model rather than a
game, and the assumption now has company.

**Cross-model handoff is being used in the wild.** @Ryancampbell's
MoonBase One was started with Opus 5, then handed to Grok 4.6 to run
gauntlet-loop visual improvement passes for two days; he separately ran
a three.js FPS through Grok's Build CLI for ~25 hours / 15.6M tokens.
Unverified beyond his own posts, and no quality comparison is offered, so
treat as "people are doing it", not "it works better".

**Two operational cautions, both from @aipulseda1ly.**
1. (Aug 24) Opus 5 and Fable 5 were returning 529 overload errors and
   "errored out after the default 10 retries", which he notes defeats the
   point of leaving a loop running overnight or away from the desk. Any
   unattended Far Country loop needs to assume the run can die on
   provider overload and leave the tree mid-edit — our per-round commit
   discipline already covers this, and should stay.
2. (Aug 22) Grok 4.6 had been building one project for 92 hours,
   "iteration pass 502 on what it thinks a realistic zombie looks like…
   I keep telling it more realism. It keeps making it more cursed." This
   is the failure mode our doctrine already names — after two rounds on
   one axis the next move is an instrument, not a third argument — seen
   in the wild at pass 502. Worth keeping as the cautionary datapoint
   against "just let it run".

**Two tools worth tracking, neither adopted.**
- `kimodo.cpp` (announced Aug 22 via @jichiep, boosted by
  @majidmanzarpour): animate a skeleton by DESCRIBING the motion. If it
  holds up, it is a fourth candidate for the M4.4 worship-motion source
  alongside Quaternius CC0, NVIDIA ARDy, and pure procedural — and the
  only one that is text-driven. NOT evaluated: no licence check, no
  quality check, no look at whether it exports anything our rig can eat.
  Those are the gates before it goes near the roadmap.
- ThreeJS Super Terrain (vibe-stack.github.io/super-terrain, released
  ~Aug 23): mesh terrain with non-destructive CSG — diggable holes and
  caves. Not directly usable (we are WebGPU/TSL with our own clipmap, not
  three's mesh terrain) but it is the first public three.js terrain doing
  volumetric cuts, which is the one thing our heightfield structurally
  cannot express.

**Independent convergence on our own harness.** @majidmanzarpour (Aug 22)
described his setup as building "a multi-view visual harness page for
debugging in Chrome so the agent can" see its own output — arrived at
independently, and the same idea as `tools/shoot.ts` plus the round
contact sheets. Mild confirmation that agent-visible rendering is the
load-bearing piece, not a convenience.

**Scale datapoint.** @0xRishi's Modern Claudefare (Aug 3, predates this
doc but was not in it): 84,100 lines built with Opus 5 High Mode over a
few days on Gauntlet Loop principles, four Call of Duty map remakes, and
gamepad support added on request — he plays it on a TV over HDMI with a
wireless PS5 controller. Relevant twice over: it is a browser three.js
title at a scale comparable to ours, and it is prior art that
browser+gamepad+TV is a real delivery path (our own pad support is built
but hardware-unverified).

Nothing in this sweep changes a GA-3 conclusion or the instrument
doctrine in §4. Two accounts (@markgadala, @suriadesign) had nothing
method-relevant since Aug 19.

## 7. Tools inventory

- **workbench.md** — hosted, free, no account; agent-first Markdown docs
  (images/video/HTML) + Trello-style board + chat, designed as the live
  progress page / multi-agent coordination layer. Integration is one URL:
  "Read https://workbench.md/agents.md, create an HQ doc..., reply with
  the link." Caveat for us: an external hosted service — fine for progress
  pages, not for anything license-sensitive (ADR 0006).
- **Gauntlet prompt generator** — somethingbig.ai/gauntlet-loop/generator;
  free, email-gated; the article meta-prompt is the equivalent.
- **vast-render** — see 4f. Apache-2.0, adaptable.

## 8. Licensing summary

| Source | License | What we may do |
| --- | --- | --- |
| Claude-of-Duty | MIT | Read, quote, adapt code with notice |
| f1-round2 code | GPL-3.0-or-later | Learn from; do NOT vendor into our engine |
| f1-round2 docs | CC BY-SA 4.0 | Quote with attribution; share-alike applies to derivatives |
| The F1 film itself | All rights reserved | View only |
| vast-render | Apache-2.0 | Vendor/adapt with attribution |
| der-koloss-ce | MIT (code); assets mixed CC0/OFL/original | Read, adapt code with notice |
| Shumer articles/prompts | prompt.md is MIT via repo; articles ordinary copyright | Method freely usable; quote sparingly |

Unreproduced here by policy: nothing in these sources supplies content for
the heaven dataset. Everything above is process, tooling and rendering
craft; descriptor content still traces only to Scripture and Willis
(project non-negotiables 1-5).
