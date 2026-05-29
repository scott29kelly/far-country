# Spec — Phase 4: Millennial-Kingdom surroundings

**Status:** Stub (filled out at the start of Phase 4)
**Phase:** 4

This spec is a placeholder. Its purpose right now is to record the goals, what we already know, and the open questions to resolve before implementation. Phase 4 exists because of the eschatological pivot in [`../adr/0012-eschatological-framing-premillennial.md`](../adr/0012-eschatological-framing-premillennial.md): under the prior amillennial framing these features were out of scope; premillennial New Creationism puts the millennial *setting* around the New Jerusalem on the roadmap. See [`../roadmap.md`](../roadmap.md) Phase 4.

---

## Goals

1. Render the premillennial *setting* the New Jerusalem descends onto — the millennial earth — in the same `/world` scene, additively (the Phase-3 city is not rebuilt).
2. Keep every feature procedurally traceable to a reviewed descriptor; no hand-built geometry untraceable to a citation, and no invented millennial geography.
3. Make the millennial features legibly distinct from the eternal city already built — especially the two rivers (see M4.3) — so the scene does not conflate the millennial and eternal phases.
4. Honour the framing's hard constraints: divine persons remain aniconic ([ADR 0010](../adr/0010-aniconic-policy.md)); symbolic-tier features render per [ADR 0009](../adr/0009-symbolic-vs-literal-rendering.md); `debated` features get a `RENDERING-DECISIONS.md` entry before geometry lands.

---

## Scope (the four roadmap milestones)

- **M4.1 — Ezekiel 40–48 temple complex.** The literal future millennial temple, **distinct from and adjacent to** the city (Rev 21:22 — no temple inside the New Jerusalem; Ezek 48:10 priestly allotment). Outer/inner courts, gates, sanctuary, per Ezekiel's measurements.
- **M4.2 — Holy Allotment + tribal geography.** The Ezekiel 48 land division — holy district, prince's portion, twelve tribal strips — as legible macro-landscape.
- **M4.3 — Ezekiel 47 healing river.** The river issuing **from the temple** (Ezek 47:1–12), flowing east, healing the waters, trees on its banks. A **second, distinct** water feature from the Rev 22:1 city river already built (which cascades from the summit throne).
- **M4.4 — Mortal nations + pilgrimage dynamism.** Mortal nations alongside resurrected saints; the open gates (Rev 21:25) in their premillennial meaning — nations bring glory in (Rev 21:24–26), pilgrimage to worship (Zech 14:16). Figural non-divine persons per [ADR 0011](../adr/0011-population-rendering-policy.md).

---

## What we already know

- Stack: the existing React Three Fiber `/world` scene (`apps/web/src/lib/world/`). Phase 4 extends it; no new app.
- The Phase-3 city (terraced pyramid, summit aniconic throne, gem foundations, Ezekiel-48 gate order, single Rev 22:1 river) is framework-portable and unaffected by the pivot — see [`../../RENDERING-DECISIONS.md`](../../RENDERING-DECISIONS.md) entry #1.
- Willis harmonizes Ezekiel's city/temple with John's New Jerusalem and treats the temple district as adjacent ("Washington D.C." analogy) — see [`../sources/willis-new-jerusalem-model.md`](../sources/willis-new-jerusalem-model.md).
- Scale stays the deferred ~200m placeholder convention (ADR 0009 rule 6) until a deliberate scale decision; the temple/allotment must sit in the same scale system as the city.

---

## Dependencies

- **Descriptors must exist first.** Phase 4 assumes the relevant passages (Ezek 40–48, Ezek 47:1–12, Zech 14:16, Isa 2:2–4, Rev 21:24–26) have been extracted and reviewed (Phase 1) under the **premillennial rubric of ADR 0012**, which inverts ADR 0008's polarity (a literal Ezekiel temple, first resurrection, and intermediate state are now *approvable*). Until the dataset reconciliation lands, Phase 4 has nothing grounded to render.

---

## Open questions

- Adjacency geometry — where does the temple district sit relative to the pyramid city, and at what bearing? (Ezek 48 places the sanctuary in the holy district; the in-scene layout is a rendering decision.)
- The two rivers — how to make the Ezek 47 temple river and the Rev 22:1 throne river read as *distinct* (different source, course, color/treatment) without visual clutter.
- Millennial sacrifices (Ezek 40–46) — memorial vs. other function is `debated`-tier; do we represent the altar/offerings at all, and if so how, per ADR 0009 rule 4 + a `RENDERING-DECISIONS.md` entry?
- Mortal-nations depiction — static figures vs. animated pilgrimage; how to distinguish mortal nations from resurrected saints visually (if at all).
- Whether Phase 4 needs a `millennial` `temporal_phase` value in the dataset (see [`../data-model.md`](../data-model.md) §`descriptor.temporal_phase`) to filter what belongs to the millennial scene.

---

## Done-when

To be defined at the start of Phase 4. Working sketch: a user can walk out from the New Jerusalem into a recognizable millennial landscape — adjacent temple, tribal land division, the healing river distinct from the city river — with every major feature sourced.

---

## References

- [`../adr/0012-eschatological-framing-premillennial.md`](../adr/0012-eschatological-framing-premillennial.md)
- [`../roadmap.md`](../roadmap.md) Phase 4
- [`../sources/willis-new-jerusalem-model.md`](../sources/willis-new-jerusalem-model.md)
- [`../adr/0009-symbolic-vs-literal-rendering.md`](../adr/0009-symbolic-vs-literal-rendering.md), [`../adr/0010-aniconic-policy.md`](../adr/0010-aniconic-policy.md), [`../adr/0011-population-rendering-policy.md`](../adr/0011-population-rendering-policy.md)
- [`../../RENDERING-DECISIONS.md`](../../RENDERING-DECISIONS.md)
