"""Schema integrity tests for the canonical store.

These verify the migration produces a schema with the expected tables, columns,
and constraints — and that ORM inserts respect those constraints.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import Engine, inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from far_country.store import Citation, Descriptor, Entity


def _now() -> str:
    return datetime.now(UTC).isoformat()


EXPECTED_TABLES = {
    "entity",
    "descriptor",
    "citation",
    "entity_relation",
    "extraction_run",
}

EXPECTED_INDEXES = {
    "idx_descriptor_entity",
    "idx_descriptor_tier",
    "idx_descriptor_status",
    "idx_citation_descriptor",
}


def test_migration_creates_expected_tables(engine: Engine) -> None:
    insp = inspect(engine)
    assert EXPECTED_TABLES.issubset(set(insp.get_table_names()))


def test_migration_creates_expected_indexes(engine: Engine) -> None:
    insp = inspect(engine)
    actual: set[str] = set()
    for table in EXPECTED_TABLES:
        for idx in insp.get_indexes(table):
            if idx.get("name"):
                actual.add(idx["name"])
    assert EXPECTED_INDEXES.issubset(actual)


def test_init_db_is_idempotent(engine: Engine) -> None:
    from far_country.store import init_db

    applied_again = init_db(engine)
    assert applied_again, "init_db should still report the migrations it applied"


def test_insert_clear_descriptor_with_citation(session: Session) -> None:
    now = _now()
    entity = Entity(
        id="new-jerusalem",
        name="The New Jerusalem",
        entity_type="place",
        summary="The eternal city of God, descending out of heaven.",
        created_at=now,
        updated_at=now,
    )
    descriptor = Descriptor(
        id="d-1",
        entity_id="new-jerusalem",
        statement="The New Jerusalem comes down out of heaven from God.",
        tier="clear",
        temporal_phase="final",
        review_status="pending",
        created_at=now,
        updated_at=now,
    )
    citation = Citation(
        id="c-1",
        descriptor_id="d-1",
        source_type="scripture",
        book="Revelation",
        chapter=21,
        verse_start=2,
        created_at=now,
    )
    session.add_all([entity, descriptor, citation])
    session.commit()

    loaded = session.get(Descriptor, "d-1")
    assert loaded is not None
    assert loaded.entity.name == "The New Jerusalem"
    assert len(loaded.citations) == 1
    assert loaded.citations[0].book == "Revelation"


def test_symbolic_descriptor_requires_referent(session: Session) -> None:
    now = _now()
    session.add(
        Entity(
            id="streets-of-gold",
            name="Streets of gold",
            entity_type="thing",
            created_at=now,
            updated_at=now,
        )
    )
    session.flush()

    bad = Descriptor(
        id="d-bad",
        entity_id="streets-of-gold",
        statement="The streets of the city are pure gold.",
        tier="symbolic",
        symbolic_referent=None,
        temporal_phase="final",
        review_status="pending",
        created_at=now,
        updated_at=now,
    )
    session.add(bad)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_invalid_tier_rejected(session: Session) -> None:
    now = _now()
    session.add(Entity(id="x", name="x", entity_type="thing", created_at=now, updated_at=now))
    session.flush()

    session.add(
        Descriptor(
            id="d-x",
            entity_id="x",
            statement="...",
            tier="not-a-real-tier",
            temporal_phase="final",
            review_status="pending",
            created_at=now,
            updated_at=now,
        )
    )
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_invalid_entity_type_rejected(session: Session) -> None:
    now = _now()
    session.add(
        Entity(
            id="bad",
            name="bad",
            entity_type="not-a-real-type",
            created_at=now,
            updated_at=now,
        )
    )
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_review_status_defaults_to_pending(session: Session) -> None:
    """When the column is omitted, SQLite applies the column DEFAULT."""
    now = _now()
    session.add(Entity(id="e1", name="e1", entity_type="thing", created_at=now, updated_at=now))
    session.flush()
    # Use raw SQL to omit review_status entirely and exercise the DEFAULT clause.
    session.execute(
        text(
            "INSERT INTO descriptor "
            "(id, entity_id, statement, tier, temporal_phase, created_at, updated_at) "
            "VALUES (:id, :eid, :stmt, :tier, :phase, :now, :now)"
        ),
        {
            "id": "d-default",
            "eid": "e1",
            "stmt": "...",
            "tier": "clear",
            "phase": "final",
            "now": now,
        },
    )
    session.commit()
    loaded = session.get(Descriptor, "d-default")
    assert loaded is not None
    assert loaded.review_status == "pending"


def test_foreign_keys_enforced(session: Session) -> None:
    now = _now()
    orphan = Descriptor(
        id="orphan",
        entity_id="does-not-exist",
        statement="...",
        tier="clear",
        temporal_phase="final",
        review_status="pending",
        created_at=now,
        updated_at=now,
    )
    session.add(orphan)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()
