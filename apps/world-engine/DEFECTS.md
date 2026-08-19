# Engine defect log

Append-only, numbered. Entry format: `## FC-nnnn — one-line finding`, body =
what was believed, what was measured, what it turned out to mean, then
`Resolution:` when one lands. Corrections are APPENDED as new entries that
cite the old number — never edited in place; both stay; follow the chain
forward. STATUS.md stays the narrative; this file is the evidence trail.
Convention imported from the f1-round2 project's DEFECT-LOG-R2 (see
docs/research/2026-08-19-gauntlet-loop-and-agentic-build-methods.md §4e).

THE NEXT FREE NUMBER IS FC-0010.

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
