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

Slice 3 poses the FINGERS (and only the fingers): the right hand — the
engine's raised, frond-holding arm — closes into a loose grip (fingers
curled about the geometric knuckle axis, thumb wrapped toward the index),
and the left hand takes a relaxed natural curl instead of the stiff open
rest pose. The wrist and every other bone stay at rest, so the engine's
wrist-centered placement and recorded rest forearm axes are untouched.
Curl axes are derived from each archetype's own bone geometry (knuckle
line + middle-finger direction), not from rig frame conventions, via the
model's "local-ref" pose parameterization (per-bone deltas expressed in
the reference frame).

Anchor-frame note (slice-3 correction): the model's forward() output is
ROOT-NORMALIZED — vertices and posed bone ends sit a constant rigid
offset (~6.9 cm) from the raw `rest_bone_heads` arrays. Slices 1-2
centered hands on the raw rest wrist, baking that offset into the
payload; wrist centers now come from the posed-identity `bone_heads`,
the same frame the vertices live in. Axis DIRECTIONS are unaffected
(the offset is a pure translation).

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
#
# VENDORED 2026-08-10: the upstream GitHub repo disappeared (API 404 — the
# exact failure ADR 0020's vendor-the-inputs posture exists for). The four
# source PNGs, sha256-verified against their LFS pointers while upstream was
# still up (slice 2, 2026-08-05), now live in vendor/skins/ as committed CC0
# data; the hashes below are the pinned source of truth and the network path
# is a last resort kept for the record.
MH_ASSETS_REPO = "makehumancommunity/makehuman-assets"
MH_ASSETS_COMMIT = "8cf9645b975a98eea056b140df11a1d278da0d10"
SKIN_TEXTURES: list[tuple[str, str]] = [
    (
        "base/skins/textures/young_lightskinned_female_diffuse.png",
        "b2a6ac8cd4f9febdb447368e29c76cd68410bb66e46d9dcfa2d5f75126eea8fc",
    ),
    (
        "base/skins/textures/young_lightskinned_male_diffuse.png",
        "862a26e335e958b70534cb5f0d7c47ef30ab148a56c42b3e9da969cf76f12963",
    ),
    (
        "base/skins/textures/young_darkskinned_female_diffuse.png",
        "96aa4a96b247fc90d371587bb88e6ae3bfc77e83f5126f17e6bbb713aa200470",
    ),
    (
        "base/skins/textures/young_darkskinned_male_diffuse.png",
        "e3f0dbb634e4c68561338f0087f7a122444e84ec56df102212f1222aa12e4d50",
    ),
]
VENDOR_SKINS = ROOT / "vendor" / "skins"
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


# ---- slice 3: authored finger curls -------------------------------------------
# Angles in radians per segment (proximal, middle, distal). GRIP closes the
# frond hand into a loose fist (channel wide enough for the engine's ~1.2 cm
# rachis); RELAX is a natural hanging-hand curl. Authored constants — no RNG.
GRIP_FINGERS = (0.9, 1.1, 0.6)
GRIP_THUMB = (0.55, 0.65, 0.45)
RELAX_FINGERS = (0.35, 0.45, 0.25)
RELAX_THUMB = (0.2, 0.25, 0.15)


def rotmat(axis: np.ndarray, angle: float) -> np.ndarray:
    a = axis / np.linalg.norm(axis)
    c, s = np.cos(angle), np.sin(angle)
    x, y, z = a
    return np.array(
        [
            [c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s],
            [y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s],
            [z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)],
        ]
    )


def hand_pose(
    P: np.ndarray,
    bone: dict[str, int],
    heads: np.ndarray,
    tails: np.ndarray,
    side: str,
    fingers: tuple[float, float, float],
    thumb: tuple[float, float, float],
) -> None:
    """Write finger-curl rotations for one hand into pose tensor P (J,4,4).

    Axes are geometric, derived per archetype from the rig's own rest bone
    ends (directions are frame-shift invariant): fingers flex about the
    knuckle line (finger2-1 -> finger5-1), the thumb wraps about a blend of
    the middle-finger direction and the knuckle line. The curl sign flips
    with handedness; -1 closes the right hand toward its palm (verified
    numerically: middle-tip-to-palm 13.1 cm -> 5.3 cm at GRIP angles).
    """
    sign = -1.0 if side == "R" else 1.0
    k = heads[bone[f"finger5-1.{side}"]] - heads[bone[f"finger2-1.{side}"]]
    k = k / np.linalg.norm(k)
    f = tails[bone[f"finger3-1.{side}"]] - heads[bone[f"finger3-1.{side}"]]
    f = f / np.linalg.norm(f)
    for fi in (2, 3, 4, 5):
        for seg, ang in zip((1, 2, 3), fingers):
            P[bone[f"finger{fi}-{seg}.{side}"], :3, :3] = rotmat(k * sign, ang)
    t_axis = f - sign * 0.4 * k
    for seg, ang in zip((1, 2, 3), thumb):
        P[bone[f"finger1-{seg}.{side}"], :3, :3] = rotmat(t_axis, ang)


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


def fetch_skin(path: str, oid: str) -> tuple[Image.Image, dict]:
    """Load one skin texture, sha256-verified against the PINNED hash.

    Order: the committed vendor copy (vendor/skins/ — canonical since the
    upstream repo vanished, 2026-08-10), then the legacy download cache,
    then — for the record only — the original network path, which requires
    upstream to exist again."""
    name = path.rsplit("/", 1)[-1]
    data: bytes | None = None
    for candidate in (VENDOR_SKINS / name, CACHE / name):
        if candidate.exists():
            raw = candidate.read_bytes()
            if hashlib.sha256(raw).hexdigest() == oid:
                data = raw
                break
    if data is None:
        media_url = (
            f"https://media.githubusercontent.com/media/{MH_ASSETS_REPO}/"
            f"{MH_ASSETS_COMMIT}/{path}"
        )
        print(f"  vendor/cache miss — downloading {name} ...")
        with urllib.request.urlopen(media_url) as r:
            data = r.read()
        got = hashlib.sha256(data).hexdigest()
        if got != oid:
            raise RuntimeError(f"sha256 mismatch for {name}: {got} != {oid}")
        CACHE.mkdir(parents=True, exist_ok=True)
        (CACHE / name).write_bytes(data)
    img = Image.open(io.BytesIO(data)).convert("RGB")
    return img, {"path": path, "sha256": oid, "bytes": len(data)}


def build_skin_atlas(head_uvs: np.ndarray) -> dict:
    """Assemble the 2x2 skin atlas: tiles ordered dark -> pale (matching
    SKIN_RAMP's deep -> pale direction, so tile = floor(skin01 * 4) agrees
    with the ramp), means measured in LINEAR space over the texels the head
    actually samples (backgrounds and body regions must not skew them)."""
    loaded = [fetch_skin(p, oid) for p, oid in SKIN_TEXTURES]

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


# ---- hair (Scott's verdict 2026-08-12: vendored CC0 meshes over shells) --------
# Source: the MakeHuman SYSTEM hair styles, from the project's own CC0 asset
# pack (the GitHub assets repo is gone — the pack zip is the surviving
# canonical channel). Chosen styles are vendored under vendor/hair/ as
# committed CC0 data, one per archetype, honoring the archetype's hairStyle
# class (0 short cap / 1 shoulder-length / 2 cropped) with visible variety
# across the six.
HAIR_PACK_URL = (
    "https://files2.makehumancommunity.org/asset_packs/makehuman_system_assets/"
    "makehuman_system_assets_cc0.zip"
)
HAIR_PACK_ZIP = ROOT / ".cache" / "makehuman_system_assets_cc0.zip"
VENDOR_HAIR = ROOT / "vendor" / "hair"
HAIR_TRIS = 800
# archetype name -> system hair style (class in parentheses, from
# figureModel.FIGURE_ARCHETYPES.hairStyle)
HAIR_FOR = {
    "adult-tall": "short01",  # (0) short cap
    "adult-broad": "short04",  # (0) short cap
    "adult-slender": "long01",  # (1) shoulder-length
    "elder": "short02",  # (2) cropped
    "youth": "bob01",  # (1) shoulder-length bob
    "child": "short03",  # (0) short cap
}
# the hair OBJs are authored around the base mesh's head in MakeHuman's
# asset frame: Y-up decimetres, face +Z (nose-vertex check 2026-08-12:
# midline head-band vertex (0, 6.91, 1.68)) -> engine face -Z is a 180-deg
# rotation about Y: (x, y, z) -> (-x, y, -z). Winding preserved.
HAIR_AXIS = np.array([[-1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, -1.0]])
# neck cut for the SOURCE head box in base.obj decimetres (head top 8.5):
# matches the anny 'head' segmentation's anatomical range closely enough
# for an affine hair fit (validated by the fit report at generation time)
OBJ_NECK_Y = 6.3


def parse_obj(path: Path) -> tuple[np.ndarray, np.ndarray]:
    """OBJ vertices + triangles (polygon fan triangulation, winding kept)."""
    vs: list[list[float]] = []
    tris: list[list[int]] = []
    with open(path) as f:
        for line in f:
            if line.startswith("v "):
                vs.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("f "):
                ids = [int(tok.split("/")[0]) - 1 for tok in line.split()[1:]]
                for k in range(1, len(ids) - 1):
                    tris.append([ids[0], ids[k], ids[k + 1]])
    return np.array(vs), np.array(tris, dtype=np.int64)


def vendored_hair_files(style: str) -> tuple[Path, list[dict]]:
    """Ensure vendor/hair/<style>/ holds the style's mhclo+obj (+license),
    extracting from the cached CC0 pack zip on first use. Returns the obj
    path and per-file provenance (path + sha256)."""
    import zipfile

    dest = VENDOR_HAIR / style
    if not dest.exists() or not any(dest.glob("*.obj")):
        if not HAIR_PACK_ZIP.exists():
            raise RuntimeError(
                f"vendor/hair/{style} missing and the pack zip is not cached; "
                f"download {HAIR_PACK_URL} to {HAIR_PACK_ZIP}"
            )
        dest.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(HAIR_PACK_ZIP) as z:
            members = [
                n
                for n in z.namelist()
                if f"/{style}/" in f"/{n}"
                and n.lower().endswith((".mhclo", ".obj", ".mhmat", ".txt", ".license"))
                and "hair" in n.lower()
                and not n.endswith("/")
            ]
            if not members:
                raise RuntimeError(f"style {style} not found in the pack zip")
            for m in members:
                (dest / Path(m).name).write_bytes(z.read(m))
    if len(sorted(dest.glob("*.obj"))) != 1 or len(sorted(dest.glob("*.mhclo"))) != 1:
        raise RuntimeError(f"expected exactly one obj + one mhclo in {dest}")
    prov = [
        {
            "path": f"vendor/hair/{style}/{p.name}",
            "sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
        }
        for p in sorted(dest.iterdir())
        if p.is_file()
    ]
    return dest, prov


def base_mesh_raw() -> np.ndarray:
    """All 19,158 base.obj vertices, RAW MakeHuman asset frame — the mesh
    every mhclo binding indexes into."""
    base_dir = Path(anny.__file__).parent / "data" / "mpfb2"
    vs: list[list[float]] = []
    with open(base_dir / "3dobjs" / "base.obj") as f:
        for line in f:
            if line.startswith("v "):
                vs.append([float(x) for x in line.split()[1:4]])
    return np.array(vs)


def base_head_box(base_raw: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """The DEFAULT head box (engine-oriented axes) — the SOURCE side of the
    per-archetype affine hair fit."""
    base_dir = Path(anny.__file__).parent / "data" / "mpfb2"
    V = base_raw @ HAIR_AXIS.T
    groups = json.loads((base_dir / "mesh_metadata" / "basemesh_vertex_groups.json").read_text())

    def flat(g: list) -> list[int]:
        out: list[int] = []
        for e in g:
            if isinstance(e, list):
                out.extend(range(e[0], e[1] + 1))
            else:
                out.append(e)
        return out

    body = V[flat(groups["body"])]
    head = body[body[:, 1] >= OBJ_NECK_Y]
    return head.min(axis=0), head.max(axis=0)


def mhclo_fit(mhclo: Path, base_raw: np.ndarray) -> np.ndarray:
    """Seat a hair mesh on the DEFAULT base mesh via its mhclo binding —
    the authoritative fit (the raw OBJs sit wherever the artist left them:
    short01's sculpt floats a decimetre above the crown, long01's below it).

    Each clothes vertex is either an exact base-vertex bind (one index) or
    a weighted triple with an offset; offsets scale by the x/y/z reference
    factors ([i1, i2, recorded distance] header lines — ~1.0 on the default
    mesh the distances were recorded on). Frame: raw MakeHuman asset space,
    same as base.obj."""
    verts: list[np.ndarray] = []
    scales = np.ones(3)
    axis_of = {"x_scale": 0, "y_scale": 1, "z_scale": 2}
    in_verts = False
    with open(mhclo) as f:
        for line in f:
            tok = line.split()
            if not tok or tok[0].startswith("#"):
                continue
            if tok[0] in axis_of and len(tok) == 4:
                a = axis_of[tok[0]]
                i1, i2, dist = int(tok[1]), int(tok[2]), float(tok[3])
                scales[a] = abs(base_raw[i1, a] - base_raw[i2, a]) / dist
                continue
            if tok[0] == "verts":
                in_verts = True
                continue
            if tok[0] == "delete_verts":
                break
            if not in_verts:
                continue
            try:  # keyword lines (e.g. "material x.mhmat") may follow "verts"
                float(tok[0])
            except ValueError:
                continue
            if len(tok) == 1:
                verts.append(base_raw[int(tok[0])].copy())
            elif len(tok) >= 9:
                i = [int(t) for t in tok[0:3]]
                w = np.array([float(t) for t in tok[3:6]])
                off = np.array([float(t) for t in tok[6:9]])
                verts.append(w @ base_raw[i] + off * scales)
            else:
                raise RuntimeError(f"unrecognized mhclo vertex line: {line.strip()}")
    return np.array(verts)


def fit_hair(
    hair_dir: Path,
    base_raw: np.ndarray,
    src_box: tuple[np.ndarray, np.ndarray],
    head_lo: np.ndarray,
    head_hi: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Two-stage hair fit onto one archetype's head (part-local metres):
    (1) mhclo-seat the hair on the default base mesh — exact; (2) affine
    default-head-box -> this head's bbox, x/z centers aligned, crowns (y
    tops) aligned. A few mm of anatomical slack in stage 2 is fine for
    hair — far tighter than the shell it replaces."""
    obj = next(iter(sorted(hair_dir.glob("*.obj"))))
    mhclo = next(iter(sorted(hair_dir.glob("*.mhclo"))))
    obj_v, ht = parse_obj(obj)
    hv = mhclo_fit(mhclo, base_raw)
    if hv.shape[0] != obj_v.shape[0]:
        raise RuntimeError(
            f"{mhclo.name}: {hv.shape[0]} bound verts vs {obj_v.shape[0]} obj verts"
        )
    hv = hv @ HAIR_AXIS.T
    lo, hi = src_box
    scale = (head_hi - head_lo) / (hi - lo)
    out = np.empty_like(hv)
    for a in range(3):
        if a == 1:  # crowns align
            out[:, a] = head_hi[a] - (hi[a] - hv[:, a]) * scale[a]
        else:  # centers align
            out[:, a] = (hv[:, a] - (lo[a] + hi[a]) / 2) * scale[a] + (head_lo[a] + head_hi[a]) / 2
    return out, ht


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
    base_raw = base_mesh_raw()
    hair_src_box = base_head_box(base_raw)
    hair_sources: dict[str, list[dict]] = {}
    for arch in archetypes:
        ph = phenotypes_for(arch)
        ph_kwargs = {k: torch.tensor([v], dtype=torch.float64) for k, v in ph.items()}
        # pass 1 (rest): this archetype's rig rest bone ends, for the curl
        # axes — directions only, so the raw-rest frame is fine here
        with torch.no_grad():
            rest = model.forward(phenotype_kwargs=ph_kwargs)
        rest_heads = rest["rest_bone_heads"][0].numpy()
        rest_tails = rest["rest_bone_tails"][0].numpy()
        pose = np.tile(np.eye(4), (len(model.bone_labels), 1, 1))
        hand_pose(pose, bone, rest_heads, rest_tails, "R", GRIP_FINGERS, GRIP_THUMB)
        hand_pose(pose, bone, rest_heads, rest_tails, "L", RELAX_FINGERS, RELAX_THUMB)
        # pass 2 (posed): fingers curled, everything else identity; bone_heads
        # come back in the SAME root-normalized frame as the vertices (the
        # slice-3 anchor correction), with the wrist verified unmoved by the
        # finger-only pose
        with torch.no_grad():
            out = model.forward(
                pose_parameters=torch.tensor(pose[None], dtype=torch.float64),
                phenotype_kwargs=ph_kwargs,
                pose_parameterization="local-ref",
                return_bone_ends=True,
            )
        verts_raw = out["vertices"][0].numpy()
        heads_raw = out["bone_heads"][0].numpy()

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

        # vendored hair: fit the archetype's system style onto THIS head's
        # part-local bounds (same space the head part ships in, so the
        # engine places hair with the head's own offset)
        style = HAIR_FOR[arch["name"]]
        hair_dir, hair_prov = vendored_hair_files(style)
        hair_sources[style] = hair_prov
        head_lo = (head_c_v.min(axis=0) - head_center) * s
        head_hi = (head_c_v.max(axis=0) - head_center) * s
        hv, ht = fit_hair(hair_dir, base_raw, hair_src_box, head_lo, head_hi)
        hv, huv, ht = decimate(hv, np.full((hv.shape[0], 2), 0.5), ht, HAIR_TRIS)

        fig = {
            "name": arch["name"],
            "phenotypes": {k: round(float(v), 4) for k, v in ph.items()},
            "bodyHeightAnny": round(body_h, 4),
            "scale": round(s, 6),
            "head": part(head_mask, HEAD_TRIS, head_center),
            "eyes": part(eye_mask, 10_000, head_center),  # tiny; never decimated
            "handL": part(handl_mask, HAND_TRIS, wrist_l),
            "handR": part(handr_mask, HAND_TRIS, wrist_r),
            "hair": pack_part(hv, huv, ht),
            "hairStyle": style,
            "forearmAxisL": [round(float(x), 5) for x in fore_l],
            "forearmAxisR": [round(float(x), 5) for x in fore_r],
        }
        figures.append(fig)
        print(
            f"[{arch['name']}] body {body_h:.3f} m (x{s:.3f}) "
            f"head {fig['head']['triCount']} tris, eyes {fig['eyes']['triCount']}, "
            f"hands {fig['handL']['triCount']}/{fig['handR']['triCount']}, "
            f"hair {style} {fig['hair']['triCount']} tris "
            f"(fit y {hv[:, 1].min():+.3f}..{hv[:, 1].max():+.3f} vs head {head_lo[1]:+.3f}..{head_hi[1]:+.3f})"
        )

    provenance = {
        "generator": "pipeline/figures/src/generate.py",
        "adr": "docs/adr/0020-vendored-generated-assets-anny-path.md",
        "source": "Anny (github.com/naver/anny) — code Apache-2.0, assets CC0 1.0 (MakeHuman-derived, artist-authored)",
        "skinSource": (
            f"github.com/{MH_ASSETS_REPO} @ {MH_ASSETS_COMMIT[:12]} — MakeHuman system "
            "skins, explicitly released CC0 (Sept 2020); painted textures, no scan data. "
            "Upstream repo vanished from GitHub 2026-08-10; the sha256-verified sources "
            "are vendored at pipeline/figures/vendor/skins/ (CC0 redistributes freely)"
        ),
        "topology": "anny (default) — the smplx interop mode is non-commercial and banned",
        "annyVersion": metadata.version("anny"),
        "torchVersion": metadata.version("torch"),
        "generated": datetime.date.today().isoformat(),
        "determinism": "phenotypes derive from archetypes.gen.json (exported from figureModel.ts); no RNG",
        "poseNote": (
            "slice 3: fingers-only authored curls — right hand grips (frond hand), "
            "left hand relaxed; wrist and all other bones rest, so wrist-centering and "
            "rest forearm axes hold; anchors read from the root-normalized posed frame "
            "(fixes the slice-1/2 constant wrist offset)"
        ),
        "frame": "engine Y-up, figure faces -Z (converted from MakeHuman Z-up/-Y)",
        "uvNote": "per-vertex UVs (MakeHuman hm08 layout, v=0 at bottom); seams split before decimation",
        "hairSource": (
            "MakeHuman system hair (CC0 asset pack, files2.makehumancommunity.org "
            "asset_packs/makehuman_system_assets) — artist-authored, no scan data; "
            "sources vendored at pipeline/figures/vendor/hair/ (Scott's verdict "
            "2026-08-12: vendored meshes replace the procedural shells at LOD0); "
            "affine head fit, decimated to <= 800 tris; hair UVs are a 0.5 filler "
            "(the crowd material colors hair by ramp, never by texture)"
        ),
        "hairFiles": json.dumps(hair_sources, sort_keys=True),
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
        "  /** fitted CC0 system hair (part-local like head; ramp-colored,\n"
        "   *  uv is a 0.5 filler) */\n"
        "  hair: VendoredPart;\n"
        "  hairStyle: string;\n"
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
