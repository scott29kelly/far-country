# 0019. Boot-screen stills are self-produced engine captures

Date: 2026-07-03

## Status

Accepted

## Context

The world engine's rule of zero external assets (no downloaded fonts,
images, or audio) exists to guarantee provenance: nothing appears in the
world or its chrome that was not produced by this codebase from cited
data. The redesigned boot rite (STATUS queued item 6, "arrival
experience") wants to hold the user through the 60-90 s world generation
by showing the real world they are about to enter — full-bleed stills of
the actual engine output, not line art.

## Decision

Pre-rendered stills captured from this engine's own renderer (via
`apps/world-engine/tools/regen-boot-stills.ts`, using the established
judging framings) are NOT external assets. They are vendored into the
bundle at `apps/world-engine/src/nj/boot-stills/` and may be shown by the
boot UI. The zero-external-asset rule is about provenance, not pixels;
these captures have full provenance.

Constraint: the stills must show the CURRENT world. Whenever the world's
look materially changes (terrain, city massing, palette, lighting),
re-run the regen tool and re-vendor — a boot screen advertising a
flattering memory of an older build violates the spirit of this decision.

## Consequences

- The engine bundle grows by the compressed stills (~1.5 MB for six
  1920x1080 JPEGs at quality 82).
- A regen step joins the ship checklist for look-changing work.
- The boot UI remains procedural in all other respects; fonts and audio
  are still generated in-code.
