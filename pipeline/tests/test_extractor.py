"""Tests for the Extractor and LLM-response parsing.

The Extractor is driven by an injectable `ModelCaller` callable. Tests
construct one that returns canned JSON, so no real LLM is invoked.
"""

from __future__ import annotations

import json

import pytest

from far_country.extract.extractor import (
    DEFAULT_MODEL,
    Extractor,
    ExtractorError,
    parse_candidates,
)
from far_country.ingest import Passage, Verse, WillisChapter, WillisSection

CANDIDATE_JSON_ONE = json.dumps(
    [
        {
            "statement": "The New Jerusalem comes down out of heaven from God.",
            "entity_id_suggestion": "new-jerusalem",
            "entity_name_suggestion": "The New Jerusalem",
            "entity_type_suggestion": "place",
            "tier": "clear",
            "symbolic_referent": None,
            "temporal_phase": "final",
            "citations": [
                {
                    "source_type": "scripture",
                    "book": "Revelation",
                    "chapter": 21,
                    "verse_start": 2,
                    "verse_end": None,
                }
            ],
        }
    ]
)


def _passage() -> Passage:
    return Passage(
        book="Revelation",
        chapter=21,
        canonical="Revelation 21",
        verses=[Verse(book="Revelation", chapter=21, verse=2, text="...")],
        raw_text="[2] ...",
    )


def _willis_chapter() -> WillisChapter:
    return WillisChapter(
        chapter_number=3,
        title="What Will Heaven Be Like?",
        source_path="/tmp/03.md",
        sections=[WillisSection(heading="Section", text="text", page_start=42, page_end=42)],
    )


# ---------- parse_candidates ----------


def test_parse_candidates_plain_json() -> None:
    result = parse_candidates(CANDIDATE_JSON_ONE)
    assert len(result) == 1
    assert result[0].entity_id_suggestion == "new-jerusalem"


def test_parse_candidates_strips_json_code_fence() -> None:
    fenced = f"```json\n{CANDIDATE_JSON_ONE}\n```"
    result = parse_candidates(fenced)
    assert len(result) == 1


def test_parse_candidates_strips_unlabeled_code_fence() -> None:
    fenced = f"```\n{CANDIDATE_JSON_ONE}\n```"
    result = parse_candidates(fenced)
    assert len(result) == 1


def test_parse_candidates_raises_on_invalid_json() -> None:
    with pytest.raises(ExtractorError):
        parse_candidates("not json at all")


def test_parse_candidates_raises_on_schema_violation() -> None:
    bad = json.dumps([{"statement": "missing required fields"}])
    with pytest.raises(ExtractorError, match="did not validate"):
        parse_candidates(bad)


def test_parse_candidates_raises_on_symbolic_without_referent() -> None:
    bad = json.dumps(
        [
            {
                "statement": "Streets of pure gold.",
                "entity_id_suggestion": "streets",
                "entity_name_suggestion": "Streets",
                "entity_type_suggestion": "thing",
                "tier": "symbolic",
                "symbolic_referent": None,
                "temporal_phase": "final",
                "citations": [
                    {
                        "source_type": "scripture",
                        "book": "Revelation",
                        "chapter": 21,
                        "verse_start": 21,
                    }
                ],
            }
        ]
    )
    with pytest.raises(ExtractorError):
        parse_candidates(bad)


# ---------- Extractor.extract_from_passage ----------


def test_extract_from_passage_returns_candidates_and_provenance() -> None:
    captured: dict[str, str] = {}

    def caller(system: str, user: str) -> str:
        captured["system"] = system
        captured["user"] = user
        return CANDIDATE_JSON_ONE

    extractor = Extractor(caller, model="test-model", prompt_version="9.9.9")
    result = extractor.extract_from_passage(_passage())

    assert len(result.candidates) == 1
    assert result.model == "test-model"
    assert result.prompt_version == "9.9.9"
    assert result.source_scope == "esv:revelation:21"
    assert result.raw_response == CANDIDATE_JSON_ONE

    # Passage text reached the prompt
    assert "Revelation 21" in captured["user"]


def test_extract_uses_default_model_when_unspecified() -> None:
    extractor = Extractor(lambda _s, _u: CANDIDATE_JSON_ONE)
    result = extractor.extract_from_passage(_passage())
    assert result.model == DEFAULT_MODEL


def test_extract_from_willis_sets_scope_and_calls_willis_prompt() -> None:
    captured: dict[str, str] = {}

    def caller(system: str, user: str) -> str:
        captured["system"] = system
        captured["user"] = user
        return "[]"  # empty array is valid

    result = Extractor(caller).extract_from_willis(_willis_chapter())
    assert result.source_scope == "willis:3"
    assert "willis_chapter" in captured["system"]
    assert "What Will Heaven Be Like?" in captured["user"]


def test_extract_for_entity_sets_scope_and_calls_entity_prompt() -> None:
    captured: dict[str, str] = {}

    def caller(system: str, user: str) -> str:
        captured["user"] = user
        return "[]"

    result = Extractor(caller).extract_for_entity(
        "new-jerusalem", "The New Jerusalem", [_passage()]
    )
    assert result.source_scope == "entity:new-jerusalem"
    assert "new-jerusalem" in captured["user"]


def test_extract_propagates_extractor_error_on_bad_response() -> None:
    extractor = Extractor(lambda _s, _u: "not json")
    with pytest.raises(ExtractorError):
        extractor.extract_from_passage(_passage())


def test_passage_source_scope_normalizes_book_name() -> None:
    """Multi-word book names become slugified scope strings."""

    def caller(_s: str, _u: str) -> str:
        return "[]"

    passage = Passage(
        book="1 Corinthians",
        chapter=15,
        canonical="1 Corinthians 15",
        verses=[],
        raw_text="",
    )
    result = Extractor(caller).extract_from_passage(passage)
    assert result.source_scope == "esv:1-corinthians:15"
