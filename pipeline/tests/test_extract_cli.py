"""Smoke tests for the `far-country extract` CLI subcommands.

These verify wiring (subcommand registration, help text, the
passage-ref parser) without invoking real LLM or ESV calls.
"""

from __future__ import annotations

from typer.testing import CliRunner

from far_country.cli import _parse_passage_ref, app

runner = CliRunner()


def test_extract_help_lists_subcommands() -> None:
    result = runner.invoke(app, ["extract", "--help"])
    assert result.exit_code == 0
    assert "passage" in result.stdout
    assert "entity" in result.stdout
    assert "willis" in result.stdout


def test_extract_passage_help_shows_options() -> None:
    result = runner.invoke(app, ["extract", "passage", "--help"])
    assert result.exit_code == 0
    assert "--model" in result.stdout
    assert "--no-dedup" in result.stdout


def test_parse_passage_ref_book_chapter() -> None:
    assert _parse_passage_ref("Revelation:21") == ("Revelation", 21)


def test_parse_passage_ref_ignores_verse_range() -> None:
    """Verse ranges are accepted but the extractor still loads the chapter."""
    book, chapter = _parse_passage_ref("Revelation:21:1-5")
    assert (book, chapter) == ("Revelation", 21)


def test_parse_passage_ref_rejects_missing_chapter() -> None:
    import pytest
    import typer

    with pytest.raises(typer.BadParameter):
        _parse_passage_ref("Revelation")


def test_parse_passage_ref_rejects_non_integer_chapter() -> None:
    import pytest
    import typer

    with pytest.raises(typer.BadParameter):
        _parse_passage_ref("Revelation:twenty-one")
