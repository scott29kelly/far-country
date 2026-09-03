# M4.4 worship-curve fit against kimodo.cpp reference clips

Date: 2026-09-03. Status: tier A values APPLIED to `figureModel.ts` the same
day on Scott's go-ahead after the close-up review; tier B items remain
open. This note holds the evidence and the numbers.

Context: the M4.4 source call (2026-08-31) keeps procedural worship
motion as the runtime and uses kimodo.cpp (SOMA RP v1.1, NVIDIA Open
Model License) clips as the authoring reference only. The crowd figure
has no skeleton. Its worship motion is three authored curves in
`apps/world-engine/src/nj/figureModel.ts` (`WORSHIP` constants plus the
`WORSHIP_KEYS` keyframe tables) evaluated in the vertex shader. This
note measures the reference clips in the same units and compares.

## 1. Method

Tools (all in `apps/world-engine/tools/`, run from that folder):

- `kimodo-metrics.ts` loads a clip GLB, samples the skeleton 150 times,
  and prints torso pitch (hips to chest, radians off vertical), neck
  pitch, hip drop as a fraction of standing height, arm elevation and
  lateral hip sway. The standing reference is the tallest sample, not
  the first, because some seeds start the clip already in the pose.
  The last sample stops a hair short of the clip end, because sampling
  exactly at the end wraps the looping mixer back to frame 0.
- `kimodo-shape.ts` normalizes each channel to 0..1 and prints onset,
  ramp, hold and release as fractions of the clip, plus a 21-point
  profile. This is the shape language of `WORSHIP_KEYS`.
- `kimodo-frames.ts` screenshots the clip through `glbview.html` on the
  dev server at fixed times.

Clip matrix (all SOMA RP v1.1, 150 frames at 30 fps = 4.97 s, 100
steps; gitignored under `apps/world-engine/shots/wip/kimodo/`):

| Clip | Seed | Prompt intent | Result |
| --- | --- | --- | --- |
| bow-deep-seed7 | 7 | deep bow, hold, straighten | full bow-hold-rise |
| bow-half-seed3 | 3 | bow "about halfway", pause, straighten | full bow, same depth as deep |
| bow-half-seed11 | 11 | same wording | full bow, same depth |
| bow-respect-seed21 | 21 | "slow respectful bow" | full bow, same depth |
| kneel-prayer-seed7 | 7 | kneel and pray | stand to sit-on-heels kneel, hands to prayer |
| kneel-rise-seed3 | 3 | kneel, stay, stand back up | full down-hold-up cycle |
| walk-kneel-seed7 | 7 | walk 3 s, then kneel + bow head | kneel then prostration-deep bow |
| kneel-upright-seed3 | 3 | lower to knees, back upright, hands on thighs | static sit-on-heels pose for the whole clip |
| kneel-upright-seed11 | 11 | same wording | static sit-on-heels pose |
| kneel-headdown-seed21 | 21 | kneel upright, head slightly lowered | static upright kneel (thighs vertical) |
| hands-lifted-seed7/3/11 | 7, 3, 11 | raise both arms overhead, hold, look up | lift then hold |
| sway-arms-raised-seed7 | 7 | arms raised, sway side to side | arms raised, small sway |
| sway-raised-seed3/11 | 3, 11 | arms raised, sway very slightly | arms stayed DOWN, sway present |

Wording did not move the bow depth: "halfway" and "respectful" produced
the same 60-degree bow as "deeply". The model has a strong bow prior.
Kneel wording did change the pose: "back upright, hands on thighs" gave
a sit-on-heels pose, "kneel upright" gave a thighs-vertical kneel, and
"kneel and pray" landed between. Two kneel prompts came out as a static
pose with no descent, so the standing reference had to become the
tallest sample.

## 2. Measurements

Standing hips (SOMA root joint) sit at 0.65 of figure height in every
standing clip, so hip drops below are hips-to-hips.

Bow (torso pitch above standing, radians):

| Clip | Peak bow | Extra neck flex at peak | Descent (10 to 90%) | Hold above 90% | Rise (90 to 10%) |
| --- | --- | --- | --- | --- | --- |
| bow-deep-seed7 | 1.05 (60 deg) | +0.63 | 1.1 s | 1.2 s | 1.5 s |
| bow-half-seed3 | 0.99 (57 deg) | +0.64 | 0.95 s | 1.2 s | 1.25 s |
| bow-half-seed11 | 1.05 (60 deg) | +0.71 | 0.9 s | 0.5 s | 1.5 s |
| bow-respect-seed21 | 1.05 (60 deg) | +0.66 | 1.0 s | 0.5 s | 1.0 s |

The shape is one smooth arc: down, short hold, up, with the rise about
1.3 times slower than the descent. There is no partial-bow plateau after
the hold. The head always hangs further than the torso (the neck adds
about 0.6 rad on top of the torso pitch).

Kneel (hip drop as a fraction of standing height):

| Clip | Hip drop | Head drop | Note |
| --- | --- | --- | --- |
| kneel-headdown-seed21 (upright kneel, thighs vertical) | 0.33 | 0.39 | static pose |
| kneel-rise-seed3 | 0.38 | - | full cycle |
| kneel-prayer-seed7 | 0.43 | - | settles at 0.93 of peak |
| walk-kneel-seed7 | 0.45 peak, 0.34 settled | - | knees land, then the body settles |
| kneel-upright-seed3/11 (sit on heels) | 0.49 | 0.48 | static pose |

Kneel timing from the clips that move: descent 0.55 to 0.65 s, a small
overshoot when the knees land (peak, then settle to 0.93 to 0.96), a
short "gather" lift just before rising, and a rise of about 0.75 s (1.2
times the descent). Kneelers also bow a little (11 to 15 degrees of
torso) and drop the head (0.9 to 1.0 rad of neck).

Arm lift (hands overhead): elevation reaches 66 to 85 degrees above
horizontal in 0.5 to 1.2 s, then holds at 0.94 to 0.96 of the peak for
the rest of the clip. One lift, one hold, no dip.

Idle head (standing clips): neck pitch wander 0.04 to 0.07 rad.

Body sway (standing clips): hips move laterally by 3 to 5 cm each way
with a 3.6 to 4.8 s period (about 1.3 to 1.75 rad/s).

## 3. Comparison with the runtime constants

| Channel | Runtime now | Reference | Verdict |
| --- | --- | --- | --- |
| bow depth `bowAmp` | 0.30 rad (17 deg), invariant cap 0.45 | 1.0 to 1.09 rad (57 to 62 deg) | reference is a deep bow, far past the reverent cap |
| bow shape `WORSHIP_KEYS.bow` | ramp 0.14-0.24, hold to 0.30, fall to a 0.35 plateau held until 0.70, release by 0.90 | one arc, rise 1.3x slower than descent, no plateau | plateau has no counterpart in any clip |
| kneel depth `kneelDrop` | 0.26 H | 0.33 H upright kneel, 0.38-0.45 kneel-and-pray, 0.49 sit on heels | runtime is shallower than any reference kneel |
| kneel shape `WORSHIP_KEYS.kneel` | ramp 0.26-0.40, hold to 0.72, rise 0.72-0.84 | fast descent, landing settle, gather beat, rise 1.2x descent | shape close; descent slower than rise in the runtime, reversed in life |
| arm shape `WORSHIP_KEYS.arm` | two humps (peak 0.35, dip to 0.4 at 0.55, peak 0.70) | one lift, settle to 0.95, hold | the dip has no counterpart |
| arm amplitude `armAmp` | 0.07 rad extra on an already-raised arm | absolute pose 66-85 deg | not comparable; leave |
| head idle `HEAD_IDLE.pitchAmp` | 0.05 rad | 0.04-0.07 rad | matches; leave |
| head idle `yawAmp` | 0.07 rad | not measured (no yaw channel) | leave |
| bow head coupling | head rides the torso rigidly | neck adds 0.6 rad per bow | missing feature |
| kneeler bow | same `bowAmp` as standers | kneelers bow 11-15 deg, standers 60 | at 0.30 rad the runtime matches the KNEELER, not the stander |
| body sway (`populationModel.SWAY`) | 2 to 4.5 cm at the robe crown, 0.9 rad/s | 3 to 5 cm at the hips, 1.3 to 1.75 rad/s | reference sways wider and faster; out of this fit's scope |

Period: the clips are life-speed (a whole bow in 2.5 to 3.5 s). The
runtime cycles run 36 to 64 s by design (unhurried, no drill team).
This fit keeps the periods and only proposes SHAPES and DEPTHS. Whether
the crowd should move at life speed is a separate call for Scott.

## 4. Proposed values (tier A: within the existing shader and guards)

```ts
bowAmp: 0.45,     // was 0.30; the invariant cap, still far under the 1.05 reference
kneelDrop: 0.34,  // was 0.26; the upright thighs-vertical kneel (0.33 H)

const WORSHIP_KEYS = {
  bow: [[0, 0], [0.14, 0], [0.25, 1], [0.33, 1], [0.47, 0], [1, 0]],
  kneel: [[0, 0], [0.26, 0], [0.33, 1], [0.36, 0.94], [0.7, 0.94], [0.72, 1], [0.81, 0], [1, 0]],
  arm: [[0, 0], [0.2, 0], [0.3, 1], [0.34, 0.94], [0.75, 0.94], [0.88, 0], [1, 0]],
};
```

What each change does, in plain words:

- Bow: one smooth arc instead of bow-then-half-bow. Going down takes 11%
  of the cycle, the hold 8%, coming up 14% (1.3x the descent, as in
  every clip). The figure then stands still for the rest of the cycle.
- Kneel: the drop is faster than the rise, the knees "land" (a 6%
  settle), and the body gathers slightly before standing. Depth goes
  from 0.26 to 0.34 of height, the upright kneel. The robe below the hip
  line compresses to 29% of its height at full kneel (was 46%); the
  hem still stays planted.
- Arm: one lift, a small settle, a long hold, one lower. No mid-cycle dip.

All values pass `figureModelInvariants` as written (closure at both
ends, 0..1 range, bowAmp <= 0.45, kneelDrop < hipT 0.48, band order).

Rendered A/B at the crowd annex framing (`?shot=10`, frozen clock, both
images pose-deterministic): `shots/wip/kimodo/fit/current-shot10.png`,
`proposed-shot10.png`, and the crop sheet `ab-crops.png` (gitignored).
2.4% of pixels change; the visible differences are deeper kneelers and
a higher frond arm on the bowers.

Because a frozen clock leaves most figures between poses, a second pair
was rendered with every channel pinned at 1 (every kneel-mode figure at
full kneel, every bow-mode figure at full bow) so the two DEPTHS can be
judged directly: `peak-current-shot10.png`, `peak-proposed-shot10.png`
and the crop sheet `peak-ab-crops.png`. The curve tables were restored
after the render; nothing in the repo changed.
At the crowd-annex distance the depth change reads as subtle: the
kneelers sit visibly lower and the bowers fold further, but a near
framing on one kneeler and one bower shows it better, so one was added:
`tools/kimodo-closeup.ts` reads the engine's resolved shot-10 pose, finds
a kneel-mode figure and a bow-mode figure standing about a metre apart
by that spot (slots 5006 and 5001), and prints a camera three metres
away at a 1.3 m eye height. `--front` stands on the far side, because
the figures face the summit and the shot-10 side sees their backs.
Renders (peak pose, gitignored): `closeup-front-current.png`,
`closeup-front-proposed.png` and the stacked sheet `closeup-front-ab.png`,
plus the same from behind without the `front` infix. Camera used:
`496.57,485.15,1822.06,0.166,-0.165,50`. In the proposed set the kneeler's
head sits a full head lower and the bower folds visibly further; both
still read as reverent, not collapsed.

## 5. Tier B: needs new shader constants (Scott's call first)

1. Bow-coupled head drop. Every bow clip flexes the neck about 0.6 rad
   beyond the torso. The runtime head rides the torso rigidly. A
   `bowNeckFactor` (extra head pitch per radian of bow, applied through
   the existing HEAD_IDLE blend band) would add it. Small shader change
   in `Crowd.ts`.
2. Kneelers bow less than standers. Reference: 11 to 15 degrees kneeling
   versus 60 standing. A `kneelBowScale` (about 0.35) applied when the
   slot is in kneel mode. One multiply in `Crowd.ts`.
3. A deeper kneel variant. 0.43 to 0.49 H (kneel-and-pray, sit on heels)
   is what the model produces most often. With the current single
   compression line it would squash the lower robe to 10 to 15% of its
   height; likely wants a second kneel profile rather than a bigger
   number. Not proposed now.
4. Bow depth beyond 0.45 rad. The reference is 1.05 rad. The invariant
   cap and the code comment ("a deliberate bow, not a collapse") were a
   design choice. Raising the cap is a look decision, not a fit result.

## 6. Open items

- Scott's eye on the A/B crop sheet and the tier A numbers.
- Life-speed versus unhurried periods (section 3).
- Sway width and speed live in `populationModel.SWAY`, outside this fit;
  the reference numbers are recorded above for the pending jitter call.
