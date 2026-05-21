"""Orchestrates LLM calls and parses responses into `CandidateDescriptor`s.

The `Extractor` is decoupled from the Anthropic SDK via a `ModelCaller`
protocol — a callable that takes `(system_prompt, user_prompt)` and returns
the model's text response. Production wires the SDK via
`make_anthropic_caller`; tests pass a hand-rolled callable.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from typing import TYPE_CHECKING, Final

from pydantic import TypeAdapter, ValidationError

from far_country.extract.models import CandidateDescriptor
from far_country.extract.prompts import (
    PROMPT_VERSION,
    render_entity_prompt,
    render_passage_prompt,
    render_willis_prompt,
)

if TYPE_CHECKING:
    from far_country.ingest import Passage, WillisChapter

ModelCaller = Callable[[str, str], str]

DEFAULT_MODEL: Final = "claude-opus-4-7"
DEFAULT_MAX_TOKENS: Final = 4096

_JSON_FENCE = re.compile(r"^\s*```(?:json)?\s*\n?(.*?)\n?\s*```\s*$", re.DOTALL)
_CANDIDATES_ADAPTER = TypeAdapter(list[CandidateDescriptor])


class ExtractorError(RuntimeError):
    """Raised when the LLM response cannot be parsed into candidates."""


@dataclass(frozen=True)
class ExtractionResult:
    """Outcome of one extraction call.

    `source_scope` follows the format used by `extraction_run.source_scope`
    (e.g. `'esv:revelation:21'`, `'willis:3'`, `'entity:new-jerusalem'`).
    """

    candidates: list[CandidateDescriptor]
    prompt_version: str
    model: str
    source_scope: str
    raw_response: str


class Extractor:
    def __init__(
        self,
        model_caller: ModelCaller,
        *,
        model: str = DEFAULT_MODEL,
        prompt_version: str = PROMPT_VERSION,
    ) -> None:
        self._caller = model_caller
        self._model = model
        self._prompt_version = prompt_version

    def extract_from_passage(
        self,
        passage: Passage,
        entity_hints: list[str] | None = None,
    ) -> ExtractionResult:
        system, user = render_passage_prompt(passage, entity_hints)
        raw = self._caller(system, user)
        candidates = parse_candidates(raw)
        scope = f"esv:{passage.book.strip().lower().replace(' ', '-')}:{passage.chapter}"
        return ExtractionResult(
            candidates=candidates,
            prompt_version=self._prompt_version,
            model=self._model,
            source_scope=scope,
            raw_response=raw,
        )

    def extract_for_entity(
        self,
        entity_slug: str,
        entity_name: str,
        passages: list[Passage],
    ) -> ExtractionResult:
        system, user = render_entity_prompt(entity_slug, entity_name, passages)
        raw = self._caller(system, user)
        candidates = parse_candidates(raw)
        return ExtractionResult(
            candidates=candidates,
            prompt_version=self._prompt_version,
            model=self._model,
            source_scope=f"entity:{entity_slug}",
            raw_response=raw,
        )

    def extract_from_willis(self, chapter: WillisChapter) -> ExtractionResult:
        system, user = render_willis_prompt(chapter)
        raw = self._caller(system, user)
        candidates = parse_candidates(raw)
        return ExtractionResult(
            candidates=candidates,
            prompt_version=self._prompt_version,
            model=self._model,
            source_scope=f"willis:{chapter.chapter_number}",
            raw_response=raw,
        )


def parse_candidates(raw_response: str) -> list[CandidateDescriptor]:
    """Parse an LLM response into candidates, tolerating ```json fences."""
    cleaned = _strip_json_fence(raw_response)
    try:
        return _CANDIDATES_ADAPTER.validate_json(cleaned)
    except ValidationError as exc:
        raise ExtractorError(
            f"LLM response did not validate as list[CandidateDescriptor]: {exc}"
        ) from exc


def _strip_json_fence(text: str) -> str:
    stripped = text.strip()
    match = _JSON_FENCE.match(stripped)
    return match.group(1).strip() if match else stripped


def make_anthropic_caller(
    client: object,
    *,
    model: str = DEFAULT_MODEL,
    max_tokens: int = DEFAULT_MAX_TOKENS,
) -> ModelCaller:
    """Wrap an `anthropic.Anthropic` client into a `ModelCaller`.

    Accepts an object rather than the SDK type so this module imports
    cleanly even if `anthropic` isn't installed (it's a runtime dep).
    """

    def caller(system: str, user: str) -> str:
        message = client.messages.create(  # type: ignore[attr-defined]
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        # The Messages API returns a list of content blocks; the first
        # text block holds the response we want.
        for block in message.content:
            text = getattr(block, "text", None)
            if text is not None:
                return text
        raise ExtractorError("Anthropic response contained no text block")

    return caller
