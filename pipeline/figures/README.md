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

Slice 2 adds the vendored skin: per-vertex UVs on every part and a 2x2
CC0 skin-diffuse atlas (MakeHuman system skins from
[makehuman-assets](https://github.com/makehumancommunity/makehuman-assets),
explicitly released CC0 in September 2020), downloaded at a pinned commit
and sha256-verified against the Git-LFS pointers into `.cache/skins/`
(gitignored).

Usage (from this directory):

```bash
uv sync
uv run python src/generate.py
```

First run parses MakeHuman assets into `~/.cache/anny/` (a few minutes)
and downloads ~15 MB of skin textures into `.cache/skins/`.
