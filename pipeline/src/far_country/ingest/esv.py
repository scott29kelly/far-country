"""ESV API client with on-disk caching.

Fetches passages from https://api.esv.org/v3/passage/text/, caches the raw
JSON response per chapter, and parses the result into structured `Verse`
objects with verse numbers preserved.

The ESV API requires an API token (free for personal use); set `ESV_API_KEY`
in the environment, or pass `api_key=...` explicitly to `ESVClient`.

ESV text is not committed: the cache lives under `data/raw/esv/` which is
gitignored. See `docs/sources.md` for the licensing posture.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Final

import httpx
from pydantic import BaseModel, Field

ESV_API_URL: Final = "https://api.esv.org/v3/passage/text/"

REPO_ROOT: Final = Path(__file__).resolve().parents[4]
DEFAULT_ESV_CACHE_DIR: Final = REPO_ROOT / "data" / "raw" / "esv"

ESV_TEXT_PARAMS: Final = {
    "include-verse-numbers": "true",
    "include-headings": "false",
    "include-footnotes": "false",
    "include-passage-references": "false",
    "include-short-copyright": "false",
    "include-first-verse-numbers": "true",
    "indent-paragraphs": "0",
    "indent-poetry": "false",
    "indent-declares": "0",
    "indent-psalm-doxology": "0",
}


class ESVAPIError(RuntimeError):
    """Raised on any non-2xx response from the ESV API."""


class Verse(BaseModel):
    book: str
    chapter: int
    verse: int
    text: str


class Passage(BaseModel):
    book: str
    chapter: int
    canonical: str = Field(description="ESV's canonical reference, e.g. 'Revelation 21'")
    verses: list[Verse]
    raw_text: str = Field(description="Full passage text as returned by the API")


def book_slug(book: str) -> str:
    """Return a filesystem- and URL-safe slug for an ESV book name.

    >>> book_slug("Revelation")
    'revelation'
    >>> book_slug("1 Corinthians")
    '1-corinthians'
    >>> book_slug("Song of Solomon")
    'song-of-solomon'
    """
    return re.sub(r"\s+", "-", book.strip().lower())


_VERSE_MARKER = re.compile(r"\[(\d+)\]")


def parse_verses(book: str, chapter: int, passage_text: str) -> list[Verse]:
    """Split ESV passage text into `Verse` objects on `[N]` verse markers."""
    matches = list(_VERSE_MARKER.finditer(passage_text))
    verses: list[Verse] = []
    for i, match in enumerate(matches):
        verse_num = int(match.group(1))
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(passage_text)
        text = passage_text[start:end].strip()
        if text:
            verses.append(Verse(book=book, chapter=chapter, verse=verse_num, text=text))
    return verses


class ESVClient:
    """Cached ESV API client.

    Each `(book, chapter)` pair is fetched at most once per cache directory:
    the raw API response is written to `<cache_dir>/<book-slug>/<chapter>.json`
    and reused on subsequent calls. Delete the cache file to force a refetch.
    """

    def __init__(
        self,
        api_key: str | None = None,
        cache_dir: Path | str | None = None,
        http_client: httpx.Client | None = None,
    ) -> None:
        resolved_key = api_key if api_key is not None else os.environ.get("ESV_API_KEY")
        if not resolved_key:
            raise ESVAPIError(
                "ESV API key not provided. Set ESV_API_KEY or pass api_key=... explicitly."
            )
        self._api_key = resolved_key
        self._cache_dir = Path(cache_dir) if cache_dir is not None else DEFAULT_ESV_CACHE_DIR
        self._owns_client = http_client is None
        self._http = http_client if http_client is not None else httpx.Client(timeout=30.0)

    def close(self) -> None:
        if self._owns_client:
            self._http.close()

    def __enter__(self) -> ESVClient:
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    def cache_path(self, book: str, chapter: int) -> Path:
        return self._cache_dir / book_slug(book) / f"{chapter}.json"

    def get_passage(self, book: str, chapter: int) -> Passage:
        """Return a structured `Passage` for the given book and chapter.

        Uses the on-disk cache when available; otherwise fetches and caches.
        """
        cache_path = self.cache_path(book, chapter)
        if cache_path.exists():
            payload = json.loads(cache_path.read_text(encoding="utf-8"))
        else:
            payload = self._fetch(book, chapter)
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return self._parse(book, chapter, payload)

    def _fetch(self, book: str, chapter: int) -> dict:
        query = f"{book} {chapter}"
        response = self._http.get(
            ESV_API_URL,
            params={"q": query, **ESV_TEXT_PARAMS},
            headers={"Authorization": f"Token {self._api_key}"},
        )
        if response.status_code != 200:
            raise ESVAPIError(
                f"ESV API returned {response.status_code} for {query!r}: {response.text[:200]}"
            )
        return response.json()

    def _parse(self, book: str, chapter: int, payload: dict) -> Passage:
        passages = payload.get("passages") or []
        if not passages:
            raise ESVAPIError(
                f"ESV API returned no passages for {book} {chapter}: {payload.get('query')!r}"
            )
        raw_text = passages[0]
        canonical = payload.get("canonical", f"{book} {chapter}")
        verses = parse_verses(book, chapter, raw_text)
        return Passage(
            book=book,
            chapter=chapter,
            canonical=canonical,
            verses=verses,
            raw_text=raw_text,
        )
