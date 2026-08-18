# ADR 0021 — Admit attribution-only ("just credit us") licenses for vendored asset inputs

- **Status:** Accepted (Scott, 2026-08-17)
- **Amends:** [ADR 0020](0020-vendored-generated-assets-anny-path.md) rule 1 (license allow-list). Every other ADR 0020 rule — offline generation, vendored outputs with provenance, anny-topology-only for figures, anonymity by construction, one material per LOD tier — stands unchanged.

## Context

ADR 0020 admitted only CC0 (public domain) and Apache-2.0 inputs: zero-obligation licenses, chosen when strictness was free. Evaluating [Modly](https://github.com/lightningpixel/modly) (MIT-licensed local 3D-asset generator, a candidate for future set-dressing work — e.g. the glory-of-the-nations artifacts of Rev 21:24–26) surfaced the cost of that line: its best-fitting generation backends are MIT-licensed, and good CC-BY asset packs (e.g. the MakeHuman hair02/03 packs passed over in the hair pass) were excluded for the sole crime of asking for a credit line.

Scott's call (2026-08-17): the price of attribution — one recorded credit — is not worth losing better inputs over. Admit the "just credit us" class deliberately, on paper, before the first need arises.

## Decision

1. **Accepted license classes for vendored asset inputs** (meshes, textures, motion, model weights whose outputs we vendor):
   - CC0 / public domain, Apache-2.0 *(as before — no obligations)*
   - **MIT, BSD-2-Clause, BSD-3-Clause** *(new — attribution required)*
   - **CC-BY 4.0** *(new — attribution required, changes indicated)*
2. **Still banned:** anything non-commercial (NC), no-derivatives (ND), share-alike (SA/copyleft for assets), bespoke vendor licenses with use restrictions (e.g. Tencent community licenses, NVIDIA non-commercial source licenses, AMASS/SMPL-X academic terms), and anything region- or field-of-use-restricted. If a tool is permissive but a *component or model it loads* is restricted, the component decides — allow-list per backend, not per app.
3. **Attribution mechanism:** the first vendored asset under an attribution license creates **`CREDITS.md` at the repo root** — one line per source: name, author, license, URL, what we used it for. Vendored-module provenance headers (the ADR 0020 mechanism) continue to carry the per-file detail (source, sha256, date). The deployed site links the credits file once anything in it ships.
4. **AI-generated assets add one line of diligence:** record the generating tool, the model name and weights license, and the date, in the same provenance header. Weights whose license is silent are treated as banned until clarified.

## Immediate application

- **Modly** (MIT, local, offline after model download) is approved as a *tool*. Its backend allow-list today: **TripoSG** (MIT code, image→3D, 8 GB VRAM — fits the RTX 5070 Ti's 12 GB). **TRELLIS** is deferred: MIT core but 16 GB VRAM and two restricted-license submodules (diffoctreerast, modified FlexiCubes) — revisit only with the component licenses individually cleared. **Hunyuan3D backends remain banned** (Tencent community license).
- No generated asset ships from this decision alone: each future vendored output still goes through the ADR 0020 pipeline (offline generation, committed with provenance, probe-asserted where applicable) plus the credits line.

## Consequences

- Better inputs become available at the cost of maintaining a credits file — a cost that scales with adoption, not with this decision.
- The CC0/Apache-only simplicity ("nothing to remember") is gone; the provenance headers and CREDITS.md are now load-bearing and must be kept honest.
- ADR 0006's personal-study posture is unaffected: attribution licenses impose no redistribution limits that posture doesn't already respect.
