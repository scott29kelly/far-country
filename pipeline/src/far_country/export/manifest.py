"""`data/exports/manifest.json` — schema version, generated_at, counts."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from far_country.export.canonical import CanonicalExport


@dataclass(frozen=True)
class ManifestPayload:
    schema_version: str
    generated_at: str
    counts: dict[str, int]
    entity_files: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "generated_at": self.generated_at,
            "counts": self.counts,
            "entity_files": self.entity_files,
        }


def build_manifest(
    canonical: CanonicalExport,
    *,
    entity_filenames: list[str],
) -> ManifestPayload:
    counts = {
        "entities": len(canonical.entities),
        "descriptors": len(canonical.descriptors),
        "citations": len(canonical.citations),
        "relations": len(canonical.relations),
    }
    return ManifestPayload(
        schema_version=canonical.schema_version,
        generated_at=canonical.generated_at,
        counts=counts,
        entity_files=sorted(entity_filenames),
    )


def write_manifest(
    out_dir: Path,
    *,
    canonical: CanonicalExport,
    entity_filenames: list[str],
) -> Path:
    manifest = build_manifest(canonical, entity_filenames=entity_filenames)
    path = out_dir / "manifest.json"
    path.write_text(
        json.dumps(manifest.to_dict(), indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )
    return path
