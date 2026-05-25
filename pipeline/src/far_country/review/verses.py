"""Inline ESV verse-text resolver for the review UI.

Reads passage text from the on-disk cache that the ingest stage already
populated under `data/raw/esv/<book-slug>/<chapter>.json`. Never hits the
ESV API at request time — the review UI assumes the relevant chapters
have already been ingested. If a chapter is not cached, the resolver
returns an empty list and the template surfaces the citation without
inline text rather than failing the page render.

This module enables `docs/extraction-pipeline.md §4.2` ("Citation preview
inline — no tab-switching to look up the verse").

ESV text is rendered only in the local review UI bound to 127.0.0.1.
It must not be persisted to any public artifact; the leakage guard in
`apps/web/scripts/check-no-source-leakage.mjs` enforces that for the
web app's build output.
"""

from __future__ import annotations

import json
from pathlib import Path

from far_country.ingest.esv import DEFAULT_ESV_CACHE_DIR, Verse, book_slug, parse_verses

_CHAPTER_CACHE: dict[tuple[Path, str, int], list[Verse]] = {}


def _load_chapter(cache_dir: Path, book: str, chapter: int) -> list[Verse]:
    key = (cache_dir, book_slug(book), chapter)
    cached = _CHAPTER_CACHE.get(key)
    if cached is not None:
        return cached
    path = cache_dir / book_slug(book) / f"{chapter}.json"
    if not path.exists():
        _CHAPTER_CACHE[key] = []
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    passages = payload.get("passages") or []
    if not passages:
        _CHAPTER_CACHE[key] = []
        return []
    verses = parse_verses(book, chapter, passages[0])
    _CHAPTER_CACHE[key] = verses
    return verses


def lookup_verses(
    book: str | None,
    chapter: int | None,
    verse_start: int | None,
    verse_end: int | None,
    *,
    cache_dir: Path | None = None,
) -> list[Verse]:
    """Return cached verses covered by `(book, chapter, verse_start..verse_end)`.

    Returns an empty list on cache miss or invalid arguments. Inclusive
    of both endpoints; `verse_end is None` collapses to a single verse.
    """
    if book is None or chapter is None or verse_start is None:
        return []
    end = verse_end if verse_end is not None else verse_start
    if end < verse_start:
        return []
    resolved_dir = cache_dir if cache_dir is not None else DEFAULT_ESV_CACHE_DIR
    chapter_verses = _load_chapter(resolved_dir, book, chapter)
    return [v for v in chapter_verses if verse_start <= v.verse <= end]


def clear_cache() -> None:
    """Reset the in-process chapter cache (used by tests)."""
    _CHAPTER_CACHE.clear()
