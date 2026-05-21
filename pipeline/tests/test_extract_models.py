"""Pydantic validation tests for the candidate-descriptor models."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from far_country.extract.models import (
    CandidateDescriptor,
    ScriptureCitationCandidate,
    WillisCitationCandidate,
)


def _make_kwargs(**overrides):
    base = dict(
        statement="The New Jerusalem comes down out of heaven from God.",
        entity_id_suggestion="new-jerusalem",
        entity_name_suggestion="The New Jerusalem",
        entity_type_suggestion="place",
        tier="clear",
        temporal_phase="final",
        citations=[
            ScriptureCitationCandidate(
                source_type="scripture", book="Revelation", chapter=21, verse_start=2
            )
        ],
    )
    base.update(overrides)
    return base


def test_valid_candidate_parses() -> None:
    c = CandidateDescriptor(**_make_kwargs())
    assert c.tier == "clear"
    assert c.citations[0].source_type == "scripture"


def test_symbolic_without_referent_rejected() -> None:
    with pytest.raises(ValidationError, match="symbolic_referent"):
        CandidateDescriptor(**_make_kwargs(tier="symbolic", symbolic_referent=None))


def test_symbolic_with_referent_accepted() -> None:
    c = CandidateDescriptor(
        **_make_kwargs(
            tier="symbolic",
            symbolic_referent="divine glory and purity",
        )
    )
    assert c.tier == "symbolic"
    assert c.symbolic_referent == "divine glory and purity"


def test_invalid_tier_rejected() -> None:
    with pytest.raises(ValidationError):
        CandidateDescriptor(**_make_kwargs(tier="bogus"))


def test_invalid_entity_type_rejected() -> None:
    with pytest.raises(ValidationError):
        CandidateDescriptor(**_make_kwargs(entity_type_suggestion="bogus"))


def test_invalid_temporal_phase_rejected() -> None:
    with pytest.raises(ValidationError):
        CandidateDescriptor(**_make_kwargs(temporal_phase="someday"))


def test_empty_citations_rejected() -> None:
    with pytest.raises(ValidationError):
        CandidateDescriptor(**_make_kwargs(citations=[]))


def test_willis_citation_parses_via_discriminator() -> None:
    payload = {
        "statement": "Heaven is the dwelling place of the redeemed.",
        "entity_id_suggestion": "heaven",
        "entity_name_suggestion": "Heaven",
        "entity_type_suggestion": "place",
        "tier": "fuzzy",
        "temporal_phase": "either",
        "citations": [
            {
                "source_type": "willis",
                "willis_chapter": "3",
                "willis_page_start": 42,
                "willis_page_end": 44,
            }
        ],
    }
    c = CandidateDescriptor.model_validate(payload)
    assert isinstance(c.citations[0], WillisCitationCandidate)
    assert c.citations[0].willis_page_end == 44


def test_mixed_citations_accepted() -> None:
    """A descriptor may carry both a Scripture and a Willis citation."""
    payload = _make_kwargs(
        citations=[
            ScriptureCitationCandidate(
                source_type="scripture", book="Revelation", chapter=21, verse_start=2
            ),
            WillisCitationCandidate(source_type="willis", willis_chapter="3", willis_page_start=42),
        ]
    )
    c = CandidateDescriptor(**payload)
    assert len(c.citations) == 2
    assert c.citations[0].source_type == "scripture"
    assert c.citations[1].source_type == "willis"
