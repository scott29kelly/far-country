"""Build and write the canonical JSON export."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from far_country.store.models import (
    Citation,
    Descriptor,
    Entity,
    EntityRelation,
    Measurement,
    MeasurementCitation,
)

# 0.2.0: per-entity exports gain an optional `measurements` array, and an
# entity qualifies for export with approved measurements alone (ADR 0017 —
# the dwelling-campus zones carry cited measurements before any descriptor
# is extracted for them). Additive; canonical.json is unchanged.
SCHEMA_VERSION: Final = "0.2.0"


@dataclass(frozen=True)
class CanonicalExport:
    """The shape of `data/exports/canonical.json` (see `docs/data-model.md` §4)."""

    schema_version: str
    generated_at: str
    entities: list[dict[str, Any]]
    descriptors: list[dict[str, Any]]
    citations: list[dict[str, Any]]
    relations: list[dict[str, Any]]

    def to_dict(self) -> dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "generated_at": self.generated_at,
            "entities": self.entities,
            "descriptors": self.descriptors,
            "citations": self.citations,
            "relations": self.relations,
        }


@dataclass(frozen=True)
class EntityExport:
    """The shape of `data/exports/entities/<slug>.json`."""

    id: str
    name: str
    entity_type: str
    summary: str | None
    descriptors: list[dict[str, Any]]
    relations: list[dict[str, Any]]
    measurements: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "entity_type": self.entity_type,
            "summary": self.summary,
            "descriptors": self.descriptors,
            "relations": self.relations,
        }
        # additive: only entities that carry measurements emit the key, so
        # every pre-0.2.0 file round-trips byte-identical
        if self.measurements:
            payload["measurements"] = self.measurements
        return payload


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _entity_dict(entity: Entity) -> dict[str, Any]:
    return {
        "id": entity.id,
        "name": entity.name,
        "entity_type": entity.entity_type,
        "summary": entity.summary,
    }


def _citation_dict(citation: Citation) -> dict[str, Any]:
    """Render a Citation row as JSON, omitting fields irrelevant to its type."""
    base: dict[str, Any] = {
        "id": citation.id,
        "descriptor_id": citation.descriptor_id,
        "source_type": citation.source_type,
    }
    if citation.source_type == "scripture":
        base.update(
            {
                "book": citation.book,
                "chapter": citation.chapter,
                "verse_start": citation.verse_start,
                "verse_end": citation.verse_end,
            }
        )
    elif citation.source_type == "willis":
        base.update(
            {
                "willis_chapter": citation.willis_chapter,
                "willis_page_start": citation.willis_page_start,
                "willis_page_end": citation.willis_page_end,
            }
        )
    else:  # secondary
        base.update(
            {
                "secondary_work": citation.secondary_work,
                "secondary_locator": citation.secondary_locator,
                "quote": citation.quote,
            }
        )
    return base


def _descriptor_dict(descriptor: Descriptor) -> dict[str, Any]:
    return {
        "id": descriptor.id,
        "entity_id": descriptor.entity_id,
        "statement": descriptor.statement,
        "tier": descriptor.tier,
        "symbolic_referent": descriptor.symbolic_referent,
        "temporal_phase": descriptor.temporal_phase,
    }


def _entity_descriptor_dict(descriptor: Descriptor) -> dict[str, Any]:
    """Per-entity descriptor shape: drops entity_id, embeds citations inline."""
    return {
        "id": descriptor.id,
        "statement": descriptor.statement,
        "tier": descriptor.tier,
        "symbolic_referent": descriptor.symbolic_referent,
        "temporal_phase": descriptor.temporal_phase,
        "citations": [_citation_dict(c) for c in descriptor.citations],
    }


def _measurement_citation_dict(citation: MeasurementCitation) -> dict[str, Any]:
    base: dict[str, Any] = {
        "id": citation.id,
        "measurement_id": citation.measurement_id,
        "source_type": citation.source_type,
    }
    if citation.source_type == "scripture":
        base.update(
            {
                "book": citation.book,
                "chapter": citation.chapter,
                "verse_start": citation.verse_start,
                "verse_end": citation.verse_end,
            }
        )
    elif citation.source_type == "willis":
        base.update(
            {
                "willis_chapter": citation.willis_chapter,
                "willis_page_start": citation.willis_page_start,
                "willis_page_end": citation.willis_page_end,
            }
        )
    else:  # secondary
        base.update(
            {
                "secondary_work": citation.secondary_work,
                "secondary_locator": citation.secondary_locator,
                "quote": citation.quote,
            }
        )
    return base


def _entity_measurement_dict(measurement: Measurement) -> dict[str, Any]:
    """Per-entity measurement shape: drops entity_id, embeds citations inline."""
    return {
        "id": measurement.id,
        "subject": measurement.subject,
        "dimension": measurement.dimension,
        "value": measurement.value,
        "unit": measurement.unit,
        "basis": measurement.basis,
        "tier": measurement.tier,
        "notes": measurement.notes,
        "citations": [_measurement_citation_dict(c) for c in measurement.citations],
    }


def _relation_dict(relation: EntityRelation) -> dict[str, Any]:
    return {
        "id": relation.id,
        "from_entity_id": relation.from_entity_id,
        "to_entity_id": relation.to_entity_id,
        "relation_type": relation.relation_type,
        "notes": relation.notes,
    }


def build_canonical_export(
    session: Session,
    *,
    include_pending: bool = False,
    now: str | None = None,
) -> CanonicalExport:
    """Assemble the canonical export from the live store.

    Approved-only by default; `include_pending=True` widens the filter
    to every status (useful for debugging snapshots, never for shipping).
    """
    approved_filter = Descriptor.review_status == "approved" if not include_pending else None

    descriptor_stmt = select(Descriptor).options(selectinload(Descriptor.citations))
    if approved_filter is not None:
        descriptor_stmt = descriptor_stmt.where(approved_filter)
    descriptor_stmt = descriptor_stmt.order_by(Descriptor.entity_id, Descriptor.created_at)
    descriptors = list(session.scalars(descriptor_stmt).unique())

    # Only export entities that have at least one exported descriptor: an
    # entity with no approved content adds noise to consumers.
    entity_ids = {d.entity_id for d in descriptors}
    entity_stmt = select(Entity).where(Entity.id.in_(entity_ids)).order_by(Entity.id)
    entities = list(session.scalars(entity_stmt))

    citations: list[Citation] = []
    for descriptor in descriptors:
        citations.extend(descriptor.citations)

    relation_stmt = (
        select(EntityRelation)
        .where(
            EntityRelation.from_entity_id.in_(entity_ids),
            EntityRelation.to_entity_id.in_(entity_ids),
        )
        .order_by(EntityRelation.id)
    )
    relations = list(session.scalars(relation_stmt))

    return CanonicalExport(
        schema_version=SCHEMA_VERSION,
        generated_at=now or _now(),
        entities=[_entity_dict(e) for e in entities],
        descriptors=[_descriptor_dict(d) for d in descriptors],
        citations=[_citation_dict(c) for c in citations],
        relations=[_relation_dict(r) for r in relations],
    )


def build_entity_exports(
    session: Session,
    *,
    include_pending: bool = False,
) -> list[EntityExport]:
    """Per-entity JSON in the read-shape consumed by the browse UI.

    An entity qualifies with at least one exported descriptor OR at least
    one exported measurement (ADR 0017: measurements carry the same
    citation/tier/review discipline, so a measurement-only zone entity is
    approved content, not noise).
    """
    approved_filter = Descriptor.review_status == "approved" if not include_pending else None

    descriptor_stmt = select(Descriptor).options(selectinload(Descriptor.citations))
    if approved_filter is not None:
        descriptor_stmt = descriptor_stmt.where(approved_filter)
    descriptor_stmt = descriptor_stmt.order_by(
        Descriptor.entity_id, Descriptor.tier, Descriptor.created_at
    )
    descriptors = list(session.scalars(descriptor_stmt).unique())

    descriptors_by_entity: dict[str, list[Descriptor]] = {}
    for d in descriptors:
        descriptors_by_entity.setdefault(d.entity_id, []).append(d)

    measurement_stmt = select(Measurement).options(selectinload(Measurement.citations))
    if not include_pending:
        measurement_stmt = measurement_stmt.where(Measurement.review_status == "approved")
    measurement_stmt = measurement_stmt.order_by(Measurement.entity_id, Measurement.id)
    measurements = list(session.scalars(measurement_stmt).unique())

    measurements_by_entity: dict[str, list[Measurement]] = {}
    for m in measurements:
        measurements_by_entity.setdefault(m.entity_id, []).append(m)

    entity_ids = list(descriptors_by_entity.keys() | measurements_by_entity.keys())
    entity_stmt = select(Entity).where(Entity.id.in_(entity_ids)).order_by(Entity.id)
    entities = list(session.scalars(entity_stmt))

    relation_stmt = select(EntityRelation).where(
        EntityRelation.from_entity_id.in_(entity_ids) | EntityRelation.to_entity_id.in_(entity_ids)
    )
    relations_all = list(session.scalars(relation_stmt))

    exports: list[EntityExport] = []
    for entity in entities:
        owned_relations = [
            r for r in relations_all if r.from_entity_id == entity.id or r.to_entity_id == entity.id
        ]
        exports.append(
            EntityExport(
                id=entity.id,
                name=entity.name,
                entity_type=entity.entity_type,
                summary=entity.summary,
                descriptors=[
                    _entity_descriptor_dict(d) for d in descriptors_by_entity.get(entity.id, [])
                ],
                relations=[_relation_dict(r) for r in owned_relations],
                measurements=[
                    _entity_measurement_dict(m) for m in measurements_by_entity.get(entity.id, [])
                ],
            )
        )
    return exports


def write_canonical_export(
    session: Session,
    out_dir: Path,
    *,
    include_pending: bool = False,
) -> dict[str, Path]:
    """Write canonical.json + entities/<slug>.json into `out_dir`.

    Returns a dict mapping a short label to each path written, so the
    CLI can echo the result and the manifest writer can pick up counts.
    """
    now = _now()
    canonical = build_canonical_export(session, include_pending=include_pending, now=now)
    entity_exports = build_entity_exports(session, include_pending=include_pending)

    out_dir.mkdir(parents=True, exist_ok=True)
    entities_dir = out_dir / "entities"
    entities_dir.mkdir(parents=True, exist_ok=True)

    written: dict[str, Path] = {}

    canonical_path = out_dir / "canonical.json"
    canonical_path.write_text(
        json.dumps(canonical.to_dict(), indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )
    written["canonical"] = canonical_path

    for export in entity_exports:
        path = entities_dir / f"{export.id}.json"
        path.write_text(
            json.dumps(export.to_dict(), indent=2, sort_keys=False) + "\n",
            encoding="utf-8",
        )
        written[f"entity:{export.id}"] = path

    return written
