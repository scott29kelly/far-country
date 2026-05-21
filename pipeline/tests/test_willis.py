"""Tests for the Willis chapter loader."""

from __future__ import annotations

from pathlib import Path

import pytest

from far_country.ingest.willis import (
    WillisLoaderError,
    load_chapter,
)

SAMPLE_CHAPTER_3 = """\
# What Will Heaven Be Like?

[p.42] An intro paragraph before any section heading. This becomes the
prologue section with no heading.

## The throne

[p.43] The throne is the center of all things. The text continues across
[p.44] a page boundary, which the loader recognizes.

## The river of life

[p.45] A river flowed out from the throne.

## A section with no page markers

This paragraph mentions no page numbers; the loader inherits the previous
section's last page number.
"""


def _write_chapter(willis_dir: Path, filename: str, content: str) -> None:
    willis_dir.mkdir(parents=True, exist_ok=True)
    (willis_dir / filename).write_text(content, encoding="utf-8")


def test_load_chapter_parses_title_and_sections(tmp_path: Path) -> None:
    _write_chapter(tmp_path, "03-what-will-heaven-be-like.md", SAMPLE_CHAPTER_3)

    chapter = load_chapter(3, willis_dir=tmp_path)

    assert chapter.chapter_number == 3
    assert chapter.title == "What Will Heaven Be Like?"
    assert chapter.source_path.endswith("03-what-will-heaven-be-like.md")
    assert len(chapter.sections) == 4


def test_load_chapter_extracts_page_ranges(tmp_path: Path) -> None:
    _write_chapter(tmp_path, "03-what-will-heaven-be-like.md", SAMPLE_CHAPTER_3)

    chapter = load_chapter(3, willis_dir=tmp_path)
    intro, throne, river, no_marks = chapter.sections

    assert intro.heading is None
    assert intro.page_start == 42 and intro.page_end == 42

    assert throne.heading == "The throne"
    assert throne.page_start == 43 and throne.page_end == 44

    assert river.heading == "The river of life"
    assert river.page_start == 45 and river.page_end == 45

    # Section with no markers inherits the previous section's last page
    assert no_marks.heading == "A section with no page markers"
    assert no_marks.page_start == 45 and no_marks.page_end == 45


def test_load_chapter_chapter_without_intro(tmp_path: Path) -> None:
    content = """\
# Chapter 1

## First section

[p.1] Text.
"""
    _write_chapter(tmp_path, "01-chapter-one.md", content)
    chapter = load_chapter(1, willis_dir=tmp_path)
    assert len(chapter.sections) == 1
    assert chapter.sections[0].heading == "First section"


def test_load_chapter_missing_file_raises(tmp_path: Path) -> None:
    tmp_path.mkdir(exist_ok=True)
    with pytest.raises(WillisLoaderError, match="No Willis chapter file"):
        load_chapter(99, willis_dir=tmp_path)


def test_load_chapter_missing_directory_raises(tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist"
    with pytest.raises(WillisLoaderError, match="Willis directory not found"):
        load_chapter(3, willis_dir=missing)


def test_load_chapter_ambiguous_match_raises(tmp_path: Path) -> None:
    _write_chapter(tmp_path, "03-first.md", "# First\n")
    _write_chapter(tmp_path, "03-second.md", "# Second\n")
    with pytest.raises(WillisLoaderError, match="Multiple Willis chapter files"):
        load_chapter(3, willis_dir=tmp_path)


def test_load_chapter_missing_title_raises(tmp_path: Path) -> None:
    _write_chapter(tmp_path, "05-no-title.md", "Just body text with no H1.\n")
    with pytest.raises(WillisLoaderError, match="No H1 chapter title"):
        load_chapter(5, willis_dir=tmp_path)


def test_chapter_number_zero_padded_in_filename_match(tmp_path: Path) -> None:
    """Chapter 3 must match '03-*.md', not '3-*.md'."""
    _write_chapter(tmp_path, "3-not-padded.md", "# Wrong\n")
    with pytest.raises(WillisLoaderError, match="No Willis chapter file"):
        load_chapter(3, willis_dir=tmp_path)
