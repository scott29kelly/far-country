"""JSON export of the canonical store.

`write_canonical_export` produces:

- `data/exports/canonical.json` — the flat union dataset.
- `data/exports/entities/<slug>.json` — one file per entity, in the
  read-shape consumed by the browse UI and 3D layer.
- `data/exports/manifest.json` — schema version, generated_at, counts.

Only `review_status='approved'` descriptors are exported, per
`docs/data-model.md` §3.
"""

from far_country.export.canonical import (
    SCHEMA_VERSION,
    CanonicalExport,
    EntityExport,
    build_canonical_export,
    build_entity_exports,
    write_canonical_export,
)
from far_country.export.manifest import ManifestPayload, write_manifest
from far_country.export.schema import (
    CANONICAL_SCHEMA,
    ENTITY_SCHEMA,
    SchemaValidationError,
    validate_canonical,
    validate_entity,
)

__all__ = [
    "CANONICAL_SCHEMA",
    "ENTITY_SCHEMA",
    "SCHEMA_VERSION",
    "CanonicalExport",
    "EntityExport",
    "ManifestPayload",
    "SchemaValidationError",
    "build_canonical_export",
    "build_entity_exports",
    "validate_canonical",
    "validate_entity",
    "write_canonical_export",
    "write_manifest",
]
