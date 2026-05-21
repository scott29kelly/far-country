"""Tests for `far_country.store.repo` — overview counts, queue paging,
state transitions, and the edit lifecycle.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from far_country.store.models import Citation, Descriptor, Entity, ExtractionRun
from far_country.store.repo import (
    DescriptorNotFoundError,
    counts_by_status,
    counts_by_tier,
    edit_descriptor,
    get_descriptor,
    list_approved_for_entity,
    list_descriptors,
    recent_runs,
    update_review_status,
)


def _seed_entity(session: Session, *, entity_id: str = "new-jerusalem") -> Entity:
    entity = Entity(
        id=entity_id,
        name="The New Jerusalem",
        entity_type="place",
        created_at="2026-05-21T00:00:00+00:00",
        updated_at="2026-05-21T00:00:00+00:00",
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
    review_status: str = "pending",
    created_at: str = "2026-05-21T00:00:00+00:00",
    citation_verse: int = 2,
) -> Descriptor:
    # The DB check constraint requires symbolic_referent when tier='symbolic'.
    if tier == "symbolic" and symbolic_referent is None:
        symbolic_referent = "default referent for test seeding"
    descriptor = Descriptor(
        id=descriptor_id,
        entity_id=entity_id,
        statement=statement,
        tier=tier,
        symbolic_referent=symbolic_referent,
        temporal_phase="final",
        review_status=review_status,
        created_at=created_at,
        updated_at=created_at,
    )
    session.add(descriptor)
    session.add(
        Citation(
            id=f"c-{descriptor_id}",
            descriptor_id=descriptor_id,
            source_type="scripture",
            book="Revelation",
            chapter=21,
            verse_start=citation_verse,
            created_at=created_at,
        )
    )
    session.commit()
    return descriptor


# ----------------------- overview -----------------------


def test_counts_by_status_zeroes_for_empty_db(session: Session) -> None:
    counts = counts_by_status(session)
    assert counts.pending == 0
    assert counts.approved == 0
    assert counts.rejected == 0
    assert counts.needs_discussion == 0
    assert counts.total == 0


def test_counts_by_status_groups_correctly(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1", review_status="pending")
    _seed_descriptor(session, descriptor_id="d-2", review_status="approved")
    _seed_descriptor(session, descriptor_id="d-3", review_status="approved")
    _seed_descriptor(session, descriptor_id="d-4", review_status="needs-discussion")

    counts = counts_by_status(session)
    assert counts.pending == 1
    assert counts.approved == 2
    assert counts.needs_discussion == 1
    assert counts.total == 4


def test_counts_by_tier_groups_correctly(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1", tier="clear")
    _seed_descriptor(session, descriptor_id="d-2", tier="symbolic")
    _seed_descriptor(session, descriptor_id="d-3", tier="symbolic")

    counts = counts_by_tier(session)
    assert counts.clear == 1
    assert counts.symbolic == 2
    assert counts.fuzzy == 0


def test_recent_runs_returns_newest_first(session: Session) -> None:
    session.add(
        ExtractionRun(
            id="r-old",
            started_at="2026-05-19T00:00:00+00:00",
            completed_at="2026-05-19T00:01:00+00:00",
            model="claude-opus-4-7",
            prompt_version="0.1.0",
            source_scope="esv:revelation:21",
            descriptor_count=3,
        )
    )
    session.add(
        ExtractionRun(
            id="r-new",
            started_at="2026-05-21T00:00:00+00:00",
            completed_at="2026-05-21T00:01:00+00:00",
            model="claude-opus-4-7",
            prompt_version="0.1.0",
            source_scope="esv:revelation:22",
            descriptor_count=5,
        )
    )
    session.commit()

    runs = recent_runs(session, limit=10)
    assert [r.id for r in runs] == ["r-new", "r-old"]


# ----------------------- list / get -----------------------


def test_list_descriptors_filters_and_paginates(session: Session) -> None:
    _seed_entity(session)
    for i in range(5):
        _seed_descriptor(
            session,
            descriptor_id=f"d-{i}",
            review_status="pending",
            citation_verse=i + 1,
            created_at=f"2026-05-{20 + i:02d}T00:00:00+00:00",
        )
    # Two approved that shouldn't appear in default filter.
    _seed_descriptor(session, descriptor_id="d-a1", review_status="approved", citation_verse=10)

    rows, total = list_descriptors(session, status="pending", page=1, page_size=3)
    assert total == 5
    assert len(rows) == 3
    # Oldest-first ordering.
    assert [r.descriptor.id for r in rows] == ["d-0", "d-1", "d-2"]

    rows_p2, _ = list_descriptors(session, status="pending", page=2, page_size=3)
    assert [r.descriptor.id for r in rows_p2] == ["d-3", "d-4"]


def test_list_descriptors_with_status_none_returns_all(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1", review_status="pending")
    _seed_descriptor(session, descriptor_id="d-2", review_status="approved")

    _rows, total = list_descriptors(session, status=None)
    assert total == 2


def test_get_descriptor_returns_entity_and_citations(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1")
    context = get_descriptor(session, "d-1")
    assert context is not None
    assert context.entity.id == "new-jerusalem"
    assert len(context.citations) == 1
    assert context.citations[0].book == "Revelation"


def test_get_descriptor_missing_returns_none(session: Session) -> None:
    assert get_descriptor(session, "does-not-exist") is None


def test_list_approved_for_entity_only_returns_approved(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1", review_status="approved")
    _seed_descriptor(session, descriptor_id="d-2", review_status="pending")

    entity, rows = list_approved_for_entity(session, "new-jerusalem")
    assert entity is not None
    assert [r.descriptor.id for r in rows] == ["d-1"]


def test_list_approved_for_entity_missing_returns_empty(session: Session) -> None:
    entity, rows = list_approved_for_entity(session, "ghost-entity")
    assert entity is None
    assert rows == []


# ----------------------- state transitions -----------------------


def test_update_review_status_flips_status_and_appends_notes(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1")

    updated = update_review_status(session, "d-1", "approved", reviewer_notes="Looks great.")
    assert updated.review_status == "approved"
    assert "Looks great." in (updated.reviewer_notes or "")

    again = update_review_status(
        session, "d-1", "needs-discussion", reviewer_notes="Actually wait."
    )
    assert again.review_status == "needs-discussion"
    # Both notes survive — newest at the bottom.
    assert "Looks great." in (again.reviewer_notes or "")
    assert "Actually wait." in (again.reviewer_notes or "")


def test_update_review_status_raises_on_missing(session: Session) -> None:
    import pytest

    with pytest.raises(DescriptorNotFoundError):
        update_review_status(session, "no-such-id", "approved")


def test_edit_descriptor_returns_to_pending(session: Session) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1", review_status="approved")

    updated = edit_descriptor(session, "d-1", statement="A better statement.")
    assert updated.statement == "A better statement."
    assert updated.review_status == "pending"


def test_edit_descriptor_clears_symbolic_referent_when_tier_changes(
    session: Session,
) -> None:
    _seed_entity(session)
    _seed_descriptor(session, descriptor_id="d-1", tier="symbolic")
    descriptor = session.get(Descriptor, "d-1")
    assert descriptor is not None
    descriptor.symbolic_referent = "divine glory"
    session.commit()

    updated = edit_descriptor(session, "d-1", tier="clear")
    assert updated.tier == "clear"
    assert updated.symbolic_referent is None
