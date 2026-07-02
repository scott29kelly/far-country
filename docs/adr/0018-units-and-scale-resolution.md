# ADR 0018 — Units and scale resolution: literal-cubit temple, viewable-scale city

- **Status:** Accepted (2026-07-02)
- **Relates to:** [ADR 0017](0017-scripture-as-grounding-data.md) (measurements
  as grounding data — this ADR is its resolver), [ADR 0014](0014-citywide-scale-rendering.md)
  (citywide viewable scale — unchanged by this ADR), [ADR 0009](0009-symbolic-vs-literal-rendering.md)
  (rule 6 placeholder geography)
- **Origin:** plan §4 answer f (Scott, 2026-07-02): "temple = literal-grounded;
  city = grounded-form + interpreted-scale. Split confirmed."

## Context

Measurement records store text-native units (ADR 0017). Rendering needs
meters. The realization is contested at two levels: the **unit** (Ezekiel's
long cubit = "a cubit and a handbreadth," Ezek 40:5 — the ESV's own note
glosses it "about 21 inches or 53 centimeters"; Revelation's stadion ≈ 185 m)
and the **arithmetic** (Willis reads Rev 21:16's 12,000 stadia as the *area*
of the base → ~12 mi/side; the mainstream reads it linearly → ~1,380 mi/side).
The numbers are exact in the text; their metric realization is a decision to
document.

## Decision

1. **The Ezekiel long cubit is fixed at `LONG_CUBIT_M = 0.525`.** This sits
   inside the ESV note's "about 21 in / 53 cm" and matches the common royal-
   cubit scholarship (~52.5 cm); the spread between candidate values is under
   2% and moves nothing visually. Derived units follow the text: **reed = 6
   long cubits** (Ezek 40:5); **span ≈ 0.43 long cubit** (ESV notes: ~9 in vs
   ~21 in). Where Ezekiel 40–48 says "cubit" without qualification, the long
   cubit of 40:5 governs (it is the vision's own declared standard; so also
   43:13).

2. **The temple renders at literal scale: 1 long cubit = 0.525 m, ×1.** The
   Ezek 40–42 complex is ~500 cubits ≈ 262 m square — small enough to view
   and walk whole. No interpretive scale factor applies. Its *dimensions* are
   grounded; only its *placement* in the compressed allotment geography
   remains placeholder (ADR 0009 rule 6, ADR 0015).

3. **The city keeps ADR 0014's viewable scale.** The New Jerusalem remains
   grounded-form + interpreted-scale (`NJ_SCALE = 20`, ~2.5 mi). This ADR
   builds on 0014 and does not modify it. The deliberate consequence: the
   literal-scale temple is dwarfed by the interpreted-scale city — an honest
   picture of the two regimes, not a bug. If the disparity is ever judged
   distracting, the remedy is revisiting ADR 0014, never inflating the
   temple's cited dimensions.

4. **The resolver is code with one authority.** `LONG_CUBIT_M` and the
   unit-to-cubit table live once, beside the generated measurement module the
   engine consumes (ADR 0017 decision 3). Alternative city readings (Willis
   area vs mainstream linear) remain expressible as future resolver modes
   without touching the dataset.

## Consequences

- Every temple dimension in meters is reproducible: `value(unit→cubits) ×
  0.525`. Reviewers check cubits against the ESV text, not meters.
- Heights Ezekiel does not give (the house elevation, gatehouse height, step
  risers) are *not* manufactured as measurements — they are interpretive
  render choices logged in `RENDERING-DECISIONS.md`.
- Rev 21 city records (12,000 stadia; 144 cubits) stay in the dataset under
  their existing tiers; nothing at city scale changes until the Phase B
  config work consumes them through a declared resolver mode.
