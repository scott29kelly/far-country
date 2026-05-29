# ADR 0011 — Population rendering policy (3D world)

- **Status:** Accepted
- **Date:** 2026-05-29
- **Supersedes:** —
- **Superseded by:** —

## Context

[ADR 0009](0009-symbolic-vs-literal-rendering.md) keys 3D rendering off the
dataset's `tier` system. [ADR 0010](0010-aniconic-policy.md) carves out an
absolute exception: **divine persons are never depicted in humanoid form**,
regardless of tier. Both ADRs explicitly left one question open. ADR 0009's
consequences note that "adding population (angels, the redeemed, the
twenty-four elders) is governed by rule (1)… the four living creatures of Rev
4:6–9 are the load-bearing test case." ADR 0010 rule 6 says it "does not
constrain… the depiction of *non-divine* persons — angels, the twenty-four
elders, the four living creatures, the redeemed, named humans… they are
governed by ADR 0009's tier rules and a future ADR (when population work
begins)."

This is that ADR. The roadmap's **M3.6 (Population)** is the first phase that
puts inhabitants in the scene, and the [Willis source doc](../sources/willis-new-jerusalem-model.md)
underlines that the New Jerusalem is "embodied and active… a governing capital,
not static bliss." An empty city under-renders the dataset: Scripture and Willis
both describe heaven as populated. But population forces the same kind of
commitment ADR 0010 flagged for the throne — a rendered person has a body, and
some of the dataset's "persons" are explicitly symbolic visions, not
photographable beings.

## Decision

Far Country adopts the following population-rendering policy for the 3D world:

1. **Figural non-divine persons are permitted.** Angels and the redeemed
   (resurrected saints, named humans, the nations who bring their glory in,
   Rev 21:24–26) **may** be rendered in human/figural form. This is the plain
   reading of a populated city (Rev 7:9; 21:24–26) and is consistent with ADR
   0009 rule 1 for `clear` descriptors.

2. **Divine persons remain aniconic — ADR 0010 controls absolutely.** No member
   of the Trinity, the one seated on the throne, or the Lamb is depicted in
   humanoid (or animal) form, in any population scene, regardless of how the
   surrounding figures are rendered. A worship scene shows the worshippers, not
   the object of worship (ADR 0010's working pattern: aniconic light + central
   focus). Reversing this requires a new ADR superseding 0010, not a population
   PR.

3. **Figural rendering is generic and reverent, not portraiture.** Non-divine
   figures are rendered as **stylised, generic, non-individualised** forms
   (silhouette/impressionistic crowds and presences) rather than detailed
   characters. Specifically excluded without a further decision: identifiable
   real individuals, faces of named biblical persons, and anything that would
   read as a portrait claim the dataset does not support. The redeemed are
   "a great multitude that no one could number" (Rev 7:9) — the rendering
   honours multitude and presence over individual likeness.

4. **Symbolic-tier beings are deferred to `RENDERING-DECISIONS.md`.** The **four
   living creatures** (Rev 4:6–9 / Ezek 1) and the **twenty-four elders** (Rev
   4:4) are `symbolic`-tier and sit in the apocalyptic-vision register. They are
   *not* divine persons (ADR 0010 rule 7 says so), so this ADR does not forbid
   them — but ADR 0009 rule 4 requires a documented `RENDERING-DECISIONS.md`
   entry before any such `debated`/`symbolic`-tier figure lands as geometry.
   They must render per ADR 0009 rule 2 (stylised, visibly unphysical, not
   photoreal multi-faced creatures) when their decision entry is written. Until
   then: **omit**.

5. **Every populated entity still maps to a descriptor.** Per
   [hermeneutics.md §8](../hermeneutics.md), the renderer does not invent
   inhabitants. Each figural presence in the scene traces to at least one cited
   descriptor (e.g. `angels-around-throne`, `bride-of-the-lamb`,
   `glory-and-honor-of-nations-brought-in`). No un-cited crowds, no
   extra-biblical imagery (no winged cherubs on clouds with harps — the
   CLAUDE.md pitfall).

6. **No extra-biblical activity is staged.** The dataset's "going in and out on
   assignment" / governing-capital dynamism (Willis; Rev 22:3 "his servants
   will worship him") may inform *motion and posture*, but specific invented
   narratives (named saints doing named tasks) are out of scope without a
   descriptor.

## Consequences

### Phase 3 (M3.6) implementation

- A first population pass may add stylised angelic presences near the throne
  summit and a multitude/nations presence near the gates, each anchored to an
  existing descriptor. The throne itself stays aniconic (ADR 0010); figures
  face/orient toward the summit light without the light resolving into a figure.
- The four living creatures and twenty-four elders are **not** rendered in the
  first pass. When they are wanted, a `RENDERING-DECISIONS.md` entry is written
  first (ADR 0009 rule 4) settling their stylised form.
- A code comment block at the top of any population component references this
  ADR and ADR 0010, the way `Throne.tsx` references ADR 0010.

### Future phases

- Worship scenes (Rev 5; Rev 7:9–12) render the assembly aniconically toward the
  centre. If a future phase wants the Bride imagery (Rev 19:7–9; 21:2, 9) as a
  figure, that is a fresh decision (ADR 0010 rule 6 flagged it as un-licensed by
  0010) and needs its own `RENDERING-DECISIONS.md` entry or ADR.

### Theological framing for readers

- The policy keeps the project's hard line exactly where ADR 0010 drew it (the
  Trinity) while letting the city be the inhabited, embodied place the dataset
  describes. Generic-figure rendering avoids two failure modes at once: an empty
  city that under-claims the text, and portrait-level figures that over-claim
  appearances Scripture does not give.

## References

- [`0005-hermeneutic-policy.md`](0005-hermeneutic-policy.md) — base hermeneutic
- [`0009-symbolic-vs-literal-rendering.md`](0009-symbolic-vs-literal-rendering.md) — tier-keyed rendering; rule 2 (symbolic), rule 4 (RENDERING-DECISIONS gate)
- [`0010-aniconic-policy.md`](0010-aniconic-policy.md) — divine-person aniconic lock this ADR explicitly does **not** relax
- [`../../RENDERING-DECISIONS.md`](../../RENDERING-DECISIONS.md) — where symbolic-tier beings (four living creatures, elders) get their per-figure decision
- [`../sources/willis-new-jerusalem-model.md`](../sources/willis-new-jerusalem-model.md) — embodied, active, governing-capital framing
- [`../roadmap.md`](../roadmap.md) — M3.6 Population
- Scripture: Rev 4:4, 4:6–9, 5:8–14, 7:9–12, 21:24–26, 22:3; Ezek 1
