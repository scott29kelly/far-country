"""Loader for Willis chapter markdown files.

Willis (*What on Earth Is Heaven Like?*) text is held locally under
`data/raw/willis/` and is not committed (see `docs/sources.md`). The loader
parses pre-chunked chapter files in this format:

    # Chapter title (one H1, required)

    [p.42] Optional intro paragraph before the first H2 becomes a section
    with `heading=None`. Page markers like `[p.NN]` are recognized anywhere
    in the body.

    ## Section heading (H2)

    [p.43] Section text. Markers can appear inline. [p.44] Crossings of page
    boundaries within a paragraph are fine.

    ## Another section

    [p.45] More text.

File-naming convention: `data/raw/willis/<NN>[-slug].md`, where `<NN>` is
the zero-padded chapter number — for example `03-what-will-heaven-be-like.md`.
The loader finds the right file by chapter number prefix.

For each section the loader records `page_start` (the first `[p.N]` marker
encountered in the section) and `page_end` (the last). Sections with no
markers inherit `page_start` from the previous section's `page_end`.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Final

from pydantic import BaseModel

REPO_ROOT: Final = Path(__file__).resolve().parents[4]
DEFAULT_WILLIS_DIR: Final = REPO_ROOT / "data" / "raw" / "willis"

_H1 = re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
_H2 = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
_PAGE_MARKER = re.compile(r"\[p\.(\d+)\]")


class WillisLoaderError(RuntimeError):
    """Raised when a Willis chapter file is missing or malformed."""


class WillisSection(BaseModel):
    heading: str | None
    text: str
    page_start: int | None
    page_end: int | None


class WillisChapter(BaseModel):
    chapter_number: int
    title: str
    source_path: str
    sections: list[WillisSection]


def _find_chapter_file(chapter_number: int, willis_dir: Path) -> Path:
    if not willis_dir.exists():
        raise WillisLoaderError(f"Willis directory not found: {willis_dir}")
    prefix = f"{chapter_number:02d}"
    matches = sorted(p for p in willis_dir.glob(f"{prefix}*.md") if p.is_file())
    if not matches:
        raise WillisLoaderError(
            f"No Willis chapter file found for chapter {chapter_number} "
            f"(looked in {willis_dir} for '{prefix}*.md')"
        )
    if len(matches) > 1:
        raise WillisLoaderError(
            f"Multiple Willis chapter files match chapter {chapter_number}: "
            f"{[m.name for m in matches]}"
        )
    return matches[0]


def _extract_title(content: str, source_path: Path) -> str:
    m = _H1.search(content)
    if not m:
        raise WillisLoaderError(f"No H1 chapter title found in {source_path}")
    return m.group(1).strip()


def _split_sections(content: str) -> list[tuple[str | None, str]]:
    """Split body text into `(heading, body)` tuples on H2 boundaries.

    Strips the H1 line before splitting. An H2-less prologue becomes a
    section with `heading=None`. Empty leading prologues are dropped.
    """
    body = _H1.sub("", content, count=1).strip("\n")
    parts = _H2.split(body)
    # _H2.split returns: [prologue, heading1, body1, heading2, body2, ...]
    sections: list[tuple[str | None, str]] = []
    prologue = parts[0].strip()
    if prologue:
        sections.append((None, prologue))
    for i in range(1, len(parts), 2):
        heading = parts[i].strip()
        section_body = parts[i + 1].strip() if i + 1 < len(parts) else ""
        sections.append((heading, section_body))
    return sections


def _page_range(text: str, previous_end: int | None) -> tuple[int | None, int | None]:
    marks = [int(m.group(1)) for m in _PAGE_MARKER.finditer(text)]
    if marks:
        return marks[0], marks[-1]
    return previous_end, previous_end


def load_chapter(chapter_number: int, willis_dir: Path | str | None = None) -> WillisChapter:
    """Load and parse the Willis chapter file for `chapter_number`.

    Raises `WillisLoaderError` if the file is missing, ambiguous, or has no H1.
    """
    base = Path(willis_dir) if willis_dir is not None else DEFAULT_WILLIS_DIR
    path = _find_chapter_file(chapter_number, base)
    content = path.read_text(encoding="utf-8")
    title = _extract_title(content, path)

    sections: list[WillisSection] = []
    previous_end: int | None = None
    for heading, body in _split_sections(content):
        page_start, page_end = _page_range(body, previous_end)
        sections.append(
            WillisSection(
                heading=heading,
                text=body,
                page_start=page_start,
                page_end=page_end,
            )
        )
        previous_end = page_end

    return WillisChapter(
        chapter_number=chapter_number,
        title=title,
        source_path=str(path),
        sections=sections,
    )
