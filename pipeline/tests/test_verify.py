"""Tests for citation verification — keyword overlap + judge integration."""

from __future__ import annotations

import json

import pytest

from far_country.store.models import Citation, Descriptor, Entity
from far_country.verify.citation_check import (
    JudgeError,
    VerificationResult,
    classify_score,
    content_tokens,
    keyword_overlap_score,
    verify_citation,
    verify_descriptor,
)

# ----------------------- content_tokens -----------------------


def test_content_tokens_drops_stopwords_and_punctuation() -> None:
    tokens = content_tokens("The walls of the New Jerusalem are made of jasper.")
    # 'the', 'of', 'are' are stopwords; nothing else dropped.
    # Light stemmer strips trailing 's' from 'walls'.
    assert tokens == ["wall", "new", "jerusalem", "made", "jasper"]


def test_content_tokens_strips_esv_verse_markers() -> None:
    tokens = content_tokens("[2] And I saw the holy city")
    # 'and', 'i', 'the' are stopwords, "2" is dropped as a digit.
    assert tokens == ["saw", "holy", "city"]


def test_content_tokens_handles_possessives() -> None:
    a = content_tokens("God's throne")
    b = content_tokens("Gods throne")
    assert a == b


# ----------------------- keyword_overlap_score -----------------------


def test_overlap_score_full_match_is_one() -> None:
    statement = "The walls are jasper."
    source = "The walls are jasper. And the city is gold."
    assert keyword_overlap_score(statement, source) == pytest.approx(1.0)


def test_overlap_score_no_match_is_zero() -> None:
    statement = "Trumpets and crowns abound."
    source = "Cabbages and turnips abound."
    score = keyword_overlap_score(statement, source)
    assert score == pytest.approx(1 / 3)  # 'abound' matches, 'trumpet'/'crown' don't


def test_overlap_score_empty_statement_is_zero() -> None:
    assert keyword_overlap_score("the and of", "anything") == 0.0


def test_overlap_score_is_stem_insensitive() -> None:
    # 'descending' in the statement should match 'descend' in source.
    statement = "The city is descending from heaven."
    source = "I saw the holy city descend out of heaven from God."
    assert keyword_overlap_score(statement, source) == pytest.approx(1.0)


# ----------------------- classify_score -----------------------


def test_classify_score_thresholds_default() -> None:
    assert classify_score(0.9) == "pass"
    assert classify_score(0.6) == "pass"
    assert classify_score(0.45) == "partial"
    assert classify_score(0.3) == "partial"
    assert classify_score(0.29) == "fail"
    assert classify_score(0.0) == "fail"


def test_classify_score_thresholds_overridable() -> None:
    assert classify_score(0.5, pass_threshold=0.4, partial_threshold=0.2) == "pass"
    assert classify_score(0.25, pass_threshold=0.4, partial_threshold=0.2) == "partial"


# ----------------------- verify_citation -----------------------


def test_verify_citation_returns_result_with_status() -> None:
    result = verify_citation(
        "The New Jerusalem comes down out of heaven.",
        "I saw the holy city, new Jerusalem, coming down out of heaven from God.",
        descriptor_id="d-1",
        citation_id="c-1",
    )
    assert isinstance(result, VerificationResult)
    assert result.descriptor_id == "d-1"
    assert result.citation_id == "c-1"
    assert result.status == "pass"
    assert "keyword overlap" in result.rationale
    assert result.judge_status is None
    assert result.judge_rationale is None


def test_verify_citation_invokes_judge_when_supplied() -> None:
    calls: list[tuple[str, str]] = []

    def fake_judge(statement: str, source_text: str) -> tuple[str, str]:
        calls.append((statement, source_text))
        return "pass", "Direct support in v2."

    result = verify_citation(
        "City comes from heaven.",
        "the holy city, new Jerusalem, coming down out of heaven from God.",
        judge=fake_judge,
    )
    assert len(calls) == 1
    assert result.judge_status == "pass"
    assert result.judge_rationale == "Direct support in v2."


def test_verify_citation_judge_with_bad_status_raises() -> None:
    def bad_judge(_statement: str, _source: str) -> tuple[str, str]:
        return ("yes-strong-support", "out of taxonomy")  # type: ignore[return-value]

    with pytest.raises(JudgeError):
        verify_citation("anything", "anything", judge=bad_judge)


def test_verify_result_to_json_round_trips_numeric_score() -> None:
    result = verify_citation("walls are jasper", "the walls are jasper")
    payload = json.loads(result.to_json())
    assert payload["status"] == "pass"
    assert payload["score"] >= 0.5
    assert payload["judge_status"] is None


# ----------------------- verify_descriptor (DB-backed) -----------------------


def test_verify_descriptor_runs_per_citation(session) -> None:
    now = "2026-05-21T00:00:00+00:00"
    session.add(
        Entity(
            id="new-jerusalem",
            name="The New Jerusalem",
            entity_type="place",
            created_at=now,
            updated_at=now,
        )
    )
    descriptor = Descriptor(
        id="d-1",
        entity_id="new-jerusalem",
        statement="The New Jerusalem descends from heaven.",
        tier="clear",
        temporal_phase="final",
        review_status="pending",
        created_at=now,
        updated_at=now,
    )
    session.add(descriptor)
    session.add(
        Citation(
            id="c-scrip",
            descriptor_id="d-1",
            source_type="scripture",
            book="Revelation",
            chapter=21,
            verse_start=2,
            created_at=now,
        )
    )
    session.add(
        Citation(
            id="c-secondary",
            descriptor_id="d-1",
            source_type="secondary",
            secondary_work="Alcorn, Heaven",
            secondary_locator="ch. 3",
            created_at=now,
        )
    )
    session.commit()
    session.refresh(descriptor)

    class StubFetcher:
        def fetch(self, citation: Citation) -> str:
            return "the holy city, new Jerusalem, coming down out of heaven from God."

    results = verify_descriptor(descriptor, fetcher=StubFetcher())

    # Secondary citation is skipped — only the scripture row is verified.
    assert len(results) == 1
    assert results[0].citation_id == "c-scrip"
    assert results[0].status in {"pass", "partial"}
