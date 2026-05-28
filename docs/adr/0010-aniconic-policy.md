# ADR 0010 — Aniconic policy for divine persons (3D world)

- **Status:** Accepted
- **Date:** 2026-05-28
- **Supersedes:** —
- **Superseded by:** —

## Context

Phase 3 introduces a 3D world where the dataset is rendered as inhabitable space. Among the entities present in the dataset are descriptors that pertain to God the Father, the Son (the Lamb), the Holy Spirit, the one seated on the throne, and other identifications of divine persons. The Phase 3 MVP places an aniconic placeholder at the city centre and the throne component carries an in-file policy comment block; this ADR is that comment block made into a project-level decision.

Three things make this question load-bearing:

1. **Geometry forces commitments text does not.** A descriptor reading "and behold, a throne stood in heaven, with one seated on the throne" (Rev 4:2) can stand without saying *who* — Scripture deliberately leaves the description sparse. A 3D rendering cannot stand sparse: if there is a figure on the throne, it has a body, face, age, gender, posture. Each of those is a positive theological claim the text does not authorise.

2. **The biblical witness about depicting God is consistently restrictive.** The relevant texts:
   - **Ex 20:4 / Deut 5:8** — the Second Commandment prohibition on graven images "of anything that is in heaven above". The Reformed tradition has historically read this as including images of God himself, the Son, and the Spirit. The wider Christian tradition is not unanimous on Christological images post-incarnation, but the project's conservative-Protestant hermeneutic (ADR 0005) sits inside the more restrictive Reformed reading on this question.
   - **Deut 4:15-18** — explicit prohibition on attempting a *form* for God since none was seen at Horeb.
   - **Ex 33:20** — "you cannot see my face, for no man may see me and live." The most direct text on divine visibility.
   - **John 1:18 / 1 Tim 6:16** — God dwells in unapproachable light, no one has seen God.
   - **Ezek 1:26** — "a likeness with a human appearance" *qualified* with "the appearance of the likeness of the glory of the Lord" — Ezekiel goes to deliberate lengths to avoid saying he saw God plainly. Two layers of "likeness" before "appearance".
   - **Rev 4:2-3** — "one seated on the throne", described only by his refracted glory ("the appearance of jasper and carnelian", "a rainbow that had the appearance of an emerald") — never a face, body, age, or feature.
   - **Rev 5:6** — the Lamb described as "standing, as though it had been slain", with "seven horns and seven eyes" — itself a symbolic identification of the Son (per ADR 0009's rule that symbolic descriptors must not be flattened to literal). Rendering a literal wooly four-legged sheep on the throne flattens the symbol.

3. **The MVP already implements an aniconic throne; this ADR codifies it.** The `Throne.tsx` component renders a stepped base + tall rectangular prism + glow column + halo of light + central point light. There is no figure. There is no face. There is no Lamb. The choice is intentional and the file's header comment block names ADR 0010 as the policy lock. This ADR is that policy lock.

## Decision

Far Country adopts the following aniconic policy for the 3D world:

1. **No divine person is depicted in humanoid form.** This includes the Father, the Son (including Christ, the Word, the Lamb), the Holy Spirit, the one seated on the throne, and any other identification in the dataset that refers to a person of the Trinity.

2. **"Humanoid form" specifically excludes:** face, eyes, hair, beard, hands, feet, gender cues, age cues, crown, robe, throne-seated silhouette suggesting an occupant. Any of these renders the policy violated regardless of stylisation level.

3. **The Lamb is also not depicted as a literal lamb on or near the throne.** Rev 5:6 is symbolic (ADR 0009 rule 2): the Lamb identifies Christ slain and risen. The project does not render a four-legged sheep figure. Rule (1) controls; Rev 5:6 follows.

4. **Aniconic rendering uses abstract geometry and light only.** Acceptable renderings include: rectangular prisms, cubes, stepped platforms, columns of light, halos, refracted colour fields (per Rev 4:3's jasper / carnelian / emerald appearances rendered as ambient light rather than as facial features). The MVP Throne is the reference implementation.

5. **The Spirit is rendered, if at all, as the light source of the city.** Rev 21:23 — "the glory of God gives it light, and its lamp is the Lamb" — combined with John 4:24 (God is spirit) and Acts 2:3 (tongues as of fire) authorise representing divine presence as illumination rather than figure. The MVP's central point light at the throne is the working implementation of this.

6. **This policy applies to the 3D world only.** It does not constrain:
   - The text/citation surfaces (descriptor cards, /entities, /ask) — these handle divine persons through their citations and language, not through visual depiction, and ADR 0005's hermeneutic policy already governs them.
   - Future symbolic-mode rendering of the Lamb-as-symbol *outside* the throne context (e.g., if a future phase renders the Bride imagery of Rev 19:7-9). Such cases require their own decision; they are not licensed by this ADR.
   - The depiction of *non-divine* persons — angels, the twenty-four elders, the four living creatures, the redeemed, named humans. ADR 0010 says nothing about these; they are governed by ADR 0009's tier rules and a future ADR (when population work begins, currently scoped for M3.5–M3.6).

7. **Cherubim, seraphim, and the four living creatures are not divine persons and are not covered by this ADR.** They are creatures. They are however `symbolic`-tier and so render under ADR 0009 rule 2 (stylised, not photoreal) when they enter the world. This ADR draws a hard line on the Trinity specifically.

8. **Overrides of this policy require a new ADR superseding this one.** Implementer-level overrides (a code comment, a one-off PR justification, a user-session request to "just put a figure there") do not satisfy the lock. The Throne file's policy comment block points at this ADR; if a future decision reverses the stance, that decision is itself an ADR (0011+) and supersedes this one explicitly.

## Consequences

### Phase 3 implementation

- `apps/web/src/lib/world/components/Throne.tsx` already implements the policy; its header comment is now redundant with this ADR but is retained for in-file visibility. The comment block may be shortened to reference this ADR rather than restate the rationale (deferred to a follow-up edit; not blocking).
- The dataset contains entities for `throne-of-god`, `enthroned-figure`, `one-on-the-throne`, `lambs-book-of-life`, `throne-of-god-and-lamb`, and others that name divine persons. None of these may be promoted to a Point of Interest that triggers a literal divine-figure rendering. They may anchor abstract placeholders (the existing aniconic throne) or ambient effects (the city's lighting).
- The `points-of-interest.ts` map currently anchors `throne-of-god` (abstract Throne) and `glory-of-god-illuminating-the-city` (ambient lighting). Both comply.

### Future phases

- **Population (M3.5–M3.6).** Angels and the redeemed *may* be depicted figuratively under ADR 0009. The four living creatures and the elders' figural form are subject to their own design decision (an ADR or a `RENDERING-DECISIONS.md` entry per ADR 0009 rule 4) since Rev 4 lies in the symbolic register.
- **Christological / Trinitarian imagery in worship-scene phases.** If a future phase wants to render the worship of Rev 5 ("they fell down before the Lamb"), the scene must show the worshippers without showing the object of worship. Aniconic light + central focus column is the working pattern.
- **Christmas / nativity / earthly Jesus scenes.** Out of scope for Far Country (which is heaven-focused), but worth flagging: a future project derived from this dataset that wanted to render the incarnate Christ in earthly contexts would need a new ADR explicitly overriding this one. The current project's framing does not anticipate that.

### Theological framing for readers

- Reformed Protestants reading the project will find this policy familiar — it sits inside the Westminster tradition's reading of the Second Commandment.
- Lutherans, Anglicans, Catholics, Orthodox, and conservative Protestants outside the Reformed iconoclast tradition may find it stricter than their own practice. This is accepted: ADR 0005 already noted that any single hermeneutic excludes alternatives, and the conservative-Protestant base policy of ADR 0005 here lands on the more restrictive Reformed side specifically because rendering forces a choice the text does not.
- The aniconic choice is not anti-Christological. The project affirms that the Son is fully God and fully man (Chalcedon). The choice is that *the 3D world is not the medium* through which the project depicts the incarnation. Citation-grounded text (the dataset's descriptors of Christ in heaven) is.

### Practical guardrails

- A code comment block at the top of any future component that *could* render a divine person should reference this ADR.
- If a user asks the AI agent assisting on this project ("put a figure on the throne", "show Christ on the throne"), the agent should decline and point at this ADR, the same way it would decline a `--no-verify` shortcut on a pre-commit hook.

## References

- [`0005-hermeneutic-policy.md`](0005-hermeneutic-policy.md) — base hermeneutic, includes the conservative-Protestant Reformed framing this ADR sits inside
- [`0008-eschatological-framing.md`](0008-eschatological-framing.md) — eschatological framing (one heaven, two ages) this ADR's "throne in the New Jerusalem" assumes
- [`0009-symbolic-vs-literal-rendering.md`](0009-symbolic-vs-literal-rendering.md) — rendering policy this ADR explicitly overrides for divine persons (rule 5 of 0009)
- `apps/web/src/lib/world/components/Throne.tsx` — reference implementation
- Scripture passages cited inline (Ex 20:4, Deut 4:15-18, 5:8, Ex 33:20, John 1:18, 1 Tim 6:16, Ezek 1:26, Rev 4:2-3, Rev 5:6, Rev 21:23)
