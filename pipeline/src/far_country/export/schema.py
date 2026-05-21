"""JSON Schemas for the canonical export.

Phase 1 acceptance criterion 3 (`docs/specs/phase-1-dataset.md` §4) requires
that the export passes JSON-schema validation. These schemas are the
source of truth for what consumers can rely on; bump `SCHEMA_VERSION` in
`export/canonical.py` whenever they change in a breaking way.

The validator uses Draft 2020-12 via `jsonschema`. We keep the schemas in
Python (rather than separate .json files) so the version lives next to
the code that produces it.
"""

from __future__ import annotations

from typing import Any, Final

from jsonschema import Draft202012Validator
from jsonschema import ValidationError as _JSONSchemaValidationError

ENTITY_TYPES: Final = ["person", "place", "thing", "event", "attribute"]
TIERS: Final = ["clear", "fuzzy", "debated", "symbolic"]
TEMPORAL_PHASES: Final = ["intermediate", "final", "either", "unspecified"]
SOURCE_TYPES: Final = ["scripture", "willis", "secondary"]


_ENTITY_OBJECT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["id", "name", "entity_type"],
    "properties": {
        "id": {"type": "string", "minLength": 1},
        "name": {"type": "string", "minLength": 1},
        "entity_type": {"enum": ENTITY_TYPES},
        "summary": {"type": ["string", "null"]},
    },
    "additionalProperties": False,
}

_DESCRIPTOR_OBJECT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["id", "entity_id", "statement", "tier"],
    "properties": {
        "id": {"type": "string", "minLength": 1},
        "entity_id": {"type": "string", "minLength": 1},
        "statement": {"type": "string", "minLength": 1},
        "tier": {"enum": TIERS},
        "symbolic_referent": {"type": ["string", "null"]},
        "temporal_phase": {"oneOf": [{"enum": TEMPORAL_PHASES}, {"type": "null"}]},
    },
    "additionalProperties": False,
    "allOf": [
        {
            "if": {"properties": {"tier": {"const": "symbolic"}}, "required": ["tier"]},
            "then": {
                "required": ["symbolic_referent"],
                "properties": {"symbolic_referent": {"type": "string", "minLength": 1}},
            },
        }
    ],
}

_CITATION_OBJECT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["id", "descriptor_id", "source_type"],
    "properties": {
        "id": {"type": "string", "minLength": 1},
        "descriptor_id": {"type": "string", "minLength": 1},
        "source_type": {"enum": SOURCE_TYPES},
        "book": {"type": ["string", "null"]},
        "chapter": {"type": ["integer", "null"]},
        "verse_start": {"type": ["integer", "null"]},
        "verse_end": {"type": ["integer", "null"]},
        "willis_chapter": {"type": ["string", "null"]},
        "willis_page_start": {"type": ["integer", "null"]},
        "willis_page_end": {"type": ["integer", "null"]},
        "secondary_work": {"type": ["string", "null"]},
        "secondary_locator": {"type": ["string", "null"]},
        "quote": {"type": ["string", "null"]},
    },
    "additionalProperties": False,
    "allOf": [
        {
            "if": {
                "properties": {"source_type": {"const": "scripture"}},
                "required": ["source_type"],
            },
            "then": {
                "required": ["book", "chapter", "verse_start"],
                "properties": {
                    "book": {"type": "string", "minLength": 1},
                    "chapter": {"type": "integer", "minimum": 1},
                    "verse_start": {"type": "integer", "minimum": 1},
                },
            },
        },
        {
            "if": {
                "properties": {"source_type": {"const": "willis"}},
                "required": ["source_type"],
            },
            "then": {
                "required": ["willis_chapter", "willis_page_start"],
                "properties": {
                    "willis_chapter": {"type": "string", "minLength": 1},
                    "willis_page_start": {"type": "integer", "minimum": 1},
                },
            },
        },
    ],
}

_RELATION_OBJECT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["id", "from_entity_id", "to_entity_id", "relation_type"],
    "properties": {
        "id": {"type": "string", "minLength": 1},
        "from_entity_id": {"type": "string", "minLength": 1},
        "to_entity_id": {"type": "string", "minLength": 1},
        "relation_type": {"type": "string", "minLength": 1},
        "notes": {"type": ["string", "null"]},
    },
    "additionalProperties": False,
}

CANONICAL_SCHEMA: Final[dict[str, Any]] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Far Country canonical export",
    "type": "object",
    "required": [
        "schema_version",
        "generated_at",
        "entities",
        "descriptors",
        "citations",
        "relations",
    ],
    "properties": {
        "schema_version": {"type": "string", "pattern": r"^\d+\.\d+\.\d+$"},
        "generated_at": {"type": "string", "minLength": 1},
        "entities": {"type": "array", "items": _ENTITY_OBJECT_SCHEMA},
        "descriptors": {"type": "array", "items": _DESCRIPTOR_OBJECT_SCHEMA},
        "citations": {"type": "array", "items": _CITATION_OBJECT_SCHEMA},
        "relations": {"type": "array", "items": _RELATION_OBJECT_SCHEMA},
    },
    "additionalProperties": False,
}


_ENTITY_INLINE_DESCRIPTOR_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["id", "statement", "tier", "citations"],
    "properties": {
        "id": {"type": "string", "minLength": 1},
        "statement": {"type": "string", "minLength": 1},
        "tier": {"enum": TIERS},
        "symbolic_referent": {"type": ["string", "null"]},
        "temporal_phase": {"oneOf": [{"enum": TEMPORAL_PHASES}, {"type": "null"}]},
        "citations": {"type": "array", "items": _CITATION_OBJECT_SCHEMA, "minItems": 1},
    },
    "additionalProperties": False,
}


ENTITY_SCHEMA: Final[dict[str, Any]] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "title": "Far Country entity export",
    "type": "object",
    "required": ["id", "name", "entity_type", "descriptors"],
    "properties": {
        "id": {"type": "string", "minLength": 1},
        "name": {"type": "string", "minLength": 1},
        "entity_type": {"enum": ENTITY_TYPES},
        "summary": {"type": ["string", "null"]},
        "descriptors": {"type": "array", "items": _ENTITY_INLINE_DESCRIPTOR_SCHEMA},
        "relations": {"type": "array", "items": _RELATION_OBJECT_SCHEMA},
    },
    "additionalProperties": False,
}


class SchemaValidationError(ValueError):
    """Raised when an export payload doesn't match the published schema."""


def _validate(payload: dict[str, Any], schema: dict[str, Any]) -> None:
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(payload), key=lambda e: e.path)  # type: ignore[arg-type]
    if errors:
        raise SchemaValidationError(_format_errors(errors))


def _format_errors(errors: list[_JSONSchemaValidationError]) -> str:
    lines = []
    for err in errors:
        path = "/".join(str(p) for p in err.path) or "<root>"
        lines.append(f"  - {path}: {err.message}")
    return "Schema validation failed:\n" + "\n".join(lines)


def validate_canonical(payload: dict[str, Any]) -> None:
    """Raise `SchemaValidationError` if `payload` doesn't match `CANONICAL_SCHEMA`."""
    _validate(payload, CANONICAL_SCHEMA)


def validate_entity(payload: dict[str, Any]) -> None:
    """Raise `SchemaValidationError` if `payload` doesn't match `ENTITY_SCHEMA`."""
    _validate(payload, ENTITY_SCHEMA)
