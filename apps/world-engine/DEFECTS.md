# Engine defect log

Append-only, numbered. Entry format: `## FC-nnnn — one-line finding`, body =
what was believed, what was measured, what it turned out to mean, then
`Resolution:` when one lands. Corrections are APPENDED as new entries that
cite the old number — never edited in place; both stay; follow the chain
forward. STATUS.md stays the narrative; this file is the evidence trail.
Convention imported from the f1-round2 project's DEFECT-LOG-R2 (see
docs/research/2026-08-19-gauntlet-loop-and-agentic-build-methods.md §4e).

THE NEXT FREE NUMBER IS FC-0025.

## FC-0020 — FC-0012's open geometric half: the vertex displacement still sampled world XZ

Closes the OPEN RESIDUAL logged under FC-0012, which fixed the XZ-plane
collapse in the terrain SHADING but left the same flaw live in the vertex
micro-displacement (DISP table, TerrainTiles) and deferred it as
"collision-adjacent, needs care".

Two things were measured before touching it. First, the care warning is
unfounded as stated: ground physics reads `hf.heightAtCpu`, the
UNDISPLACED CPU field (TerrainScene.ts groundProbe), so the displacement
is purely visual and cannot move collision — changing its pattern at
constant amplitude leaves the existing by-design visual/physical offset
exactly as it was. Second, the residual is real but was invisible at the
cams anyone had been judging from: DISP fades out entirely past 85 m, and
at the standing falls/wall framings the face is >100 m away, where the
whole displacement contributes 0.4 luma (indistinguishable from nothing).
A camera set ON the rim (339, 415, 4432, looking east along the face)
puts the wall inside the fade, and there it contributes 16.7 luma of
local variation — all of it combed one way, reinforcing rather than
breaking up the streak.
A new `?ablate=disp` lever made that measurable. It is needed because the
neutral-clay view (`?ablate=mat`) recomputes its normals from the
undisplaced height buffer and so cannot show displacement at all — the
obvious instrument for "is this geometry or paint?" is blind to exactly
the thing in question.
Resolution (2026-08-21): the three displacement octaves take the same
wall parameterisation TerrainMaterial already uses — 45-degree horizontal
diagonal as abscissa, elevation as ordinate, blended by slope, with the
same (1,-1)-strike degeneracy fallback to XZ. Ground is bit-identical
(steepKd = 0 there). The wall ordinate keys off the UNDROPPED field
height, not the skirt-dropped one: a field keyed to the skirt drop would
differ between a skirt vert and the neighbouring tile's matching edge
vert and crack the displacement. Crack-free because detailP stays a pure
function of world position. Verified: battery ALL 18 PASS (walkfling,
wallcollide, cityfloors, templecollide, dwellingscollide, ascent all
green), no seams or LOD popping at the rim cam, relief reads lumpy and
cross-cut instead of combed.
NOTE the remaining streak is NOT this: the splat's own downslope
streaking still dominates that face and is partly deliberate (FC-0012's
degeneracy fallback documents XZ foreshortening there as "gravity-sorted
downslope talus streaking, which is the right look anyway"). Whether it
is too strong is an art call for Scott, not a defect.

## FC-0019 addendum — gamepad-live L9 is FLAKY, not a standing failure

FC-0019's resolution note recorded the battery as 17/18 with
gamepad-live check L9 ("guided capture records A/B/Y on standard
indices") failing, and reported it as pre-existing on the evidence that
it failed identically after `git stash` on pristine cc5a86e. The
pre-existing part stands. The characterisation does not: a later run on
the FC-0020 tree came back ALL 18 MEMBERS PASS, L9 included. So L9 is
INTERMITTENT — it is a timing-sensitive UI capture, and a red L9 is not
by itself evidence of a regression, nor is a green one evidence of a fix.
Re-run before drawing any conclusion from it.

## FC-0019 — the "grass rectangles" are contact-shadow SELF-intersection; FC-0018 was also wrong

Corrects FC-0018, which called the axis-aligned dark patches by the lone
tree at falls-e339 crown-shadow proxy BOXES and left "soften the proxy
shape" open as a Forests.ts task. That reading came from a single
`--ablate=casters` A/B whose difference was read as removal. Re-measured
(2026-08-21) at the same cam: the rectangles SURVIVE `--ablate casters`
unchanged — what casters removed was the lone tree's real, soft, organic
shadow sitting beside them. They also survive `--ablate proxy`, `--cov 0`
(clouds), `gi`, `canopygi`, `canopy`, `grass`, `shell`, `froxels`, `veg`
(ALL vegetation), and `mat` (neutral-clay terrain, no splat). They are
absent from a straight-down shot of the very same ground.

That last fact is the one that broke it open: the artifact is VIEW
dependent, so no world-space field or caster can be the cause. The
bisect ended at `--ablate ao`, which the code notes also drops contact
shadows; `--ablate contact` alone removes the rectangles completely.

Root cause: the screen-space contact-shadow march (PostStack.ts, 12
steps, ≤1.7 m toward the sun) accepted a hit whenever the depth-buffer
delta `dz` fell in a FIXED window (0.05, 1.4) m. At a grazing camera one
depth texel already spans metres of view depth, so across a wide band of
ground the march never leaves the surface it started on and the fixed
0.05 m floor cannot separate "an occluder is above me" from "this is my
own surface, one texel along". Whether the self-delta lands inside the
window depends on which texel the sample quantises to — a binary test on
a texel-quantised quantity — so the decision flips on and off along the
integer lattice and prints hard screen-axis-aligned rectangles. The
11.7-degree sun makes it worse: the march runs nearly parallel to the
ground, maximising the self-intersection band.
Resolution (2026-08-21): slope-scaled bias. Two-sided min-magnitude view
depth gradients (view metres per pixel, both axes) are measured once per
pixel, and the hit window floor becomes `1.4 × expected-self-delta +
0.05` over the screen distance the march has travelled — anything
shallower is the surface itself. Min-magnitude across the two sides
keeps a real silhouette from inflating the bias, so contact shadows
survive exactly where they matter. Measured over the artifact patch:
base sat 11.6 luma BELOW contact-off (the false darkening); the fix
recovers 9.9 of that and still sits 1.7 below contact-off, i.e. genuine
contact occlusion is intact (full-frame max local delta vs contact-off
155). Post-pass cost 0.79 ms vs 0.85 ms with contact ablated — inside
timing noise.
Generalises twice over. First: an ablation lever is only as specific as
its implementation — `ablate=ao` silently dropped TWO effects, and the
one that mattered was the one not named. Second, and this is the same
lesson FC-0014 taught in world space: a binary test on a quantised
quantity prints the quantisation grid. Both the fixed-window contact
test here and the floored same-texel guard in Gtao.ts are that shape.
The Gtao guard was NOT the cause (proven: the rectangles persist with
its sampling forced off AND with a constant AO normal) and was left
alone, but it is the same hazard and worth a look if lattice edges ever
show up in AO.

## FC-0017 — the far-vista shell chorded ABOVE the wild-ring canyon, rendering giant false wedges

Believed (round 2-3 critics): a "huge diagonal darkening / unlit polygon"
and "triangular blur smudges" on the band cliffs were shadows or haze
artifacts. Measured (GA-3 round 4, two independent ablation chains): the
wedges survive every weather/shadow/froxel ablation; magenta-painting
the far shell showed the whole wedge, its straight break line, AND the
valley-floor z-fight puddles are the far-vista RingGeometry (inner edge
~5855 m) — the falls/lake cams sit at radius ~6.1 km, INSIDE the ring's
annulus, and a ~230x194 m flat shell triangle chording across the
canyon's concave relief interpolates ABOVE the true surface (the flat
-9 m sink assumed convex-ish ground).
Resolution (2026-08-19): each interior shell vertex sinks to the MINIMUM
baked height over a 13-sample neighborhood covering its triangle span,
minus 14 m, faded by edgeBlend so the beyond-the-edge vista is
bit-identical (TerrainTiles.ts). No chord can ride above terrain its
endpoints sampled. Verified: wedge and streak-veils gone at the falls/
lake cams, no seam gap at the aerial or valley cams, GPU median neutral
to slightly faster. OPEN RESIDUAL: the honest fix is clipping the ring
to the square detail domain (~40% of ring triangles now waste vertices
underground in the corners).

## FC-0018 — the "grass rectangles" are crown-shadow proxy boxes; the round-3 diagnosis was wrong

Corrects the round-3 reading logged in docs/DELTA.md item 16(c) ("a
splat/moisture/zone-mask sampling artifact") — that diagnosis ablated
weather and the terrain proxy but never the VEGETATION caster list.
Measured (GA-3 round 4): ?ablate=casters removes the axis-aligned dark
patches by the lone tree at falls-e339; they are the crown-shadow proxy
POOL BOXES (Forests.ts CROWN_SHADOW_DENSITY) casting blocky ground
shadows. Related true fix landed in passing: biomeTex is NEAREST-
filtered (its header wrongly said LINEAR — corrected) and its fetch uv
is now fbm-warped so 3 m texel class edges dissolve.
OPEN: softening/shaping the crown proxy boxes is a vegetation-caster
task (Forests.ts owner); a second contributor may remain at forest
edges. Generalises to: "proven not X" is only as good as the ablation
list — enumerate every caster class before ruling shadows out.

## FC-0014 — the terrain shadow proxy cast kilometre-scale false shadows on the rim face

Believed: the big straight-edged diagonal darkening across the rim wall
in falls stills was "a cloud shadow" (round-2 reading) or "an unlit
polygon" (round-2 critic). Measured (GA-3 round 3, ablation bisect with
A/B shots): it survives --cov 0 (not clouds) and disappears with
--ablate proxy alone. Root cause: ShadowProxy is a fixed 512-square grid
— 8 m quads in the 4 km demo world it was written for, but 24 m quads on
New Jerusalem's 12288 m domain; its coarse triangulated mesa lip stands
metres sunward of the real cliff, so the whole face behind it fails the
depth compare, with perfectly straight triangle-edge boundaries.
Resolution (2026-08-19): each proxy vertex eroded to the minimum height
over its quad neighborhood, so the proxy sits at-or-below the real
surface between samples; error direction honest (shadows recede by at
most one quad). Verified by A/B; legitimate bench shading and long
terrain shadows remain. Full GRID rescaling rejected on cascade raster
cost (~4x).

## FC-0015 — crown shadow proxies flattened all foliage to one dark green at the low sun

Believed: tree crowns lacked hue/value variance (two critics: "identical
dark-green cauliflower clusters"); the per-instance variance machinery
was assumed missing or unwired. Measured (GA-3 round 3): the machinery
was intact (species hueVar 0.22-0.34, per-card jitter, per-instance
tints); but the crown shadow PROXIES — solid dithered ellipsoids at
74-92% density inside every crown — mean that at the 11.7-degree sun
every foliage fragment sits behind some proxy along the sun ray. The
cascades report 60-90% occlusion across whole crowns; direct sun never
reached a leaf, and ambient-only shading collapsed every species to one
value. Proven by ?ablate=casters A/B (variance appears with zero
material changes). Generalises to: a caster placed INSIDE the thing it
shadows will always shadow the thing itself at grazing sun.
Resolution (2026-08-19): receivedShadowNode relief on sun-facing crown
shells (VegMaterials.foliageSunShadowRelief, mirrored in the impostor
runtime) — the outermost leaf along the sun ray is lit by definition;
shade shells and ground shadows untouched.

## FC-0016 — the water clipmap never covered the band: distant ponds rendered as bare bed

Believed: the aerial cam's "matte-black inkblot ponds" were a shading
failure (round-2 critic: "no sky term"). Measured (GA-3 round 3,
waterdbg=4 forced-emissive probe): the ponds stayed black under forced
water emissive — there was NO water fragment there. The water surface
clipmap's outermost level spanned +/-3.07 km around the camera; the
plateau ponds sat 3-5 km out and were bare dark bed terrain. A shading
argument about pixels that are not water.
Resolution (2026-08-19): a 7th clipmap level (96 m cells, +/-6.14 km =
the full NJ domain, ~32k tris), plus an analytic far-level wet gate on
waterY minus ground (the buried dry-sheet sentinel poked through
terraced terrain at 4 km where screen-depth z precision cannot reject
it). Turbidity in-scatter rescaled (the old coefficients scaled zenith
radiance where downwelling irradiance is the physical quantity, ~2.2x).
KNOWN LIMIT (by design, documented in the round-3 water report): narrow
river channels past ~400 m have no water surface at any clipmap level
(min-reduction drops them deliberately); their distant read is wet-bed
terrain paint — a terrain-owner wish, not a water bug.

## FC-0012 — terrain detail octaves collapse to vertical fibers on walls (XZ-plane sampling)

Believed: the rock material had macro/meso/micro octaves per its header
law, so walls were "textured". Measured (GA-3 rounds 0-1, two independent
blind critics): every wall-dominant frame reads as "straw thatch / shag
carpet — fine vertical hair-like strokes at a single constant scale";
confirmed in code (round 2): every detail term (meso fbm, micro value
noise, all bump gradients) samples the world XZ plane, so on a
near-vertical face the pattern is constant along y and every octave
degenerates into the same vertical striping. The octaves existed; the
parameterization erased them exactly where rock shows most.
Resolution (2026-08-19, GA-3 round 2): steep faces sample detail in a
wall plane (45-degree horizontal diagonal x elevation) blended by slope,
with gradients mapped through a matching helper (TerrainMaterial.ts).
OPEN RESIDUAL: the vertex micro-displacement (DISP table, TerrainTiles)
has the same XZ-column flaw — geometric wall grain is still vertical
grooves; logged for a later round since it moves collision-adjacent
geometry.

## FC-0013 — the rim falls ribbons never reached their plunge pools

Believed: RimFalls ribbons ran lip to pool (LIVE-VERIFIED at the M-era
rim shots). Measured (GA-3 round 2): the rim face steps outward ~170 m
over its ~260 m drop; the VERTICAL ribbon sheet stood at mid-face with
its whole lower half buried inside the benches — every fall visibly
ended at the first bench, and the plunge-pool churn sat unfed. The
round-1 stills show it plainly once looked for; two critics called the
falls "glass rectangles" without knowing half the sheet was underground.
Meaning: the old verification was made against a steeper rim profile;
the canyonlands re-profile (2026-08-17) changed the face geometry and
nothing re-checked ribbon-vs-face intersection.
Resolution (2026-08-19, GA-3 round 2): sheets lean along the benched
face (YXZ euler from lip crest to pool edge) — same mesh, no new
geometry; pool churn concentrates at the landing point (RimFalls.ts
`impact`). Shading rebuilt in the same round (rope lanes, additive
aeration, ragged margins, impact band — CrystalWater.ts).

## FC-0011 — a vertical seam splits the sky at exact screen centre in wilderness stills

Believed: the five canonical wild-ring stills were clean (Scott picked the
canyonlands variant from them). Measured (GA-3 round 0, 2026-08-19): the
gate cam's sky carries a hard vertical value step at x ≈ 960 of 1920 —
exact half-width — visible from y ≈ 200 to the horizon; column-mean
luminance over rows 100-450 steps ~4/255 across two columns where the
local gradient is ~0.5/255 per column. The SAME seam sits in the approved
v3-gate.png from the 2026-08-17 pick review, so it predates GA-3 and was
shipped in the approved look. The round-0 blind critic named it
independently ("a hard vertical seam splits the sky"). Meaning: some
screen-space pass has a half-width boundary (half-res cloud/froxel RTT or
similar) leaking a tile edge into the composite. Owned by the GA-3
atmosphere pass (round 1).
Resolution (2026-08-19, GA-3 round 1): NOT a screen-space tile edge — a
WORLD-space seam that happens to project onto screen centre. The cloud
march tiles its baked 3D noises with fract(worldPos/period) (base 3600 m,
detail 420 m), but the mx worley/perlin bakes are not periodic, so every
world plane x or z = k·period carries a hard density step; the gate cam
sits at x = 0 with yaw exactly π, putting the x = 0 seam plane on the
exact centre column. Proven by bisect: ablate=clouds dropped the step
8.2 → 0.5/255 (cloudflat=1 likewise). Fixed in Clouds.ts: 8-corner
low-edge crossfade makes both bakes exactly periodic (bake-time only,
zero march cost) + RepeatWrapping on the noise samplers (clamp-to-edge
kept a one-texel residual ~3/255). Post-fix gate capture: max centre-column
step 1.9/255 inside cloud texture whose off-centre variation is 1.1-3.3/255
— no step distinguishable from cloud content; clean-sky band 0.9/255.

## FC-0001 — GA-1 census: 56 tools audited; the fleet measured well but could not fail well

Believed: "13/13 probes PASS" (2026-08-18) meant the battery could have
caught the defects it exists for. Measured (full audit:
tools/AUDIT-2026-08-19.md): 54 .ts + 2 .html tools; threshold provenance
~25 imported / ~20 derivation-commented / ~45 bare-or-mirror literals / 1
measured-from-scene (probe-framings PLAZA_Y 483.85, fixture-grade); zero
family-IV aggregation bugs; but the four worst instruments below. The
2026-08-18 verification itself was sound — a human read wildwater's
printout against the design record — but the READING was the instrument,
not the probe.

## FC-0002 — probe-wildwater had no failure path at all

The sole hydrology gate (battery member, billed "safety check") printed a
report and exited 0 in every state; with the __laasDbg heightfield hook
missing it printed empty tables and still exited 0. A flooded plateau, a
drained lake, and a broken probe were indistinguishable from healthy.
Resolution (2026-08-19): W1-W8 verdicts added — generic invariants (dry
flat core/approach, 11 m depth ceiling) on every variant/seed; designed
canyonlands end state (spawn pond, west lake level, three dolines, no
unexplained pocket) on the default; hook-missing = UNMEASURED exit 2.
Expected values are a provenance-tagged design record in the probe (see
its DESIGN comment); they cannot be imported because the depths are
emergent hydrology outcomes, not authored constants.

## FC-0003 — `npm run battery` pointed at a file that never existed

package.json declared `"battery": "tsx tools/battery.ts"`; no such file in
the working tree or anywhere in git history. Battery membership lived in
prose and session memory — a member silently dropped from an ad-hoc run
list kept "ALL PASS" green (suite-level family V).
Resolution (2026-08-19): tools/battery.ts written — explicit 17-member
manifest (the 2026-08-18 thirteen + four standing CPU contract probes),
one-at-a-time execution, MISSING counted as failure, exit 2 counted as
UNMEASURED never pass, unreachable :5173 reported not skipped. Add
probe-rimfalls to the manifest when the verify branch merges.

## FC-0004 — shoot.ts and cityshots.ts never decoded a pixel they captured

`page.screenshot({ path })` straight to disk; an all-black, all-white or
flat frame passed with exit 0 and "[shoot] wrote ...". The F1 project
shipped exactly this failure from its render farm; our GPU history (Code
43, createBuffer boot failures) makes it live here.
Resolution (2026-08-19): tools/framegate.ts — sharp-decoded mean/stdev
bounds (conservative physical limits, provenance in the file header),
SUSPECT rename on failure, SHOOT_ALLOW_BLANK=1 bypass for deliberately
empty captures. Wired into shoot.ts (exit 1) and cityshots.ts (per-framing,
sheet still written, exit 1 if any suspect). The gate was watched refusing
before being believed: tools/framegate-selftest.ts feeds it synthetic
black/white/flat/noise frames and requires REJECT/REJECT/REJECT/ACCEPT
(run: npx tsx tools/framegate-selftest.ts; verified 2026-08-19).

## FC-0005 — no UNMEASURED verdict existed anywhere; zero checks printed ALL PASS

check.ts finish() printed "[probe] ALL PASS" on an empty failures array
even when nothing had been measured. Concrete vacuous-pass paths found:
probe-visualkey A1-A4/B1/C1 on an empty marker+registry set; probe-crowd
E5's `continue`-skip; probe-entitypick section C on zero vols; find-water's
silent empty on a missing hook.
Resolution (2026-08-19, partial): check.ts now counts checks, adds
unmeasured(), prints "ALL PASS (N checks)", and exits 2 when nothing ran
or anything was unmeasurable; battery refuses to count exit 2 as pass.
OPEN: the probes with inline PASS/FAIL printing (most of the fleet) still
need migrating to makeChecker or given their own minimum-check floors;
the four vacuous paths above are the priority.

## FC-0006 — probe-bootui computed its verdict and threw it away

The overlay-dismissed evaluation was console.logged only; a rite that
never dismisses exited 0.
Resolution (2026-08-19): !gone now exits 1.

## FC-0007 — ~45 bare/mirror threshold literals can drift one-sided

Worst: probe-wallcollide's hand-derived face constants 103.4/88/60.5;
NJ_SCALE hardcoded as `20` in probe-entitypick B4/B5 (the import exists in
the same file); GROUND_Y 470 mirrored in six files; gamepad/navigation
rate tables mirroring FlyCamera/GamepadInput as unlabeled contract pins.
OPEN. Fix shape: import where an export exists; label deliberate contract
pins as such; derivation comment for the rest. Full inventory in
tools/AUDIT-2026-08-19.md.

## FC-0008 — probe-resize passes on the absence of a foreign string

Fails only if a console error contains 'Destroyed texture' (Dawn's
wording); a Dawn reword disarms it silently. Mitigating record: it was
watched failing pre-fix (STATUS 2026-07-18). OPEN. Cheap hardening: assert
the console listener saw >0 messages per run, or an --expect-fail
self-test mode.

## FC-0009 — the mutation battery has never been run

No probe has ever been observed refusing: "if you have never provoked a
refusal you have never observed the guard at all." A per-probe seed list
of cheapest deliberate breakages (with predictions to record BEFORE
running) is in tools/AUDIT-2026-08-19.md. OPEN — needs a quiet dev-server
window (deliberate scene breakage would hot-reload into any open tab);
scheduled with Scott.
Resolution (2026-08-24): run. Predictions pre-registered in a separate commit
before the first mutation; full ledger in tools/MUTATION-2026-08-24.md.
Baseline 18/18 PASS, tree verified clean after every mutation. 15 of 18
members caught their deliberate break. Three did not: probe-mousesteer
(FC-0021), probe-entitypick (FC-0022) and probe-rimfalls (FC-0023). One
prediction was importantly wrong — probe-wildwater was predicted unfailable
per audit finding F1 and instead failed W3/W6/W8, so F1 is STALE and the seed
list in AUDIT-2026-08-19.md needs that correction. Method finding: FC-0024.

## FC-0010 — the four FC-0005 vacuous-pass paths are closed

Closes the OPEN tail of FC-0005 (the four concrete paths; the fleet-wide
makeChecker migration remains a background chore, not a known defect).
What landed (2026-08-19):
- probe-visualkey: empty markers or vols now hits unmeasured() and exits 2
  before any A/B/C check can pass on nothing; finish({ minChecks: 8 })
  floors the roster (8 = A1-A4 + B1-B3 + C1).
- probe-crowd E5: the `if (!f) continue` name-mismatch skip now counts
  matches and fails E5 itself when matched !== V — its verdict no longer
  leans on E2 happening to catch the same mismatch.
- probe-entitypick: empty registry hits unmeasured() exit 2 before section
  C can run zero checks; finish({ minChecks: 31 }) floors the roster
  (31 = A4 + B15 + N6 + D5 + at least one C slug row).
- find-water: a missing __laasDbg.engine.heightfield hook now returns null
  from the page and exits 2 with an UNMEASURED line; a genuine zero-
  candidate scan prints an explicit empty-result line and exits 0. A broken
  probe and a dry world are no longer the same output.
Verified healthy: `npm run battery` ALL 17 PASS after the change;
probe-visualkey standalone ALL PASS (8 checks); find-water on newjerusalem
printed the explicit empty-result line (hook present, scan ran).
Observed refusing (safe here: these CPU probes import THIS worktree's src,
the dev server serves a different worktree — no hot-reload risk):
- keyMarkers mutated to return [] → visualkey UNMEASURED exit 2;
- buildEntityPicks mutated to return [] → entitypick UNMEASURED exit 2;
- 'adult-tall' renamed → E5 FAILs on its own ("only 5/6 archetypes
  matched"), no longer sheltered by E2.
All mutations reverted. NOT yet observed: find-water's hook-missing exit 2
(needs a live page without the hook — folded into the FC-0009 battery).
Noted in passing: find-water's scan window is ±2040 m, so on newjerusalem
it cannot see the wilderness-band water at z 4400-6144 — a coverage
limitation of the report tool, not a verdict bug.

## FC-0021 — probe-mousesteer cannot tell up from down: every steer check is relative

Found by the FC-0009 mutation battery (tools/MUTATION-2026-08-24.md, #16).
Believed: probe-mousesteer verifies the mouse-steer navigation, and its own
header says step 4 is "pitch must ease UPWARD (opposite sign of a bottom
hold)". Measured: inverting the pitch sign at FlyCamera.ts:545
(`this.pitch -= steerResponse(...)` → `+=`) flipped both measured deltas —
`dPitchTop +1.0191 → -1.1796`, `dPitchBottom -1.1796 → +1.1689` — and the
probe still printed ALL PASS. The mutation demonstrably reached the running
page (the numbers moved), so this is not a stale-bundle artifact; the same
batch's #15 edit to GamepadInput.ts was picked up by Vite the same way.
Means: all three steer checks assert magnitude and RELATIVE opposition only.
Right-edge is `Math.abs(dYawR) > 0.05`; left-edge asserts the opposite sign
*to the right hold*; pitch asserts top and bottom oppose *each other*. Invert
both yaw signs, both pitch signs, or both axes together and the probe stays
green. The probe verifies the controls respond and are not stuck together; it
never verifies which way is up. The header asserts an absolute the code never
checks — the same "title claims more than the assertion" shape as FC-0022.
Weight: inverted mouse-look is one of the most user-visible control
regressions there is, and it is squarely against the standing preference for
approachable, non-gamer navigation. OPEN as found; fixed same day.
Resolution (2026-08-24): all three steer checks now pin ABSOLUTE sign —
cursor right → dYaw < 0, left → dYaw > 0, top → dPitch > 0, bottom →
dPitch < 0 — with the convention's provenance quoted in the header (design:
"view eases toward the cursor"; FlyCamera.ts applies `-=` on both
screen-normalised axes; pitch > 0 = up per probe-gamepad B3). Watched
refusing both ways: the pitch flip that beat the old probe now fails the
pitch check (dPitchTop -1.17), and a yaw flip fails both yaw checks
(dYawR +1.75). Green on correct code (dYawR -1.99, dPitchTop +1.01).

## FC-0022 — probe-entitypick mirror-pins the twelve foundation gems against the table it is checking

Found by the FC-0009 mutation battery (tools/MUTATION-2026-08-24.md, #13).
Believed: probe-entitypick check A2 is named "foundation course: gate-notched
spans, twelve gems in ESV order" and was expected to catch a wrong gem.
Measured: renaming the first gem in `cityModel.FOUNDATION_GEMS` to `ZZTMP`
left all 14 CPU members PASS, and A2 itself passed while printing
`first=Foundation · ZZTMP`. Means: A2's third clause is
`gemLabelOrder.every((l, i) => l === 'Foundation · ' + FOUNDATION_GEMS[i].name)`
— it compares the scene labels against the very table the mutation edited, so
both sides of the assertion move together. This is audit finding F6 (the
mirror-pin / self-referential pair) landing on a doctrinal invariant: nothing
in the probe knows the ESV order of Rev 21:19-20, and "ESV order" is whatever
cityModel.ts happens to say today. Note the probe is not inert — the same run
(#5) showed entitypick B1 correctly failing when the gate notch was deleted.
The gap is specific to the gem NAMES. OPEN as found; fixed same day.
Resolution (2026-08-24): the probe now carries ESV_FOUNDATION_ORDER, the
twelve names transcribed from Rev 21:19-20 (ESV) as an independent anchor.
A2 checks the scene labels against it, and a new A2b checks the engine
FOUNDATION_GEMS table against it directly, so a table edit fails with the
table printed. Watched refusing: the ZZTMP rename that stayed green in the
mutation run now fails A2 and A2b. Green on the correct table (45 checks).

## FC-0023 — probe-rimfalls replays its own copy of the scanner and never executes RimFalls.ts

Found by the FC-0009 mutation battery (tools/MUTATION-2026-08-24.md, #18/18b/
18c). The most severe instrument finding of the run, and a correction to the
assumption behind adding rimfalls to the battery at all (see the manifest note
in tools/battery.ts, 2026-08-19).
Believed: probe-rimfalls audits the emergent rim-fall site set produced by
`findRimFallSites()` in src/nj/RimFalls.ts.
Measured, in three steps. (a) `CLUSTER_M` 260 → 130 produced output
BYTE-IDENTICAL to baseline — same three lips, same scores 28.6/5.4/2.3, same
drops. Scored void, not blind: a mutation that changes no behaviour tests
nothing. (b) `MAX_SITES` 4 → 2 also changed nothing, which is impossible if
the probe read that constant. (c) `findRimFallSites()` gutted to `return []`
— the shipped scanner emits NOTHING and every waterfall disappears from the
world — and the probe still reported "3 emergent site(s)" with R1, R2 and R3
all PASS.
Means: at probe-rimfalls.ts:94-97 the probe declares its OWN `MAX_SITES = 4`
and `CLUSTER_M = 260` under the comment "exact mirrors of RimFalls.ts
constants", then at :115 runs an "exact replay of findRimFallSites" inside
`page.evaluate`. It never calls the shipped function. This is FC-0007's
mirror-literal hazard escalated from a mirrored THRESHOLD to a mirrored
IMPLEMENTATION.
Important qualification: the probe is not worthless. It was built to answer
"after a terrain change near the rim, WHERE did the falls land?" and it still
does that honestly, because it runs against the live CPU hydrology mirrors.
It guards the TERRAIN. It does not guard the CODE, which is what its battery
membership implies. OPEN as found; fixed same day.
Resolution (2026-08-24): stronger than the fix proposed above — instead of
re-invoking the function, NewJerusalemScene now exposes the site set it
ACTUALLY built (`__laasDbg.rimFalls = { emergent, sites }`) at the
buildRimFalls call, and the probe reads that. The replayed scan is deleted;
the only mirror left is the +60 m pool offset, report-only. A new R0 check
asserts the sites came from the emergent scan, not the anchor fallback.
Watched refusing: findRimFallSites gutted to `return []` now fails R0
("anchor fallback engaged"), R1 (got 2 anchor sites) and all three R2 rows.
Green on correct code with numbers identical to the old replay's (-1305 /
339 / -3561, drops 245.9/244.1/252.3) — the mirror had been faithful; it
just was not the shipped code path. Engine src changed → bundle re-vendored
in the same commit.

## FC-0024 — a mutation is not valid until the probe's output is shown to move

Method finding from the FC-0009 run, logged so the next mutation battery does
not repeat it. Mutation #18 passed a careful pre-flight (the sed was verified
to land its replacement text in the file) and still tested nothing, because
halving `CLUSTER_M` happened not to change any cluster: the three sites sit
~1600 m apart, far outside either lattice. A "the edit landed" check proves
the FILE changed; it does not prove BEHAVIOUR changed. Had #18b and #18c not
been run out of suspicion, FC-0023 would have been recorded as "rimfalls
CAUGHT" — the exact opposite of the truth.
Rule, joining the two already in this file (an ablation lever is only as
specific as its implementation; a binary test on a quantised quantity prints
the quantisation grid): **before scoring a mutation, diff the probe's own
output against baseline. Identical output means the mutation is void, not
that the probe is blind — and a probe cannot be credited with catching
anything until something moved.**

## FC-0025 — probe-gamepad-live only presents axes at 0 or ±1, so the deadzone is invisible to it

Found by the cross-coverage debt left open in the FC-0009 run
(tools/MUTATION-2026-08-24.md: "#14 gamepad was run CPU-only"). Pre-registered
2026-08-27 in the same ledger, prediction BLIND — confirmed by run.
Believed: gamepad-live proves the browser-side gamepad seam, so a zeroed
radial deadzone (`GamepadInput.ts PAD_DEADZONE 0.15 → 0`) should fail it the
way it failed the CPU member (A, C2).
Measured: with the deadzone zeroed, all 14 live checks PASS, output
numerically indistinguishable from baseline (L3 21.5 vs 21.6 m; L4 Δyaw 1.20
vs 1.21 rad). The mutation was NOT a no-op (FC-0024 rule): the CPU member,
run inside the same mutation window, failed A and C2 exactly as in run #14.
Means: every live stimulus is an axis at exactly 0 or ±1, and `shapeStick()`
is deadzone-invariant at both magnitudes — at mag 0 it returns zero under any
deadzone, and at mag 1 the normalised t is 1 for every deadzone < 1. The
deadzone exists ONLY for partial deflections (resting-pad drift, analog
fractions), and the live probe never presented one. Same shape as FC-0021:
the suite's own description ("proves the browser-side seam") claims a
property the stimulus set cannot reach.
Weight: a lost deadzone means every idle controller on a desk slowly flies
the camera — squarely against the approachable-navigation preference — and
the live layer would have shipped it green.
Resolution (2026-08-27): new live check L15 — present drift-level axes
[0.1, 0.1, 0.1, 0.1] (per-stick mag 0.14, under the 0.15 deadzone) for ~1 s
and assert the pose holds exactly still (< 0.05 m, < 0.01 rad; clean runs
measure 0.000 m because the shaped input is exactly zero). Threshold
provenance in the probe comment. Watched refusing: with the deadzone zeroed,
L15 fails at 3.065 m drift (predicted ~3.4 m from mag 0.14 × 24 m/s) and is
the only failure. Green on correct code, full live suite 15/15.

## FC-0026 — probe-resize's sentinel rests on one engine handler: Dawn's own logging is a console WARNING

Found while closing FC-0008 (the sentinel-drift hazard): the first run of the
new sentinel self-test FAILED on correct code, which was the instrument
working. Believed: a destroyed-texture submit surfaces as a console ERROR
containing Dawn's "Destroyed texture", which is what probe-resize listened
for (`message.type() === 'error'`). Measured (scratch device, no handler,
this Chromium): Dawn's default logging for an uncaptured error arrives as
console type **warning** — `[console:warning] Destroyed texture [Texture
(unlabeled 4x4 px, ...)] used in a submit.` The only reason the probe ever
caught the real regression is Engine.ts's `onuncapturederror` handler, which
re-logs the message via console.error — and that handler stops after 8
errors. So the probe's armed state silently depended on one engine-side
handler staying present and the error count staying under its cap; remove
the handler (or overflow it) and a real resize regression prints warnings
the probe ignores. This is FC-0008's predicted failure mode arriving via
the message TYPE instead of the wording.
Resolution (2026-08-27): two changes to probe-resize, verified both ways.
(1) The listener now accepts the sentinel at console type error OR warning,
so both surfacing paths (engine re-log, Dawn default) are covered. (2) Every
run ends with a sentinel self-test: provoke a real destroyed-texture submit
on a scratch device with NO handler — the weakest path — and refuse the
whole run if the listener did not catch it, so a future Dawn reword or type
change fails loudly instead of disarming silently. Watched refusing: with
the sentinel changed to a string Dawn never says, the self-test exits 1.
Green on correct code: resize PASS + "Dawn still says 'Destroyed texture'".

## FC-0027 — FC-0017's residual closed: the far ring is clipped to the square detail domain, and the "~40%" was wrong

Closes the OPEN RESIDUAL recorded in FC-0017. Believed (FC-0017's own
text): ~40% of ring triangles waste vertices underground in the corners.
Measured (three.js RingGeometry rebuilt with the shipped parameters and the
shipped filter): 556 of 13,440 triangles — 4.1%. The estimate was recorded
without measurement, against the instrument doctrine; corrected here rather
than edited in place.
The fix (TerrainTiles.ts, build-time): drop a ring triangle only when ALL
THREE vertices sit at Chebyshev norm max(|x|,|z|) < 0.94·WORLD_HALF. That
region is convex, so vertices-inside implies the whole footprint is inside;
edgeBlend there is exactly 0 (the blend starts at 0.95), which puts every
dropped vertex on the min-baked-minus-14-m branch — guaranteed under the
detail tiles. The seam band that hugs the terrain from below keeps a
~61 m margin, and the vista beyond the world edge keeps every triangle.
XZ footprints are fixed (the shader displaces vertices only vertically),
so the CPU-side test is exact.
Verified: aerial A/B (the framing that sees the shell and world edge)
0.16% changed pixels, mean max-channel delta 0.79 — noise; falls A/B diff
concentrated entirely on animated content (waterfall spray, wind-swayed
crowns, crowd), terrain and horizon black. Full battery 18/18 after the
change. Honest weight: this is hygiene plus saved per-vertex work (13
height samples + macro fbm evaluations per shaded ring vertex), not a
frame-rate win — the 556 triangles are noise against an 18M-triangle
frame.
