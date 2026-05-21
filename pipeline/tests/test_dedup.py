"""Tests for statement normalization and candidate deduplication."""

from __future__ import annotations

from far_country.extract.dedup import citation_key, dedupe, normalize_statement
from far_country.extract.models import (
    CandidateDescriptor,
    ScriptureCitationCandidate,
    WillisCitationCandidate,
)


def _scripture(book: str = "Revelation", chapter: int = 21, vs: int = 2, ve: int | None = None):
    return ScriptureCitationCandidate(
        source_type="scripture",
        book=book,
        chapter=chapter,
        verse_start=vs,
        verse_end=ve,
    )


def _candidate(statement: str, entity_id: str = "new-jerusalem", **overrides):
    payload = dict(
        statement=statement,
        entity_id_suggestion=entity_id,
        entity_name_suggestion="The New Jerusalem",
        entity_type_suggestion="place",
        tier="clear",
        temporal_phase="final",
        citations=[_scripture()],
    )
    payload.update(overrides)
    return CandidateDescriptor(**payload)


# ---------- normalize_statement ----------


def test_normalize_lowercases() -> None:
    assert normalize_statement("Hello WORLD") == "hello world"


def test_normalize_collapses_whitespace() -> None:
    assert normalize_statement("a   b\n\tc") == "a b c"


def test_normalize_strips_punctuation() -> None:
    assert normalize_statement("New Jerusalem, descending!") == "new jerusalem descending"


def test_normalize_handles_unicode_quotes() -> None:
    # Curly quotes vs straight quotes shouldn't matter for similarity.
    assert normalize_statement("the “city”") == normalize_statement('the "city"')


def test_normalize_equivalence_across_punctuation_and_case() -> None:
    a = "The walls of the New Jerusalem are made of jasper."
    b = "the walls   of THE new jerusalem  are made of jasper"
    assert normalize_statement(a) == normalize_statement(b)


# ---------- citation_key ----------


def test_citation_key_scripture_normalizes_book_case() -> None:
    assert citation_key(_scripture(book="Revelation")) == citation_key(
        _scripture(book="revelation")
    )


def test_citation_key_distinguishes_verse_ranges() -> None:
    a = citation_key(_scripture(vs=2, ve=None))
    b = citation_key(_scripture(vs=2, ve=4))
    assert a != b


def test_citation_key_distinguishes_scripture_vs_willis() -> None:
    s = citation_key(_scripture())
    w = citation_key(
        WillisCitationCandidate(source_type="willis", willis_chapter="3", willis_page_start=42)
    )
    assert s != w


# ---------- dedupe ----------


def test_dedupe_collapses_exact_duplicates() -> None:
    c1 = _candidate("The New Jerusalem comes down out of heaven from God.")
    c2 = _candidate("The New Jerusalem comes down out of heaven from God.")
    result = dedupe([c1, c2])
    assert len(result) == 1


def test_dedupe_collapses_case_and_punctuation_variants() -> None:
    c1 = _candidate("The walls of the New Jerusalem are made of jasper.")
    c2 = _candidate("THE WALLS of the New Jerusalem are made of jasper")
    result = dedupe([c1, c2])
    assert len(result) == 1


def test_dedupe_keeps_different_statements_on_same_citation() -> None:
    c1 = _candidate("The New Jerusalem comes down from God.")
    c2 = _candidate("The New Jerusalem is prepared as a bride.")
    result = dedupe([c1, c2])
    assert len(result) == 2


def test_dedupe_keeps_same_statement_on_different_entities() -> None:
    c1 = _candidate("X is glorious.", entity_id="throne")
    c2 = _candidate("X is glorious.", entity_id="new-jerusalem")
    result = dedupe([c1, c2])
    assert len(result) == 2


def test_dedupe_keeps_same_statement_on_different_citations() -> None:
    c1 = _candidate("Heaven has no temple.", citations=[_scripture(vs=22)])
    c2 = _candidate("Heaven has no temple.", citations=[_scripture(vs=23)])
    result = dedupe([c1, c2])
    assert len(result) == 2


def test_dedupe_preserves_order_first_occurrence_wins() -> None:
    c1 = _candidate("Same claim.", entity_id="a")
    c2 = _candidate("Different claim.", entity_id="b")
    c3 = _candidate("same   claim", entity_id="a")  # dup of c1
    result = dedupe([c1, c2, c3])
    assert [c.entity_id_suggestion for c in result] == ["a", "b"]
    assert result[0].statement == "Same claim."  # first occurrence's exact text retained
