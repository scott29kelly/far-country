# Vendored CC0 skin textures (MakeHuman system skins)

Four painted diffuse textures from the MakeHuman project's asset
repository, `github.com/makehumancommunity/makehuman-assets` at commit
`8cf9645b975a98eea056b140df11a1d278da0d10`, path
`base/skins/textures/`. Every file carried the header "This asset was
explicitly released as CC0 in september 2020". They are painted,
artist-authored textures — no scan data — which is what lets them pass
ADR 0020 rule 3's anonymity-by-construction test.

Vendored into the repo on 2026-08-10 because the upstream GitHub repo
disappeared (API 404) — the exact supply-chain failure ADR 0020's
vendor-the-inputs posture exists to absorb. Each file was sha256-verified
against its Git-LFS pointer while upstream was still available
(2026-08-05, the slice-2 skin pass); the pinned hashes live in
`../../src/generate.py` (`SKIN_TEXTURES`) and in the vendored module's
provenance block, and `generate.py` re-verifies on every run.

CC0 1.0 places no conditions on redistribution. ADR 0006's caution about
redistributing ESV/Willis text does not apply here.
