# Engine defect log

Append-only, numbered. Entry format: `## FC-nnnn — one-line finding`, body =
what was believed, what was measured, what it turned out to mean, then
`Resolution:` when one lands. Corrections are APPENDED as new entries that
cite the old number — never edited in place; both stay; follow the chain
forward. STATUS.md stays the narrative; this file is the evidence trail.
Convention imported from the f1-round2 project's DEFECT-LOG-R2 (see
docs/research/2026-08-19-gauntlet-loop-and-agentic-build-methods.md §4e).

THE NEXT FREE NUMBER IS FC-0019.

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
