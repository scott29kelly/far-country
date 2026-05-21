"""Tests for the ESV client and verse parser.

HTTP calls are mocked via `httpx.MockTransport` so the suite runs without
network access and without an ESV API key.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest

from far_country.ingest.esv import (
    ESV_API_URL,
    ESVAPIError,
    ESVClient,
    book_slug,
    parse_verses,
)

REVELATION_21_PAYLOAD: dict = {
    "query": "Revelation 21",
    "canonical": "Revelation 21",
    "passages": [
        "  [1] Then I saw a new heaven and a new earth, for the first heaven "
        "and the first earth had passed away, and the sea was no more. "
        "[2] And I saw the holy city, new Jerusalem, coming down out of "
        "heaven from God, prepared as a bride adorned for her husband. "
        "[3] And I heard a loud voice from the throne saying, 'Behold, the "
        "dwelling place of God is with man.'"
    ],
}


def _mock_transport(payload: dict, *, status_code: int = 200) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url).startswith(ESV_API_URL), request.url
        assert request.headers["Authorization"] == "Token test-key"
        return httpx.Response(status_code, json=payload)

    return httpx.MockTransport(handler)


def _make_client(tmp_path: Path, *, payload: dict = REVELATION_21_PAYLOAD) -> ESVClient:
    transport = _mock_transport(payload)
    http = httpx.Client(transport=transport)
    return ESVClient(api_key="test-key", cache_dir=tmp_path, http_client=http)


def test_book_slug_normalizes_book_names() -> None:
    assert book_slug("Revelation") == "revelation"
    assert book_slug("1 Corinthians") == "1-corinthians"
    assert book_slug("Song of Solomon") == "song-of-solomon"
    assert book_slug("  Hebrews  ") == "hebrews"


def test_parse_verses_extracts_each_verse() -> None:
    text = REVELATION_21_PAYLOAD["passages"][0]
    verses = parse_verses("Revelation", 21, text)
    assert [v.verse for v in verses] == [1, 2, 3]
    assert verses[0].text.startswith("Then I saw a new heaven")
    assert verses[1].text.startswith("And I saw the holy city")
    assert all(v.book == "Revelation" and v.chapter == 21 for v in verses)


def test_get_passage_writes_cache_on_first_call(tmp_path: Path) -> None:
    client = _make_client(tmp_path)
    passage = client.get_passage("Revelation", 21)

    assert passage.canonical == "Revelation 21"
    assert len(passage.verses) == 3
    cache_path = tmp_path / "revelation" / "21.json"
    assert cache_path.exists()
    cached = json.loads(cache_path.read_text())
    assert cached["canonical"] == "Revelation 21"


def test_get_passage_reuses_cache_without_http(tmp_path: Path) -> None:
    """Second call must not invoke the HTTP transport."""
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json=REVELATION_21_PAYLOAD)

    http = httpx.Client(transport=httpx.MockTransport(handler))
    client = ESVClient(api_key="test-key", cache_dir=tmp_path, http_client=http)

    client.get_passage("Revelation", 21)
    client.get_passage("Revelation", 21)
    client.get_passage("Revelation", 21)

    assert calls["n"] == 1


def test_missing_api_key_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ESV_API_KEY", raising=False)
    with pytest.raises(ESVAPIError, match="ESV API key not provided"):
        ESVClient()


def test_api_key_read_from_environment(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ESV_API_KEY", "test-key")
    transport = _mock_transport(REVELATION_21_PAYLOAD)
    http = httpx.Client(transport=transport)
    client = ESVClient(cache_dir=tmp_path, http_client=http)
    passage = client.get_passage("Revelation", 21)
    assert passage.canonical == "Revelation 21"


def test_non_200_response_raises(tmp_path: Path) -> None:
    transport = _mock_transport({"error": "bad"}, status_code=401)
    http = httpx.Client(transport=transport)
    client = ESVClient(api_key="test-key", cache_dir=tmp_path, http_client=http)
    with pytest.raises(ESVAPIError, match="401"):
        client.get_passage("Revelation", 21)


def test_empty_passages_response_raises(tmp_path: Path) -> None:
    payload = {"query": "Bogus 99", "canonical": "Bogus 99", "passages": []}
    client = _make_client(tmp_path, payload=payload)
    with pytest.raises(ESVAPIError, match="no passages"):
        client.get_passage("Bogus", 99)


def test_cache_path_uses_book_slug(tmp_path: Path) -> None:
    client = _make_client(tmp_path)
    assert client.cache_path("1 Corinthians", 15) == tmp_path / "1-corinthians" / "15.json"
