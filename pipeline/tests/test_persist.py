"""Tests for `persist_extraction` — writing candidates to the canonical store."""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from far_country.extract.extractor import ExtractionResult
from far_country.extract.models import (
    CandidateDescriptor,
    ScriptureCitationCandidate,
    WillisCitationCandidate,
)
from far_country.extract.persist import persist_extraction
from far_country.store.models import Citation, Descriptor, Entity, ExtractionRun


def _scripture(
    book: str = "Revelation",
    chapter: int = 21,
    vs: int = 2,
    ve: int | None = None,
) -> ScriptureCitationCandidate:
    return ScriptureCitationCandidate(
        source_type="scripture",
        book=book,
        chapter=chapter,
        verse_start=vs,
        verse_end=ve,
    )


def _candidate(**overrides) -> CandidateDescriptor:
    payload = dict(
        statement="The New Jerusalem comes down out of heaven from God.",
        entity_id_suggestion="new-jerusalem",
        entity_name_suggestion="The New Jerusalem",
        entity_type_suggestion="place",
        tier="clear",
        symbolic_referent=None,
        temporal_phase="final",
        citations=[_scripture()],
    )
    payload.update(overrides)
    return CandidateDescriptor(**payload)


def _result(candidates: list[CandidateDescriptor], **overrides) -> ExtractionResult:
    payload = dict(
        candidates=candidates,
        prompt_version="0.1.0",
        model="claude-opus-4-7",
        source_scope="esv:revelation:21",
        raw_response="[{...}]",
    )
    payload.update(overrides)
    return ExtractionResult(**payload)


def test_persist_writes_entity_descriptor_citation_and_run(session: Session) -> None:
    outcome = persist_extraction(session, _result([_candidate()]))

    entity = session.get(Entity, "new-jerusalem")
    assert entity is not None
    assert entity.name == "The New Jerusalem"
    assert entity.entity_type == "place"

    descriptors = session.scalars(select(Descriptor)).all()
    assert len(descriptors) == 1
    descriptor = descriptors[0]
    assert descriptor.review_status == "pending"
    assert descriptor.tier == "clear"
    assert descriptor.entity_id == "new-jerusalem"

    provenance = json.loads(descriptor.provenance)
    assert provenance["run_id"] == outcome.run_id
    assert provenance["prompt_version"] == "0.1.0"
    assert provenance["source_scope"] == "esv:revelation:21"
    assert provenance["model"] == "claude-opus-4-7"
    assert "raw_response_hash" in provenance

    citations = session.scalars(select(Citation)).all()
    assert len(citations) == 1
    assert citations[0].descriptor_id == descriptor.id
    assert citations[0].source_type == "scripture"
    assert citations[0].book == "Revelation"
    assert citations[0].chapter == 21
    assert citations[0].verse_start == 2

    runs = session.scalars(select(ExtractionRun)).all()
    assert len(runs) == 1
    assert runs[0].id == outcome.run_id
    assert runs[0].descriptor_count == 1
    assert runs[0].source_scope == "esv:revelation:21"

    assert outcome.inserted_entities == ["new-jerusalem"]
    assert len(outcome.inserted_descriptor_ids) == 1
    assert outcome.candidates_total == 1


def test_persist_writes_multiple_citations_per_descriptor(session: Session) -> None:
    candidate = _candidate(
        citations=[
            _scripture(vs=2),
            WillisCitationCandidate(
                source_type="willis",
                willis_chapter="3",
                willis_page_start=42,
                willis_page_end=44,
            ),
        ]
    )
    persist_extraction(session, _result([candidate]))

    citations = session.scalars(select(Citation)).all()
    assert len(citations) == 2
    types = sorted(c.source_type for c in citations)
    assert types == ["scripture", "willis"]
    willis_cite = next(c for c in citations if c.source_type == "willis")
    assert willis_cite.willis_chapter == "3"
    assert willis_cite.willis_page_start == 42
    assert willis_cite.willis_page_end == 44


def test_persist_is_idempotent_on_rerun(session: Session) -> None:
    first = persist_extraction(session, _result([_candidate()]))
    second = persist_extraction(session, _result([_candidate()]))

    assert len(first.inserted_descriptor_ids) == 1
    assert len(second.inserted_descriptor_ids) == 0
    assert second.skipped_duplicate_statements == [
        "The New Jerusalem comes down out of heaven from God."
    ]

    assert len(session.scalars(select(Descriptor)).all()) == 1
    assert len(session.scalars(select(Citation)).all()) == 1
    # Both runs are recorded even though the second wrote no descriptors.
    runs = session.scalars(select(ExtractionRun)).all()
    assert len(runs) == 2
    second_run = session.get(ExtractionRun, second.run_id)
    assert second_run is not None
    assert second_run.descriptor_count == 0


def test_persist_writes_run_row_even_with_empty_candidates(session: Session) -> None:
    outcome = persist_extraction(session, _result([]))

    assert outcome.inserted_entities == []
    assert outcome.inserted_descriptor_ids == []
    runs = session.scalars(select(ExtractionRun)).all()
    assert len(runs) == 1
    assert runs[0].id == outcome.run_id
    assert runs[0].descriptor_count == 0


def test_persist_reuses_existing_entity(session: Session) -> None:
    session.add(
        Entity(
            id="new-jerusalem",
            name="Pre-existing Display Name",
            entity_type="place",
            summary="Set by hand before extraction.",
            created_at="2026-05-21T00:00:00+00:00",
            updated_at="2026-05-21T00:00:00+00:00",
        )
    )
    session.commit()

    outcome = persist_extraction(session, _result([_candidate()]))

    assert outcome.inserted_entities == []  # entity was reused, not created
    entity = session.get(Entity, "new-jerusalem")
    assert entity is not None
    # We don't overwrite an existing entity's display name from a candidate.
    assert entity.name == "Pre-existing Display Name"
    assert len(session.scalars(select(Descriptor)).all()) == 1


def test_persist_keeps_distinct_descriptors_on_different_citations(
    session: Session,
) -> None:
    persist_extraction(
        session,
        _result(
            [
                _candidate(statement="Heaven has no temple.", citations=[_scripture(vs=22)]),
                _candidate(statement="Heaven has no temple.", citations=[_scripture(vs=23)]),
            ]
        ),
    )
    descriptors = session.scalars(select(Descriptor)).all()
    assert len(descriptors) == 2
    citations = session.scalars(select(Citation)).all()
    assert len(citations) == 2
    assert {c.verse_start for c in citations} == {22, 23}


def test_persist_collapses_duplicate_candidates_within_one_batch(session: Session) -> None:
    """Same (entity, citation, normalized statement) appearing twice in
    the LLM output should only write one row."""
    a = _candidate(statement="The walls of the New Jerusalem are made of jasper.")
    b = _candidate(statement="THE WALLS of the New Jerusalem are made of jasper")
    outcome = persist_extraction(session, _result([a, b]))

    assert len(outcome.inserted_descriptor_ids) == 1
    assert outcome.skipped_duplicate_statements == [
        "THE WALLS of the New Jerusalem are made of jasper"
    ]
    assert len(session.scalars(select(Descriptor)).all()) == 1


def test_persist_symbolic_descriptor_round_trips_referent(session: Session) -> None:
    candidate = _candidate(
        statement="The street of the city is pure gold, like transparent glass.",
        tier="symbolic",
        symbolic_referent="divine glory, supreme value, and purity",
        citations=[_scripture(vs=21)],
    )
    persist_extraction(session, _result([candidate]))

    descriptor = session.scalars(select(Descriptor)).one()
    assert descriptor.tier == "symbolic"
    assert descriptor.symbolic_referent == "divine glory, supreme value, and purity"
