"""Tests for the prompt templates.

These check the structural invariants of the rendered prompts (the hermeneutic
preamble is present, the output-format schema is present, the passage/entity/
willis context is correctly substituted) rather than asserting exact wording.
"""

from __future__ import annotations

from far_country.extract.prompts import (
    PROMPT_VERSION,
    render_entity_prompt,
    render_passage_prompt,
    render_willis_prompt,
)
from far_country.ingest import Passage, Verse, WillisChapter, WillisSection


def _make_passage() -> Passage:
    return Passage(
        book="Revelation",
        chapter=21,
        canonical="Revelation 21",
        verses=[
            Verse(book="Revelation", chapter=21, verse=1, text="Then I saw a new heaven..."),
            Verse(book="Revelation", chapter=21, verse=2, text="And I saw the holy city..."),
        ],
        raw_text="[1] ... [2] ...",
    )


def _make_willis_chapter() -> WillisChapter:
    return WillisChapter(
        chapter_number=3,
        title="What Will Heaven Be Like?",
        source_path="/tmp/03.md",
        sections=[
            WillisSection(heading=None, text="Intro text.", page_start=42, page_end=42),
            WillisSection(heading="The throne", text="Throne text.", page_start=43, page_end=44),
        ],
    )


def test_prompt_version_is_semver() -> None:
    parts = PROMPT_VERSION.split(".")
    assert len(parts) == 3
    assert all(p.isdigit() for p in parts)


def test_passage_prompt_includes_hermeneutic_preamble() -> None:
    system, user = render_passage_prompt(_make_passage())
    assert "Conservative Protestant" in system
    assert "literal-where-possible" in system
    assert "symbolic_referent" in system


def test_passage_prompt_includes_output_schema() -> None:
    system, _user = render_passage_prompt(_make_passage())
    assert "entity_id_suggestion" in system
    assert "scripture" in system
    assert "Return ONLY the JSON array" in system


def test_passage_prompt_substitutes_passage_text() -> None:
    _system, user = render_passage_prompt(_make_passage())
    assert "Revelation 21" in user
    assert "[1] Then I saw a new heaven" in user
    assert "[2] And I saw the holy city" in user


def test_passage_prompt_respects_entity_hints() -> None:
    _, user_no_hints = render_passage_prompt(_make_passage())
    assert "no prior entities" in user_no_hints

    _, user_with = render_passage_prompt(_make_passage(), entity_hints=["new-jerusalem", "throne"])
    assert "new-jerusalem" in user_with
    assert "throne" in user_with


def test_entity_prompt_includes_entity_and_passages() -> None:
    system, user = render_entity_prompt(
        "new-jerusalem",
        "The New Jerusalem",
        [_make_passage()],
    )
    assert "Conservative Protestant" in system
    assert "new-jerusalem" in user
    assert "The New Jerusalem" in user
    assert "Revelation 21" in user


def test_willis_prompt_uses_willis_output_schema() -> None:
    system, user = render_willis_prompt(_make_willis_chapter())
    assert "willis_chapter" in system
    assert "willis_page_start" in system
    assert "fuzzy" in system  # Willis-only claims default to fuzzy/debated

    assert "What Will Heaven Be Like?" in user
    assert "The throne" in user
