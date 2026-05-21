"""Deduplicate candidate descriptors before they enter the review queue.

Per `docs/extraction-pipeline.md` §3.1: merge candidates by
`(entity_id, citation, statement-similarity)`. This module implements the
"normalized statement" leg of similarity — lowercase, NFKC-normalize, drop
punctuation, collapse whitespace, exact match. Embedding-based similarity
is an open question for Phase 1 (`docs/specs/phase-1-dataset.md` §5).

The persistence layer (`extract/persist.py`) reuses these helpers to
filter incoming candidates against descriptors already in the canonical
store — the dedupe key is computed identically for in-memory candidates
and ORM rows so re-running extraction is idempotent.
"""

from __future__ import annotations

import re
import unicodedata
from typing import TYPE_CHECKING

from far_country.extract.models import CandidateDescriptor, CitationCandidate

if TYPE_CHECKING:
    from far_country.store.models import Citation as ORMCitation

_PUNCT = re.compile(r"[^\w\s]", flags=re.UNICODE)
_WS = re.compile(r"\s+")

CitationKey = tuple[object, ...]
DedupeKey = tuple[str, CitationKey, str]


def normalize_statement(statement: str) -> str:
    """Return a comparable, normalized form of a candidate statement."""
    text = unicodedata.normalize("NFKC", statement).lower()
    text = _PUNCT.sub(" ", text)
    text = _WS.sub(" ", text).strip()
    return text


def citation_key(citation: CitationCandidate) -> CitationKey:
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


def citation_key_from_orm(citation: ORMCitation) -> CitationKey | None:
    """Identity key for a stored Citation row, mirroring `citation_key`.

    Returns None for `secondary` citations: secondary sources never
    participate in dedup — they support existing descriptors rather than
    define new ones.
    """
    if citation.source_type == "scripture":
        if citation.book is None or citation.chapter is None or citation.verse_start is None:
            return None
        return (
            "scripture",
            citation.book.strip().lower(),
            citation.chapter,
            citation.verse_start,
            citation.verse_end,
        )
    if citation.source_type == "willis":
        if citation.willis_chapter is None or citation.willis_page_start is None:
            return None
        return (
            "willis",
            citation.willis_chapter.strip().lower(),
            citation.willis_page_start,
            citation.willis_page_end,
        )
    return None


def candidate_key(candidate: CandidateDescriptor) -> DedupeKey:
    """Compute the full dedupe key for an in-memory candidate.

    Uses the first citation as the primary key, matching `dedupe()`.
    """
    return (
        candidate.entity_id_suggestion,
        citation_key(candidate.citations[0]),
        normalize_statement(candidate.statement),
    )


def partition_candidates(
    candidates: list[CandidateDescriptor],
    *,
    known_keys: set[DedupeKey] | None = None,
) -> tuple[list[CandidateDescriptor], list[CandidateDescriptor]]:
    """Split candidates into `(unique, duplicates)`.

    A candidate is a duplicate if its dedupe key has already been seen
    earlier in the input list OR appears in `known_keys` (typically the
    keys for descriptors already stored in the canonical DB).

    Order is preserved within each output list. First occurrence wins.
    """
    seen: set[DedupeKey] = set(known_keys) if known_keys else set()
    unique: list[CandidateDescriptor] = []
    duplicates: list[CandidateDescriptor] = []
    for candidate in candidates:
        key = candidate_key(candidate)
        if key in seen:
            duplicates.append(candidate)
            continue
        seen.add(key)
        unique.append(candidate)
    return unique, duplicates


def dedupe(candidates: list[CandidateDescriptor]) -> list[CandidateDescriptor]:
    """Return only the unique candidates (compat wrapper).

    Order is preserved; the first occurrence wins. Subsequent matches are
    dropped. For the partition form, use `partition_candidates`.
    """
    unique, _ = partition_candidates(candidates)
    return unique
