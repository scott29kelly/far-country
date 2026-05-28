# ADR 0009 — Symbolic-vs-literal rendering policy (3D world)

- **Status:** Accepted
- **Date:** 2026-05-28
- **Supersedes:** —
- **Superseded by:** —

## Context

ADR 0005 locked the project to a conservative-Protestant, literal-where-possible hermeneutic. ADR 0008 narrowed the eschatological framing to Reformed amillennialism. The dataset's `tier` enum (`clear | fuzzy | debated | symbolic`) and the `symbolic_referent` field on each `descriptor` operationalize the hermeneutic for *text*: every descriptor declares whether its statement is read plainly or as signalling something else.

Phase 3 introduces a new surface — the 3D world at `/world` — where the dataset is made *visible*. Geometry forces commitments that text and citations do not. Three things become true the moment a descriptor is rendered:

1. **Form is committed.** A jasper wall is rendered as a single colour, a finite thickness, a specific surface roughness. The reader sees one realisation of "the wall was built of jasper" (Rev 21:18), not the descriptor abstractly.
2. **Symbolism is at risk.** If a `symbolic` descriptor is rendered identically to a `clear` descriptor, the symbolic frame collapses. Streets of pure gold (Rev 21:21) rendered as literal metallurgy quietly answers an interpretive question the dataset deliberately leaves open ("the referent is purity / value / glory, not the metal").
3. **Absence is also a claim.** Choosing *not* to render something a passage states ("there will be no sea", "the leaves of the tree of life are for the healing of the nations") is a positive theological act, not a neutral omission.

Without a policy, the Phase 3 implementer (currently the AI agent, ultimately the project itself) will silently pick a rendering for each descriptor based on what is graphically convenient. That picks the interpretation by accident.

## Decision

Far Country adopts the following rendering policy, keyed off the existing tier system:

1. **`clear` descriptors may be rendered literally.** A descriptor passing the reviewer rubric as `clear` reflects a plain reading of the source. The 3D world may depict it as the text states — within the constraints of the other rules below — without further interpretive choice. Example: the city has gates (Rev 21:12) → render gates.

2. **`symbolic` descriptors are rendered in a way that signals symbolism, not in a way that asserts the symbol's literal physical referent.** The descriptor's `symbolic_referent` field must inform the rendering choice. Concretely:
   - The rendering must read visually as *significant*, not as ordinary materiality — e.g., gold ground may be saturated, luminous, faintly self-emitting, not photoreal yellow metal.
   - The rendering must avoid asserting causally implausible literalism — e.g., walls built of "jasper" are rendered as a stylised pale-blue luminous stone, not as a photoreal mineralogical jasper sample.
   - Where the symbolic referent is **stated by the text itself** (e.g., the lampstands of Rev 1:20 are explicitly identified as the seven churches), the rendering may *encode the referent* — not as label text, but as the visual choice (lampstand-as-assembly, not lampstand-as-furniture).
   - It is acceptable to render a `symbolic` descriptor *as the symbol* (gold streets, pearl gates) as long as the visual treatment carries the "this is the figure used in the vision, not a claim about heavenly metallurgy" reading. The MVP's saturated, glowing, slightly-unphysical gold floor is the reference implementation of this case.

3. **`fuzzy` descriptors are rendered conservatively or omitted.** If included, they must be visually *quiet* — secondary, atmospheric, or in the periphery — never as the main visual subject. A fuzzy descriptor must not anchor a Point of Interest with a HUD card that surfaces it as authoritative. (HUD wiring may still surface a `fuzzy` descriptor when it is the *only* descriptor near the camera; the card's tier badge already discloses the confidence.)

4. **`debated` descriptors are not rendered in the 3D world without a documented decision.** When a descriptor is `debated` and is a candidate for rendering, an entry must be added to a per-phase `RENDERING-DECISIONS.md` (Phase-3 onward) recording which side the project rendered and why. The default for an undecided `debated` descriptor is to omit. This is stricter than the text-side handling because geometry cannot footnote itself.

5. **Aniconic constraints override the above.** Where ADR 0010 prohibits rendering — specifically, depictions of divine persons — that prohibition is absolute regardless of tier. A `clear` descriptor of God or the Lamb does not authorise depicting them in humanoid form. ADR 0010 controls.

6. **Scale is treated as deliberately not-literal in the MVP.** The Phase 3 MVP renders the city at a ~200m placeholder scale rather than the 12,000-stadia (~2,400 km) measurement of Rev 21:16. This is a *known* non-literal rendering of a `clear` descriptor and is recorded here for transparency. A future ADR may revisit true-scale or symbolic-scale rendering; until then the placeholder scale is the working convention. The rendering must not *contradict* the literal measurement (no signage claiming "200m city") — it just elects not to honour the literal value pending a deliberate decision.

7. **The HUD already discloses tier.** Every descriptor card in the world's HUD shows its tier badge (`CLEAR / SYMBOLIC / FUZZY / DEBATED`) and its citation. This disclosure is part of the policy — the reader is not asked to take the rendering as authoritative without the tier context. Removing tier badges from the HUD would be a violation of this ADR.

## Consequences

### Phase 3 implementation

- The Throne component (`apps/web/src/lib/world/components/Throne.tsx`) is the reference implementation of rules (2) and (5): rendered aniconically and saturated/luminous rather than photoreal. It already carries an in-file comment block; that comment now points to this ADR and ADR 0010.
- Gold ground, pearl gates, and the jasper wall material in the MVP each render a `symbolic` or `clear` descriptor in stylised, slightly-unphysical form, consistent with rule (2). No further migration is required for the MVP.
- The `points-of-interest.ts` map currently anchors no `debated` descriptors, so no `RENDERING-DECISIONS.md` is required for the MVP. When any future POI promotes a debated descriptor (e.g., the precise nature of "the sea of glass mixed with fire" in Rev 15:2), the file is created and entries added before render code lands.

### Future phases

- Adding the river of life (Rev 22:1) and tree of life (Rev 22:2) is governed by rule (1): both are `clear` descriptors and may be rendered literally, subject to rule (5).
- Adding population (angels, the redeemed, the twenty-four elders) is governed by rule (1) for humans/angels, but the cherubim/seraphim of Ezek 1 / Rev 4 are `symbolic` and must be rendered per rule (2), not as photoreal multi-faced creatures. The four living creatures of Rev 4:6–9 are the load-bearing test case for rule (2) when population work begins.
- Symbolic-vs-literal *toggles* in the UI (a slider, a checkbox) are out of scope under this ADR. The world renders one realisation; toggles are deferred.

### Project readers outside this framing

- Readers who prefer literalist rendering of all imagery (gold streets as metallurgical gold, jasper walls as mineral jasper, etc.) will read the project's 3D world as soft-pedalling. This is accepted: the tier system already encodes the project's reading of the text, and the world inherits it. Different hermeneutics could produce different versions of the world from the same dataset; that is a future possibility, not a current goal.

### Tooling / docs

- `docs/data-model.md` does not need a change — it already documents the tier system.
- `docs/hermeneutics.md` should gain a short pointer to this ADR in its symbolism section. (Deferred to a follow-up doc-pass; not blocking.)
- The HUD copy in `DescriptorHud.tsx` already shows tier badges; rule (7) is satisfied by the existing implementation.

## References

- [`0005-hermeneutic-policy.md`](0005-hermeneutic-policy.md) — base hermeneutic
- [`0008-eschatological-framing.md`](0008-eschatological-framing.md) — eschatological framing this ADR sits inside
- [`0010-aniconic-policy.md`](0010-aniconic-policy.md) — controls divine-person depiction; overrides this ADR where they intersect
- [`../data-model.md`](../data-model.md) §`descriptor.tier`, §`descriptor.symbolic_referent`
- [`../hermeneutics.md`](../hermeneutics.md) — symbolism criteria
- `apps/web/src/lib/world/components/Throne.tsx` — reference implementation of rule (2) + (5)
