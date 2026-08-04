"""Offline figure generation for the great multitude's near tier (ADR 0020).

Generates, per figure archetype (archetypes.gen.json — exported from the
engine's figureModel.ts, the single source of truth), the PHOTOREAL-CRITICAL
submeshes of an Anny parametric human at rest pose: the head (with the
front eye surfaces as a separate dark-material part) and both hands. The
robe, sleeves, hair and palm frond remain the engine's procedural geometry;
these parts are exactly what the robe leaves visible.

No skeleton posing happens here (slice 1): hands are exported centered at
their wrist bone and the engine aligns them to its own procedural arm
chains; the head is exported centered at its bounding-box center and placed
by top-of-head alignment. Rest-pose open hands are a recorded slice-1
simplification (finger grip posing is a later slice).

Provenance (ADR 0020 rules 2-3): Anny code Apache-2.0, assets CC0
(MakeHuman-derived, artist-authored — anonymity by construction). ONLY the
default "anny" topology is used. Phenotype parameters derive
deterministically from the archetype table; no randomness enters.

Output: ../../apps/world-engine/src/nj/figuresVendored.gen.ts

Run:  uv run python src/generate.py
"""

from __future__ import annotations

import base64
import datetime
import json
import sys
from importlib import metadata
from pathlib import Path

import fast_simplification
import numpy as np
import torch

import anny
import anny.face_segmentation as fs

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent  # pipeline/figures
OUT_TS = ROOT.parent.parent / "apps" / "world-engine" / "src" / "nj" / "figuresVendored.gen.ts"

# triangle ceilings per part (probe-asserted engine-side): the whole
# vendored addition must keep worst-case R0 under the crowd budget
HEAD_TRIS = 2400
HAND_TRIS = 240

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


def submesh(verts: np.ndarray, tris: np.ndarray, keep_face: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Extract faces where keep_face, reindexing vertices compactly."""
    f = tris[keep_face]
    used = np.unique(f)
    remap = np.full(verts.shape[0], -1, dtype=np.int64)
    remap[used] = np.arange(used.shape[0])
    return verts[used], remap[f]


def decimate(verts: np.ndarray, tris: np.ndarray, target_tris: int) -> tuple[np.ndarray, np.ndarray]:
    if tris.shape[0] <= target_tris:
        return verts, tris
    reduction = 1.0 - target_tris / tris.shape[0]
    v, f = fast_simplification.simplify(
        verts.astype(np.float32), tris.astype(np.int64), target_reduction=reduction
    )
    return np.asarray(v), np.asarray(f)


def b64(a: np.ndarray, dtype: str) -> str:
    return base64.b64encode(np.ascontiguousarray(a.astype(dtype)).tobytes()).decode("ascii")


def pack_part(verts: np.ndarray, tris: np.ndarray) -> dict:
    assert verts.shape[0] < 65536, "Uint16 index budget exceeded"
    bbox = np.concatenate([verts.min(axis=0), verts.max(axis=0)])
    return {
        "pos": b64(verts, "<f4"),
        "idx": b64(tris, "<u2"),
        "vertCount": int(verts.shape[0]),
        "triCount": int(tris.shape[0]),
        "bbox": [round(float(x), 5) for x in bbox],
    }


def main() -> None:
    arch_file = json.loads((ROOT / "archetypes.gen.json").read_text())
    archetypes = arch_file["archetypes"]

    model = anny.create_fullbody_model()  # rig + topology 'default' = anny (ADR 0020)
    quads = model.faces.numpy()
    tris_all = triangulate(quads)
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
    for arch in archetypes:
        ph = phenotypes_for(arch)
        with torch.no_grad():
            out = model.forward(
                phenotype_kwargs={k: torch.tensor([v], dtype=torch.float64) for k, v in ph.items()}
            )
        verts_raw = out["vertices"][0].numpy()
        heads_raw = out["rest_bone_heads"][0].numpy()

        verts = convert(verts_raw)
        bone_heads = convert(heads_raw)

        # normalize to the archetype's height (engine metres): the body
        # stands along +Y after conversion
        body_h = float(verts[:, 1].max() - verts[:, 1].min())
        s = arch["height"] / body_h

        def part(mask: np.ndarray, target: int, center: np.ndarray) -> dict:
            v, f = submesh(verts, tris_all, mask)
            v, f = decimate(v, f, target)
            return pack_part((v - center) * s, f)

        head_c_v, _ = submesh(verts, tris_all, head_mask)
        head_center = (head_c_v.min(axis=0) + head_c_v.max(axis=0)) / 2
        wrist_l = bone_heads[bone["wrist.L"]]
        wrist_r = bone_heads[bone["wrist.R"]]
        fore_l = wrist_l - bone_heads[bone["lowerarm02.L"]]
        fore_r = wrist_r - bone_heads[bone["lowerarm02.R"]]
        fore_l = fore_l / np.linalg.norm(fore_l)
        fore_r = fore_r / np.linalg.norm(fore_r)

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
        "topology": "anny (default) — the smplx interop mode is non-commercial and banned",
        "annyVersion": metadata.version("anny"),
        "torchVersion": metadata.version("torch"),
        "generated": datetime.date.today().isoformat(),
        "determinism": "phenotypes derive from archetypes.gen.json (exported from figureModel.ts); no RNG",
        "poseNote": "rest pose; hands wrist-centered with rest forearm axis recorded; open-hand grip is a recorded slice-1 simplification",
        "frame": "engine Y-up, figure faces -Z (converted from MakeHuman Z-up/-Y)",
    }

    parts_ts = json.dumps({"provenance": provenance, "figures": figures}, indent=2)
    header = (
        "/**\n"
        " * GENERATED FILE — do not edit. Vendored generated assets (ADR 0020).\n"
        " *\n"
        " * Near-tier photoreal submeshes of the great multitude's six figure\n"
        " * archetypes (head + eye fronts + hands), generated OFFLINE from the\n"
        " * Anny parametric human model and committed as data. Everything not\n"
        " * present here (robe, sleeves, hair, frond) remains the procedural\n"
        " * generator's. Regenerate: `uv run python src/generate.py` in\n"
        " * pipeline/figures (see its README).\n"
        " *\n"
        " * Provenance is embedded below and probe-asserted (probe-figures).\n"
        " */\n\n"
        "export interface VendoredPart {\n"
        "  /** base64 little-endian Float32 xyz triples, part-local metres */\n"
        "  pos: string;\n"
        "  /** base64 little-endian Uint16 triangle indices */\n"
        "  idx: string;\n"
        "  vertCount: number;\n"
        "  triCount: number;\n"
        "  /** minX,minY,minZ,maxX,maxY,maxZ in part-local metres */\n"
        "  bbox: [number, number, number, number, number, number];\n"
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
        "  figures: VendoredFigure[];\n"
        "} = "
    )
    OUT_TS.write_text(header + parts_ts + ";\n", newline="\n")
    size_kb = OUT_TS.stat().st_size / 1024
    print(f"wrote {OUT_TS} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    sys.exit(main())
