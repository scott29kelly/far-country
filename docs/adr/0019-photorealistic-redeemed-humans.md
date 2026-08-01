# ADR 0019 — Photorealistic rendering of the redeemed (supersedes ADR 0011 rule 3 for human beings)

- **Status:** Accepted
- **Date:** 2026-08-01
- **Supersedes:** [ADR 0011](0011-population-rendering-policy.md) rule 3, **for
  redeemed human beings only**. All other rules of ADR 0011 remain in force.
- **Superseded by:** —

## Context

ADR 0011 rule 3 required all non-divine figures — angels and the redeemed
alike — to be rendered as stylised, generic, non-individualised forms. Under
that rule the great multitude (Rev 7:9) currently renders as ~12,700 abstract
white-robed placeholder figures (cone-and-sphere primitives).

On 2026-08-01 Scott reviewed the render and directed that the great multitude
be made **photorealistic human beings**, on this textual ground: the multitude
is explicitly identified as *human*. When John is asked "who are these,
clothed in white robes, and from where have they come?", the elder answers,
"These are the ones coming out of the great tribulation. They have washed
their robes and made them white in the blood of the Lamb" (Rev 7:13–14, ESV).
They are people — redeemed human beings with real bodies (1 Cor 15, which this
project's hermeneutic reads literally; see CLAUDE.md "Don't collapse the
literal either"). Rendering humans as visibly unhuman abstractions
under-claims what the text plainly says they are.

The stylisation rule was written to guard against two things: portrait claims
Scripture does not make, and any drift toward depicting the divine. Those
guards do not require abstraction — they require anonymity and the ADR 0010
line. A photorealistic *generic* person makes no portrait claim.

## Decision

1. **The redeemed may be rendered as photorealistic human beings.** Realistic
   bodies, faces, skin, hair, and clothing are permitted for the great
   multitude (Rev 7:9) and other cited human presences (e.g. the nations and
   kings of Rev 21:24–26), at whatever fidelity the engine can achieve.

2. **Generic, not portraits — this guard survives from ADR 0011.** No figure
   may carry the likeness of an identifiable real person, living or historical.
   No face is presented as a *named* biblical individual (no "this one is
   Peter"). Faces are synthetic, varied, and anonymous — a crowd of real-looking
   people, none of whom is anyone in particular. "A great multitude that no one
   could number, from every nation, from all tribes and peoples and languages"
   (Rev 7:9) is rendered as exactly that: visibly diverse in ethnicity, age,
   and build.

3. **Cited wardrobe details are kept.** White robes and palm branches in their
   hands (Rev 7:9) remain the multitude's rendered dress.

4. **Divine persons remain absolutely aniconic.** ADR 0010 is untouched. No
   member of the Trinity is depicted in any form, photoreal or otherwise. The
   worship scene shows the worshippers, never the object of worship.

5. **Angels are NOT covered by this ADR.** Scott's direction concerned the
   human multitude. The angelic hosts keep their current settled rendering
   (abstract light pillars, RENDERING-DECISIONS #3) unless a future decision
   changes it. Symbolic-tier beings (four living creatures, twenty-four
   elders) remain gated exactly as ADR 0011 rule 4 left them.

6. **Every rendered presence still traces to a cited descriptor** (ADR 0011
   rule 5) and **no extra-biblical activity is staged** (ADR 0011 rule 6).
   Both rules are unchanged.

## Consequences

- The M3.6 population pass is re-scoped from "convincing anonymous robed
  crowd, stylised" to "photorealistic anonymous human crowd." This is a large
  rendering-engineering task: real human meshes, face/skin/hair/cloth
  materials, animation, and crowd-scale level-of-detail for ~12,700 figures.
  It needs GPU review at every step; CPU probes cannot judge it.
- The roadmap's M3.6 fidelity note (2026-07-31), which restated ADR 0011
  rule 3 as the bound, is corrected to point here.
- Any future request to render a *named* person's face, or a real individual's
  likeness, still requires a fresh decision — this ADR does not license it.

## References

- [`0010-aniconic-policy.md`](0010-aniconic-policy.md) — divine-person lock, untouched
- [`0011-population-rendering-policy.md`](0011-population-rendering-policy.md) — the policy this partially supersedes
- Scripture: Rev 7:9–17 (esp. 7:13–14, the elder's identification of the
  multitude as redeemed humans); Rev 21:24–26; 1 Cor 15 (bodily resurrection)
- Scott's directive, 2026-08-01 (session record)
