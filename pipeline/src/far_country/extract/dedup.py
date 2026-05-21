"""Deduplicate candidate descriptors before they enter the review queue.

Per `docs/extraction-pipeline.md` §3.1: merge candidates by
`(entity_id, citation, statement-similarity)`. This module implements the
"normalized statement" leg of similarity — lowercase, NFKC-normalize, drop
punctuation, collapse whitespace, exact match. Embedding-based similarity
is an open question for Phase 1 (`docs/specs/phase-1-dataset.md` §5).
"""

from __future__ import annotations

import re
import unicodedata

from far_country.extract.models import CandidateDescriptor, CitationCandidate

_PUNCT = re.compile(r"[^\w\s]", flags=re.UNICODE)
_WS = re.compile(r"\s+")


def normalize_statement(statement: str) -> str:
    """Return a comparable, normalized form of a candidate statement."""
    text = unicodedata.normalize("NFKC", statement).lower()
    text = _PUNCT.sub(" ", text)
    text = _WS.sub(" ", text).strip()
    return text


def citation_key(citation: CitationCandidate) -> tuple:
    """Return a hashable identity key for a citation.

    Book/chapter names are lowercased so capitalization variants don't
    create spurious duplicates.
    """
    if citation.source_type == "scripture":
        return (
            "scripture",
            citation.book.strip().lower(),
            citation.chapter,
            citation.verse_start,
            citation.verse_end,
        )
    return (
        "willis",
        citation.willis_chapter.strip().lower(),
        citation.willis_page_start,
        citation.willis_page_end,
    )


def _primary_citation_key(candidate: CandidateDescriptor) -> tuple:
    """A candidate's identity uses its first citation as the primary key."""
    return citation_key(candidate.citations[0])


def dedupe(candidates: list[CandidateDescriptor]) -> list[CandidateDescriptor]:
    """Merge candidates with matching `(entity, primary citation, statement)`.

    Order is preserved: the first occurrence wins. Subsequent matches are
    dropped (their content was identical by definition of the key).
    """
    seen: dict[tuple, CandidateDescriptor] = {}
    for candidate in candidates:
        key = (
            candidate.entity_id_suggestion,
            _primary_citation_key(candidate),
            normalize_statement(candidate.statement),
        )
        if key not in seen:
            seen[key] = candidate
    return list(seen.values())
