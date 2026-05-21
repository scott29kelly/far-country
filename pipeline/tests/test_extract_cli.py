"""Smoke tests for the `far-country extract` CLI subcommands.

These verify wiring (subcommand registration, help text, the
passage-ref parser) without invoking real LLM or ESV calls.

Help-text assertions normalize Rich's panel rendering (ANSI escapes,
box-drawing characters, and whitespace) before substring matching so
they are stable regardless of terminal width or TTY detection.
"""

from __future__ import annotations

import re

import pytest
from typer.testing import CliRunner

from far_country.cli import _parse_passage_ref, app

runner = CliRunner()


_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[a-zA-Z]")
_BOX_RE = re.compile(r"[─-╿]")


def _normalize_help_output(text: str) -> str:
    """Strip ANSI escapes, box-drawing, and whitespace so substring
    matches survive Rich's panel layout regardless of terminal width.
    """
    text = _ANSI_RE.sub("", text)
    text = _BOX_RE.sub(" ", text)
    return "".join(text.split())


def test_extract_help_lists_subcommands(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("COLUMNS", "200")
    result = runner.invoke(app, ["extract", "--help"])
    assert result.exit_code == 0, result.stdout
    flat = _normalize_help_output(result.stdout)
    for expected in ("passage", "entity", "willis"):
        assert expected in flat, f"{expected!r} not in help output:\n{result.stdout}"


def test_extract_passage_help_shows_options(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("COLUMNS", "200")
    result = runner.invoke(app, ["extract", "passage", "--help"])
    assert result.exit_code == 0, result.stdout
    flat = _normalize_help_output(result.stdout)
    for expected in ("--model", "--no-dedup"):
        assert expected in flat, f"{expected!r} not in help output:\n{result.stdout}"


def test_parse_passage_ref_book_chapter() -> None:
    assert _parse_passage_ref("Revelation:21") == ("Revelation", 21)


def test_parse_passage_ref_ignores_verse_range() -> None:
    """Verse ranges are accepted but the extractor still loads the chapter."""
    book, chapter = _parse_passage_ref("Revelation:21:1-5")
    assert (book, chapter) == ("Revelation", 21)


def test_parse_passage_ref_rejects_missing_chapter() -> None:
    import typer

    with pytest.raises(typer.BadParameter):
        _parse_passage_ref("Revelation")


def test_parse_passage_ref_rejects_non_integer_chapter() -> None:
    import typer

    with pytest.raises(typer.BadParameter):
        _parse_passage_ref("Revelation:twenty-one")
