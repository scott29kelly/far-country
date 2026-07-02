# PRODUCT.md — Far Country

> Context file for design tooling. Distilled from `docs/vision.md`, `docs/prd.md`,
> `CLAUDE.md`, and `apps/world-engine/docs/CITY-QUALITY-BAR.md` — those documents
> are canonical; update them first, this file second.

## Product purpose

Far Country is a citation-grounded, explorable model of heaven as Scripture
describes it: a dataset of sourced descriptors (ESV + Janet Willis) rendered as
a browsable web app, a grounded Q&A, and a walkable 3D New Jerusalem
(WebGPU engine at `/world-preview`). We are not building a thing *about*
heaven; we are building a thing *out of* what Scripture says about it. The
source material constrains every surface, and that constraint is the point.

## Users

- **Primary:** lay Christians who want a concrete, sourced picture of what the
  Bible says about heaven. Not gamers; often older; on laptops/desktops.
- **Secondary:** pastors, teachers, students using it as a study aid.
  Citations are first-class.
- **Tertiary:** the curious and skeptical, owed a fair, unsentimental
  presentation.

## Register

`product` overall (the dataset/browse/Q&A surfaces serve study), but
identity-bearing surfaces of the 3D world (boot screen, establishing views,
wayfinding) run in `brand` register: they carry the product's reverence and
wonder and are judged as designed artifacts.

## Brand and tone

- **Reverent wonder, not sentiment.** Luminous, weighty, unhurried. The world
  itself aims at "a luminous gemstone megastructure rising as a holy mountain"
  (CITY-QUALITY-BAR.md) — warm gold ascending to pale crystal, one dominant
  landmark, light that *bounces and transmits* rather than sits flat.
- **Text points outward.** Scripture quotations are short, exact (ESV), and
  always cited (book chapter:verse). No paraphrase presented as quotation.
- **Premium bar:** the user has explicitly set the visual bar at
  stunning/photoreal, "never basic." Placeholder-quality surfaces are failed
  surfaces.

## Anti-references (never look like)

- Church-media kitsch: clouds, harps, winged cherubs, sunbeam stock photos.
- Sci-fi/game HUD: terminal green, scanlines, neon, "loading assets…" energy.
- Generic SaaS: card grids, gradient text, spinner-and-logo loading screens.
- Gamification. `docs/vision.md`: "Not a virtual worship space or game.
  Gamification is not the goal." Interactivity may invite contemplation and
  touch, not scorekeeping.

## Hard constraints

1. Every claim about heaven carries a citation (Scripture; Willis where
   applicable). Don't invent imagery Scripture doesn't give.
2. Symbolic material stays symbolic (streets-of-gold is `symbolic`, flagged);
   literal material stays literal (bodily resurrection).
3. ESV only for quotations; short excerpts, personal-study licensing posture.
4. The world engine ships zero external assets (no font/CDN fetches, no image
   files) — procedural and system-stack only.
5. Navigation and interaction must be approachable for non-gamers: mouse-led,
   visible cursor, no pointer lock, no twitch demands.
