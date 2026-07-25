"""Tests for the canonical JSON export — payload shape, filtering, schema."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy.orm import Session

from far_country.export import (
    SCHEMA_VERSION,
    SchemaValidationError,
    build_canonical_export,
    build_entity_exports,
    validate_canonical,
    validate_entity,
    write_canonical_export,
    write_manifest,
)
from far_country.store.models import (
    Citation,
    Descriptor,
    Entity,
    EntityRelation,
)

NOW = "2026-05-21T00:00:00+00:00"


def _seed_entity(
    session: Session,
    *,
    entity_id: str = "new-jerusalem",
    name: str = "The New Jerusalem",
    entity_type: str = "place",
    summary: str | None = None,
) -> Entity:
    entity = Entity(
        id=entity_id,
        name=name,
        entity_type=entity_type,
        summary=summary,
        created_at=NOW,
        updated_at=NOW,
    )
    session.add(entity)
    session.commit()
    return entity


def _seed_descriptor(
    session: Session,
    *,
    descriptor_id: str,
    entity_id: str = "new-jerusalem",
    statement: str = "The New Jerusalem comes down out of heaven from God.",
    tier: str = "clear",
    symbolic_referent: str | None = None,
    temporal_phase: str | None = "final",
    review_status: str = "approved",
    verse_start: int = 2,
    verse_end: int | None = None,
    citation_source: str = "scripture",
    willis_chapter: str = "3",
    willis_page_start: int = 42,
) -> Descriptor:
    if tier == "symbolic" and symbolic_referent is None:
        symbolic_referent = "default test referent"
    descriptor = Descriptor(
        id=descriptor_id,
        entity_id=entity_id,
        statement=statement,
        tier=tier,
        symbolic_referent=symbolic_referent,
        temporal_phase=temporal_phase,
        review_status=review_status,
        created_at=NOW,
        updated_at=NOW,
    )
    session.add(descriptor)
    if citation_source == "scripture":
        session.add(
            Citation(
                id=f"c-{descriptor_id}",
                descriptor_id=descriptor_id,
                source_type="scripture",
                book="Revelation",
                chapter=21,
                verse_start=verse_start,
                verse_end=verse_end,
                created_at=NOW,
            )
        )
    elif citation_source == "willis":
        session.add(
            Citation(
                id=f"c-{descriptor_id}",
                descriptor_id=descriptor_id,
                source_type="willis",
                willis_chapter=willis_chapter,
                willis_page_start=willis_page_start,
                created_at=NOW,
            )
        )
    elif citation_source == "secondary":
        session.add(
            Citation(
                id=f"c-{descriptor_id}",
                descriptor_id=descriptor_id,
                source_type="secondary",
                secondary_work="Alcorn, Heaven",
                secondary_locator="ch. 3",
                created_at=NOW,
            )
        )
    session.commit()
    return descriptor


# ----------------------- build_canonical_export -----------------------


def test_canonical_export_includes_only_approved_by_default(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1", review_status="approved")
    _seed_descriptor(session, descriptor_id="d-2", review_status="pending", verse_start=3)
    _seed_descriptor(session, descriptor_id="d-3", review_status="rejected", verse_start=4)

    payload = build_canonical_export(session)
    assert payload.schema_version == SCHEMA_VERSION
    assert len(payload.descriptors) == 1
    assert payload.descriptors[0]["id"] == "d-1"
    # The entity appears because it has an approved descriptor.
    assert [e["id"] for e in payload.entities] == ["new-jerusalem"]
    assert len(payload.citations) == 1


def test_canonical_export_skips_entities_with_no_approved_descriptors(
    session: Session,
) -> None:
    _seed_entity(session, entity_id="new-jerusalem")
    _seed_entity(session, entity_id="empty-entity", name="Empty Entity")
    _seed_descriptor(session, descriptor_id="d-1", entity_id="new-jerusalem")
    # No descriptors for empty-entity.

    payload = build_canonical_export(session)
    assert {e["id"] for e in payload.entities} == {"new-jerusalem"}


def test_canonical_export_include_pending_widens_filter(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1", review_status="approved")
    _seed_descriptor(session, descriptor_id="d-2", review_status="pending", verse_start=3)

    payload = build_canonical_export(session, include_pending=True)
    assert {d["id"] for d in payload.descriptors} == {"d-1", "d-2"}


def test_canonical_export_emits_only_relevant_citation_fields(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-scrip", citation_source="scripture", verse_start=2)
    _seed_descriptor(
        session,
        descriptor_id="d-will",
        statement="Willis interprets the wedding feast.",
        citation_source="willis",
    )
    payload = build_canonical_export(session)

    by_type = {c["source_type"]: c for c in payload.citations}
    assert by_type["scripture"]["book"] == "Revelation"
    assert "willis_chapter" not in by_type["scripture"]
    assert "book" not in by_type["willis"]
    assert by_type["willis"]["willis_chapter"] == "3"


def test_canonical_export_includes_relations_when_both_entities_exported(
    session: Session,
) -> None:
    _seed_entity(session, entity_id="new-jerusalem")
    _seed_entity(session, entity_id="throne", name="The Throne", entity_type="place")
    _seed_descriptor(session, descriptor_id="d-1", entity_id="new-jerusalem")
    _seed_descriptor(
        session,
        descriptor_id="d-2",
        entity_id="throne",
        statement="The throne stands at the city's center.",
        verse_start=3,
    )
    session.add(
        EntityRelation(
            id="r-1",
            from_entity_id="throne",
            to_entity_id="new-jerusalem",
            relation_type="located-in",
            created_at=NOW,
        )
    )
    session.commit()

    payload = build_canonical_export(session)
    assert len(payload.relations) == 1
    assert payload.relations[0]["from_entity_id"] == "throne"


# ----------------------- per-entity exports -----------------------


def test_entity_exports_inline_citations_per_descriptor(session: Session) -> None:
    _seed_entity(session, summary="The eternal city of God.")
    _seed_descriptor(session, descriptor_id="d-1")
    _seed_descriptor(
        session,
        descriptor_id="d-2",
        statement="The walls of the New Jerusalem are jasper.",
        tier="clear",
        verse_start=18,
    )

    exports = build_entity_exports(session)
    assert len(exports) == 1
    new_jerusalem = exports[0]
    assert new_jerusalem.id == "new-jerusalem"
    assert new_jerusalem.summary == "The eternal city of God."

    serialised = new_jerusalem.to_dict()
    assert {d["id"] for d in serialised["descriptors"]} == {"d-1", "d-2"}
    for d in serialised["descriptors"]:
        assert len(d["citations"]) == 1
        assert "entity_id" not in d  # entity-shape drops entity_id


# ----------------------- schema validation -----------------------


def test_validate_canonical_accepts_well_formed_payload(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1")
    payload = build_canonical_export(session).to_dict()
    validate_canonical(payload)  # no exception


def test_validate_canonical_rejects_missing_required_field() -> None:
    payload = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": "2026-05-21T00:00:00Z",
        # missing 'entities'
        "descriptors": [],
        "citations": [],
        "relations": [],
    }
    with pytest.raises(SchemaValidationError):
        validate_canonical(payload)


def test_validate_canonical_rejects_symbolic_descriptor_without_referent() -> None:
    payload = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": "2026-05-21T00:00:00Z",
        "entities": [{"id": "x", "name": "X", "entity_type": "place"}],
        "descriptors": [
            {
                "id": "d-1",
                "entity_id": "x",
                "statement": "Streets of gold.",
                "tier": "symbolic",
                # symbolic_referent missing
            }
        ],
        "citations": [],
        "relations": [],
    }
    with pytest.raises(SchemaValidationError):
        validate_canonical(payload)


def test_validate_canonical_rejects_unknown_tier() -> None:
    payload = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": "2026-05-21T00:00:00Z",
        "entities": [{"id": "x", "name": "X", "entity_type": "place"}],
        "descriptors": [
            {
                "id": "d-1",
                "entity_id": "x",
                "statement": "Heaven shines bright.",
                "tier": "obviously-true",
            }
        ],
        "citations": [],
        "relations": [],
    }
    with pytest.raises(SchemaValidationError):
        validate_canonical(payload)


def test_validate_entity_accepts_well_formed_payload(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1")
    exports = build_entity_exports(session)
    validate_entity(exports[0].to_dict())  # no exception


# ----------------------- write_canonical_export -----------------------


def test_write_canonical_export_writes_files(session: Session, tmp_path: Path) -> None:
    _seed_entity(session, summary="Summary text.")
    _seed_descriptor(session, descriptor_id="d-1")
    _seed_descriptor(
        session,
        descriptor_id="d-2",
        statement="The walls are jasper.",
        verse_start=18,
    )

    out_dir = tmp_path / "exports"
    written = write_canonical_export(session, out_dir)

    canonical_path = out_dir / "canonical.json"
    assert canonical_path.exists()
    canonical = json.loads(canonical_path.read_text(encoding="utf-8"))
    assert canonical["schema_version"] == SCHEMA_VERSION
    assert len(canonical["descriptors"]) == 2

    entity_path = out_dir / "entities" / "new-jerusalem.json"
    assert entity_path.exists()
    entity_payload = json.loads(entity_path.read_text(encoding="utf-8"))
    assert entity_payload["id"] == "new-jerusalem"
    assert entity_payload["summary"] == "Summary text."
    assert len(entity_payload["descriptors"]) == 2

    assert "canonical" in written
    assert "entity:new-jerusalem" in written


def test_write_manifest_records_counts(session: Session, tmp_path: Path) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1")
    out_dir = tmp_path / "exports"
    canonical = build_canonical_export(session)
    write_canonical_export(session, out_dir)
    manifest_path = write_manifest(
        out_dir,
        canonical=canonical,
        entity_filenames=["entities/new-jerusalem.json"],
    )

    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert payload["schema_version"] == SCHEMA_VERSION
    assert payload["counts"]["entities"] == 1
    assert payload["counts"]["descriptors"] == 1
    assert payload["counts"]["citations"] == 1
    assert payload["entity_files"] == ["entities/new-jerusalem.json"]


def test_entity_exports_include_measurement_only_entities(session: Session) -> None:
    """A zone entity with cited measurements and zero descriptors exports (0.2.0)."""
    from far_country.measure import seed_allotment

    seed_allotment(session, review_status="approved")
    exports = {e.id: e for e in build_entity_exports(session)}

    priests = exports["priests-portion"]
    assert priests.descriptors == []
    assert len(priests.measurements) == 2
    breadth = next(m for m in priests.measurements if m["id"] == "eza-priests-portion-breadth")
    assert breadth["value"] == 10000.0
    assert breadth["unit"] == "long-cubit"
    assert breadth["citations"], "embedded measurements carry their citations"
    assert breadth["citations"][0]["book"] == "Ezekiel"

    validate_entity(priests.to_dict())

    # a measurement-only entity never emits an empty measurements key
    assert "measurements" in priests.to_dict()


def test_measurement_only_entities_enter_canonical_entities(session: Session) -> None:
    """0.3.0: canonical.json indexes entities grounded by measurements alone.

    They are approved, cited, tiered content (ADR 0017), so the browse index
    must be able to find them — the pre-0.3.0 export left them reachable only
    as per-entity files.
    """
    from far_country.measure import seed_allotment

    seed_allotment(session, review_status="approved")
    canonical = build_canonical_export(session)

    ids = {e["id"] for e in canonical.entities}
    assert "priests-portion" in ids
    assert "levites-portion" in ids


def test_measurement_only_entities_add_no_descriptors_to_canonical(
    session: Session,
) -> None:
    """The grounding contract is unchanged: descriptors stay descriptor-driven.

    Q&A retrieval embeds `canonical.descriptors`, so a measurement-only entity
    must contribute zero rows — otherwise "every answer cites a descriptor"
    would start resting on records that are not descriptors.
    """
    from far_country.measure import seed_allotment

    seed_allotment(session, review_status="approved")
    canonical = build_canonical_export(session)

    assert canonical.entities, "guard: the entities did enter the export"
    assert canonical.descriptors == []
    assert canonical.citations == []


def test_pending_measurements_do_not_enter_canonical(session: Session) -> None:
    """Only approved measurements qualify an entity — review discipline holds."""
    from far_country.measure import seed_allotment

    seed_allotment(session, review_status="pending")
    canonical = build_canonical_export(session)
    assert canonical.entities == []


def test_pending_measurements_not_exported(session: Session) -> None:
    from far_country.measure import seed_allotment

    seed_allotment(session, review_status="pending")
    assert build_entity_exports(session) == []


def test_descriptor_only_entity_export_shape_unchanged(session: Session) -> None:
    """Pre-0.2.0 files round-trip: no measurements key when there are none."""
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1")
    export = build_entity_exports(session)[0]
    payload = export.to_dict()
    assert "measurements" not in payload
    validate_entity(payload)


def test_validate_entity_rejects_contentless_export() -> None:
    with pytest.raises(SchemaValidationError):
        validate_entity(
            {
                "id": "empty-zone",
                "name": "Empty Zone",
                "entity_type": "place",
                "summary": None,
                "descriptors": [],
                "relations": [],
            }
        )
