"""Offline figure generation for the great multitude's near tier (ADR 0020).

Generates, per figure archetype (archetypes.gen.json — exported from the
engine's figureModel.ts, the single source of truth), the PHOTOREAL-CRITICAL
submeshes of an Anny parametric human at rest pose: the head (with the
front eye surfaces as a separate dark-material part) and both hands. The
robe, sleeves, hair and palm frond remain the engine's procedural geometry;
these parts are exactly what the robe leaves visible.

Slice 2 adds SKIN: every part carries per-vertex UVs (the MakeHuman hm08
layout the anny topology ships), and a 2x2 skin-diffuse atlas is vendored
alongside — four CC0 MakeHuman system skins (makehumancommunity/
makehuman-assets, explicitly released CC0 in September 2020), downloaded at
a pinned commit, sha256-verified against their Git-LFS pointers, ordered
dark -> pale to match the engine's SKIN_RAMP, and packed as one JPEG. The
engine samples the tile keyed by each figure's skin01 and normalizes by the
tile's mean so the authored ramp keeps owning the average tone.

UVs survive decimation by splitting vertices at UV seams first, then
replaying fast_simplification's collapses to map original vertices (and
their UVs) onto the simplified set.

No skeleton posing happens here (slice 1): hands are exported centered at
their wrist bone and the engine aligns them to its own procedural arm
chains; the head is exported centered at its bounding-box center and placed
by top-of-head alignment. Rest-pose open hands are a recorded slice-1
simplification (finger grip posing is a later slice).

Provenance (ADR 0020 rules 2-3): Anny code Apache-2.0, assets CC0
(MakeHuman-derived, artist-authored — anonymity by construction; the skin
textures are the same project's painted system skins, no scan data). ONLY
the default "anny" topology is used. Phenotype parameters derive
deterministically from the archetype table; no randomness enters.

Output: ../../apps/world-engine/src/nj/figuresVendored.gen.ts

Run:  uv run python src/generate.py
(First run downloads ~15 MB of skin textures into .cache/skins/.)
"""

from __future__ import annotations

import base64
import datetime
import hashlib
import io
import json
import sys
import urllib.request
from importlib import metadata
from pathlib import Path

import fast_simplification
import numpy as np
import torch
from PIL import Image

import anny
import anny.face_segmentation as fs

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent  # pipeline/figures
OUT_TS = ROOT.parent.parent / "apps" / "world-engine" / "src" / "nj" / "figuresVendored.gen.ts"
CACHE = ROOT / ".cache" / "skins"

# triangle ceilings per part (probe-asserted engine-side): the whole
# vendored addition must keep worst-case R0 under the crowd budget
HEAD_TRIS = 2400
HAND_TRIS = 240

# ---- skin atlas source (ADR 0020: CC0 inputs only, pinned + hash-verified) ----
# makehumancommunity/makehuman-assets — "This asset was explicitly released
# as CC0 in september 2020" (header of every file); painted system skins,
# not scans — the same anonymity-by-construction test the geometry passes.
MH_ASSETS_REPO = "makehumancommunity/makehuman-assets"
MH_ASSETS_COMMIT = "8cf9645b975a98eea056b140df11a1d278da0d10"
SKIN_TEXTURES = [
    "base/skins/textures/young_lightskinned_female_diffuse.png",
    "base/skins/textures/young_lightskinned_male_diffuse.png",
    "base/skins/textures/young_darkskinned_female_diffuse.png",
    "base/skins/textures/young_darkskinned_male_diffuse.png",
]
ATLAS_TILE = 1024  # per-skin tile resolution (sources are 2048)
ATLAS_JPEG_QUALITY = 80

# Blender/MakeHuman frame (Z up, character facing -Y) -> engine frame
# (Y up, figure facing -Z):  x' = -x, y' = z, z' = y  (a pure rotation,
# det +1 — winding preserved).
AXIS = np.array([[-1.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 1.0, 0.0]])


def convert(v: np.ndarray) -> np.ndarray:
    return v @ AXIS.T


def phenotypes_for(arch: dict) -> dict[str, float]:
    """Deterministic archetype -> Anny phenotype mapping (all in [0,1]).

    The mapping is authored, not fitted: age casts follow the archetype
    names; height/weight/muscle follow the archetype's height/buildW. A
    'gender' spread across archetypes renders Rev 7:9's "peoples" as men,
    women and children rather than one mold. Exact body height is
    normalized afterwards by measuring the generated body, so `height`
    here only needs to be in the right neighborhood.
    """
    name = arch["name"]
    by_name = {
        "adult-tall": dict(gender=0.85, age=0.5, muscle=0.6, weight=0.45),
        "adult-broad": dict(gender=0.75, age=0.55, muscle=0.7, weight=0.75),
        "adult-slender": dict(gender=0.15, age=0.45, muscle=0.35, weight=0.3),
        "elder": dict(gender=0.35, age=0.85, muscle=0.3, weight=0.45),
        "youth": dict(gender=0.2, age=0.3, muscle=0.4, weight=0.35),
        "child": dict(gender=0.5, age=0.16, muscle=0.35, weight=0.4),
    }
    p = by_name[name]
    # height phenotype: roughly linear in archetype metres around 1.6-1.85
    p["height"] = float(min(max((arch["height"] - 1.3) / 0.7, 0.05), 0.95))
    p["proportions"] = 0.5
    return p


def triangulate(quads: np.ndarray) -> np.ndarray:
    """(F,4) quad indices -> (2F,3) triangles, consistent winding."""
    a, b, c, d = quads[:, 0], quads[:, 1], quads[:, 2], quads[:, 3]
    return np.concatenate(
        [np.stack([a, b, c], axis=1), np.stack([a, c, d], axis=1)], axis=0
    )


def submesh(
    verts: np.ndarray, uvs: np.ndarray, tris: np.ndarray, keep_face: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Extract faces where keep_face, reindexing vertices compactly."""
    f = tris[keep_face]
    used = np.unique(f)
    remap = np.full(verts.shape[0], -1, dtype=np.int64)
    remap[used] = np.arange(used.shape[0])
    return verts[used], uvs[used], remap[f]


def decimate(
    verts: np.ndarray, uvs: np.ndarray, tris: np.ndarray, target_tris: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Simplify carrying UVs: replay the collapses for the vertex mapping.

    The mesh is already split at UV seams, so every collapse cluster lives
    on one UV island and any member's UV stands for the cluster.
    """
    if tris.shape[0] <= target_tris:
        return verts, uvs, tris
    reduction = 1.0 - target_tris / tris.shape[0]
    v32 = verts.astype(np.float32)
    t64 = tris.astype(np.int64)
    _, _, collapses = fast_simplification.simplify(
        v32, t64, target_reduction=reduction, return_collapses=True
    )
    v, f, mapping = fast_simplification.replay_simplification(v32, t64, collapses)
    uv = np.zeros((v.shape[0], 2))
    uv[mapping] = uvs  # cluster-local overwrite: any member's UV is fine
    return np.asarray(v), uv, np.asarray(f)


def b64(a: np.ndarray, dtype: str) -> str:
    return base64.b64encode(np.ascontiguousarray(a.astype(dtype)).tobytes()).decode("ascii")


def pack_part(verts: np.ndarray, uvs: np.ndarray, tris: np.ndarray) -> dict:
    assert verts.shape[0] < 65536, "Uint16 index budget exceeded"
    assert uvs.shape[0] == verts.shape[0], "uv/vertex count mismatch"
    bbox = np.concatenate([verts.min(axis=0), verts.max(axis=0)])
    return {
        "pos": b64(verts, "<f4"),
        "uv": b64(uvs, "<f4"),
        "idx": b64(tris, "<u2"),
        "vertCount": int(verts.shape[0]),
        "triCount": int(tris.shape[0]),
        "bbox": [round(float(x), 5) for x in bbox],
    }


# ---- skin atlas ---------------------------------------------------------------


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def fetch_skin(path: str) -> tuple[Image.Image, dict]:
    """Download one LFS-stored texture at the pinned commit, sha256-verified
    against its LFS pointer. Cached in .cache/skins/ (gitignored)."""
    name = path.rsplit("/", 1)[-1]
    pointer_url = (
        f"https://raw.githubusercontent.com/{MH_ASSETS_REPO}/{MH_ASSETS_COMMIT}/{path}"
    )
    with urllib.request.urlopen(pointer_url) as r:
        pointer = r.read().decode("ascii")
    oid = next(
        line.split("sha256:")[1] for line in pointer.splitlines() if "sha256:" in line
    )
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / name
    data: bytes | None = None
    if cached.exists():
        data = cached.read_bytes()
        if hashlib.sha256(data).hexdigest() != oid:
            data = None
    if data is None:
        media_url = (
            f"https://media.githubusercontent.com/media/{MH_ASSETS_REPO}/"
            f"{MH_ASSETS_COMMIT}/{path}"
        )
        print(f"  downloading {name} ...")
        with urllib.request.urlopen(media_url) as r:
            data = r.read()
        got = hashlib.sha256(data).hexdigest()
        if got != oid:
            raise RuntimeError(f"sha256 mismatch for {name}: {got} != {oid}")
        cached.write_bytes(data)
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return img, {"path": path, "sha256": oid, "bytes": len(data)}


def build_skin_atlas(head_uvs: np.ndarray) -> dict:
    """Assemble the 2x2 skin atlas: tiles ordered dark -> pale (matching
    SKIN_RAMP's deep -> pale direction, so tile = floor(skin01 * 4) agrees
    with the ramp), means measured in LINEAR space over the texels the head
    actually samples (backgrounds and body regions must not skew them)."""
    loaded = [fetch_skin(p) for p in SKIN_TEXTURES]

    def head_mean_linear(img: Image.Image) -> np.ndarray:
        w, h = img.size
        px = np.asarray(img, dtype=np.float64)
        xs = np.clip((head_uvs[:, 0] * (w - 1)).round().astype(int), 0, w - 1)
        ys = np.clip(((1.0 - head_uvs[:, 1]) * (h - 1)).round().astype(int), 0, h - 1)
        return srgb_to_linear(px[ys, xs]).mean(axis=0)

    means = [head_mean_linear(img) for img, _ in loaded]
    lum = [0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2] for m in means]
    order = np.argsort(lum)  # darkest first — SKIN_RAMP stop 0 is deepest

    tile_px = ATLAS_TILE
    atlas = Image.new("RGB", (tile_px * 2, tile_px * 2))
    tile_order: list[str] = []
    tile_means: list[list[float]] = []
    sources: list[dict] = []
    for t, src_i in enumerate(order):
        img, prov = loaded[src_i]
        tile = img.resize((tile_px, tile_px), Image.LANCZOS)
        tx, ty = t % 2, t // 2
        # UV space has v = 0 at the BOTTOM; PIL rows start at the top, so
        # tile row ty = 0 pastes into the lower half of the image
        atlas.paste(tile, (tx * tile_px, (1 - ty) * tile_px))
        tile_order.append(prov["path"].rsplit("/", 1)[-1].replace("_diffuse.png", ""))
        tile_means.append([round(float(c), 5) for c in means[src_i]])
        sources.append(prov)

    buf = io.BytesIO()
    atlas.save(buf, format="JPEG", quality=ATLAS_JPEG_QUALITY, optimize=True)
    jpeg = buf.getvalue()
    print(
        f"  atlas {tile_px * 2}px 2x2, jpeg {len(jpeg) / 1024:.0f} KB, "
        f"tiles dark->pale: {', '.join(tile_order)}"
    )
    return {
        "jpegB64": base64.b64encode(jpeg).decode("ascii"),
        "res": tile_px * 2,
        "tiles": len(tile_order),
        "tileOrder": tile_order,
        "tileMeansLinear": tile_means,
        "sourceRepo": MH_ASSETS_REPO,
        "sourceCommit": MH_ASSETS_COMMIT,
        "sources": sources,
    }


def main() -> None:
    arch_file = json.loads((ROOT / "archetypes.gen.json").read_text())
    archetypes = arch_file["archetypes"]

    model = anny.create_fullbody_model()  # rig + topology 'default' = anny (ADR 0020)
    quads = model.faces.numpy()
    tc = model.texture_coordinates.numpy()
    fti = model.face_texture_coordinate_indices.numpy()

    # ---- UV-seam vertex split: split vertex = (vertex, uv) pair ------------
    # The anny mesh carries face-varying UVs (21k UV coords on 13.7k
    # vertices). Splitting first lets decimation treat seams as boundaries
    # and keeps every triangle inside one UV island.
    keys = np.stack([quads.ravel(), fti.ravel()], axis=1)
    uniq_keys, inv = np.unique(keys, axis=0, return_inverse=True)
    split_quads = inv.reshape(quads.shape)
    split_to_vert = uniq_keys[:, 0]
    split_uv = tc[uniq_keys[:, 1]]

    tris_all = triangulate(split_quads)
    # face masks are per-QUAD; repeat for both triangles of each quad
    mask_of = lambda labels: np.tile(
        fs.get_face_segmentation_mask(model, labels).numpy(), 2
    )
    head_mask = mask_of(["head"])
    eye_mask = mask_of(["eye_front.L", "eye_front.R"])
    handl_mask = mask_of(["hand.L"])
    handr_mask = mask_of(["hand.R"])

    bone = {n: i for i, n in enumerate(model.bone_labels)}

    figures = []
    skin_atlas: dict | None = None
    for arch in archetypes:
        ph = phenotypes_for(arch)
        with torch.no_grad():
            out = model.forward(
                phenotype_kwargs={k: torch.tensor([v], dtype=torch.float64) for k, v in ph.items()}
            )
        verts_raw = out["vertices"][0].numpy()
        heads_raw = out["rest_bone_heads"][0].numpy()

        verts = convert(verts_raw)[split_to_vert]
        bone_heads = convert(heads_raw)

        # normalize to the archetype's height (engine metres): the body
        # stands along +Y after conversion
        body_h = float(verts[:, 1].max() - verts[:, 1].min())
        s = arch["height"] / body_h

        def part(mask: np.ndarray, target: int, center: np.ndarray) -> dict:
            v, uv, f = submesh(verts, split_uv, tris_all, mask)
            v, uv, f = decimate(v, uv, f, target)
            return pack_part((v - center) * s, uv, f)

        head_c_v, head_c_uv, _ = submesh(verts, split_uv, tris_all, head_mask)
        head_center = (head_c_v.min(axis=0) + head_c_v.max(axis=0)) / 2
        wrist_l = bone_heads[bone["wrist.L"]]
        wrist_r = bone_heads[bone["wrist.R"]]
        fore_l = wrist_l - bone_heads[bone["lowerarm02.L"]]
        fore_r = wrist_r - bone_heads[bone["lowerarm02.R"]]
        fore_l = fore_l / np.linalg.norm(fore_l)
        fore_r = fore_r / np.linalg.norm(fore_r)

        if skin_atlas is None:
            # UVs are phenotype-independent; measure the tile means once,
            # over the texels the head actually samples. Procedural skin
            # (the neck tube) carries no texel: the material normalizes the
            # texture by these means and multiplies by SKIN_RAMP, so the
            # plain-ramp neck matches the textured head's average tone by
            # construction.
            skin_atlas = build_skin_atlas(head_c_uv)

        fig = {
            "name": arch["name"],
            "phenotypes": {k: round(float(v), 4) for k, v in ph.items()},
            "bodyHeightAnny": round(body_h, 4),
            "scale": round(s, 6),
            "head": part(head_mask, HEAD_TRIS, head_center),
            "eyes": part(eye_mask, 10_000, head_center),  # tiny; never decimated
            "handL": part(handl_mask, HAND_TRIS, wrist_l),
            "handR": part(handr_mask, HAND_TRIS, wrist_r),
            "forearmAxisL": [round(float(x), 5) for x in fore_l],
            "forearmAxisR": [round(float(x), 5) for x in fore_r],
        }
        figures.append(fig)
        print(
            f"[{arch['name']}] body {body_h:.3f} m (x{s:.3f}) "
            f"head {fig['head']['triCount']} tris, eyes {fig['eyes']['triCount']}, "
            f"hands {fig['handL']['triCount']}/{fig['handR']['triCount']}"
        )

    provenance = {
        "generator": "pipeline/figures/src/generate.py",
        "adr": "docs/adr/0020-vendored-generated-assets-anny-path.md",
        "source": "Anny (github.com/naver/anny) — code Apache-2.0, assets CC0 1.0 (MakeHuman-derived, artist-authored)",
        "skinSource": (
            f"github.com/{MH_ASSETS_REPO} @ {MH_ASSETS_COMMIT[:12]} — MakeHuman system "
            "skins, explicitly released CC0 (Sept 2020); painted textures, no scan data"
        ),
        "topology": "anny (default) — the smplx interop mode is non-commercial and banned",
        "annyVersion": metadata.version("anny"),
        "torchVersion": metadata.version("torch"),
        "generated": datetime.date.today().isoformat(),
        "determinism": "phenotypes derive from archetypes.gen.json (exported from figureModel.ts); no RNG",
        "poseNote": "rest pose; hands wrist-centered with rest forearm axis recorded; open-hand grip is a recorded slice-1 simplification",
        "frame": "engine Y-up, figure faces -Z (converted from MakeHuman Z-up/-Y)",
        "uvNote": "per-vertex UVs (MakeHuman hm08 layout, v=0 at bottom); seams split before decimation",
    }

    parts_ts = json.dumps(
        {"provenance": provenance, "skinAtlas": skin_atlas, "figures": figures}, indent=2
    )
    header = (
        "/**\n"
        " * GENERATED FILE — do not edit. Vendored generated assets (ADR 0020).\n"
        " *\n"
        " * Near-tier photoreal submeshes of the great multitude's six figure\n"
        " * archetypes (head + eye fronts + hands), generated OFFLINE from the\n"
        " * Anny parametric human model and committed as data, plus the 2x2\n"
        " * CC0 MakeHuman skin-diffuse atlas the crowd material samples (slice\n"
        " * 2). Everything not present here (robe, sleeves, hair, frond)\n"
        " * remains the procedural generator's. Regenerate: `uv run python\n"
        " * src/generate.py` in pipeline/figures (see its README).\n"
        " *\n"
        " * Provenance is embedded below and probe-asserted (probe-crowd E).\n"
        " */\n\n"
        "export interface VendoredPart {\n"
        "  /** base64 little-endian Float32 xyz triples, part-local metres */\n"
        "  pos: string;\n"
        "  /** base64 little-endian Float32 uv pairs (hm08 layout, v=0 bottom) */\n"
        "  uv: string;\n"
        "  /** base64 little-endian Uint16 triangle indices */\n"
        "  idx: string;\n"
        "  vertCount: number;\n"
        "  triCount: number;\n"
        "  /** minX,minY,minZ,maxX,maxY,maxZ in part-local metres */\n"
        "  bbox: [number, number, number, number, number, number];\n"
        "}\n\n"
        "export interface VendoredSkinAtlas {\n"
        "  /** base64 JPEG, res x res, 2x2 tiles, sRGB */\n"
        "  jpegB64: string;\n"
        "  res: number;\n"
        "  tiles: number;\n"
        "  /** tile names dark -> pale; tile t occupies UV rect\n"
        "   *  [ (t%2)/2 .. (t%2+1)/2 ] x [ (t/2|0)/2 .. (t/2|0+1)/2 ] */\n"
        "  tileOrder: string[];\n"
        "  /** per-tile LINEAR-space mean rgb over head-sampled texels — the\n"
        "   *  material divides by this so SKIN_RAMP keeps owning average tone */\n"
        "  tileMeansLinear: [number, number, number][];\n"
        "  sourceRepo: string;\n"
        "  sourceCommit: string;\n"
        "  sources: { path: string; sha256: string; bytes: number }[];\n"
        "}\n\n"
        "export interface VendoredFigure {\n"
        "  name: string;\n"
        "  phenotypes: Record<string, number>;\n"
        "  bodyHeightAnny: number;\n"
        "  scale: number;\n"
        "  head: VendoredPart;\n"
        "  eyes: VendoredPart;\n"
        "  handL: VendoredPart;\n"
        "  handR: VendoredPart;\n"
        "  forearmAxisL: [number, number, number];\n"
        "  forearmAxisR: [number, number, number];\n"
        "}\n\n"
        "export const FIGURES_VENDORED: {\n"
        "  provenance: Record<string, string>;\n"
        "  skinAtlas: VendoredSkinAtlas;\n"
        "  figures: VendoredFigure[];\n"
        "} = "
    )
    OUT_TS.write_text(header + parts_ts + ";\n", newline="\n")
    size_kb = OUT_TS.stat().st_size / 1024
    print(f"wrote {OUT_TS} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    sys.exit(main())
