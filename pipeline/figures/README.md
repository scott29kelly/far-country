# pipeline/figures — offline figure generation (ADR 0020)

Seeded, reproducible generation of the great multitude's near-tier figure
geometry from the [Anny](https://github.com/naver/anny) parametric human
model (code Apache-2.0, assets CC0 — artist-authored MakeHuman morphs).

This pipeline **generates**; the engine **never** runs it. Output is
committed under `apps/world-engine` as vendored generated data with a
provenance header (source versions, seeds, parameters, licenses). See
[ADR 0020](../../docs/adr/0020-vendored-generated-assets-anny-path.md) for
the guards: anny topology only (the smplx mode is non-commercial — banned),
CC0/Apache inputs only, seeds derived from the engine's archetype tables.

Usage (from this directory):

```bash
uv sync
uv run python -m figures.generate
```

First run parses MakeHuman assets into `~/.cache/anny/` and can take a few
minutes.
