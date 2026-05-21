"""Persist an `ExtractionResult` to the canonical SQLite store.

Each call to `persist_extraction` writes:

- One `extraction_run` row recording the run metadata.
- For each *unique* candidate (deduplicated against descriptors already
  in the store): an `entity` row (if `entity_id_suggestion` is new), one
  `descriptor` row with `review_status='pending'` and a provenance JSON
  blob, and one `citation` row per entry in the candidate's
  `citations` list.

Idempotency: re-running extraction against the same passage produces
candidates that hash to the same dedupe keys as the previously-stored
descriptors, so they are skipped and do not create duplicate rows.

The `extraction_run` row is always written, so re-runs are traceable
even when no new descriptors were inserted.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from far_country.extract.dedup import (
    DedupeKey,
    citation_key_from_orm,
    normalize_statement,
    partition_candidates,
)
from far_country.extract.extractor import ExtractionResult
from far_country.extract.models import (
    CandidateDescriptor,
    CitationCandidate,
    ScriptureCitationCandidate,
    WillisCitationCandidate,
)
from far_country.store.models import Citation, Descriptor, Entity, ExtractionRun


@dataclass(frozen=True)
class PersistOutcome:
    """Summary of what `persist_extraction` did."""

    run_id: str
    inserted_entities: list[str]
    inserted_descriptor_ids: list[str]
    skipped_duplicate_statements: list[str]
    candidates_total: int


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _raw_response_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def existing_dedupe_keys(session: Session) -> set[DedupeKey]:
    """Compute dedupe keys for descriptors already stored.

    Walks every (descriptor, citation) pair and produces the same key
    shape that `candidate_key` produces for in-memory candidates, so a
    re-run against the same passage will recognize prior descriptors as
    duplicates.
    """
    keys: set[DedupeKey] = set()
    stmt = select(Descriptor)
    for descriptor in session.scalars(stmt).unique():
        normalized = normalize_statement(descriptor.statement)
        if not descriptor.citations:
            continue
        primary = descriptor.citations[0]
        cit_key = citation_key_from_orm(primary)
        if cit_key is None:
            continue
        keys.add((descriptor.entity_id, cit_key, normalized))
    return keys


def _build_provenance(result: ExtractionResult, run_id: str) -> str:
    payload = {
        "run_id": run_id,
        "prompt_version": result.prompt_version,
        "model": result.model,
        "source_scope": result.source_scope,
        "raw_response_hash": _raw_response_hash(result.raw_response),
    }
    return json.dumps(payload, sort_keys=True)


def _citation_orm_kwargs(citation: CitationCandidate) -> dict[str, object | None]:
    """Flatten a discriminated-union candidate citation into ORM columns."""
    if isinstance(citation, ScriptureCitationCandidate):
        return {
            "source_type": "scripture",
            "book": citation.book,
            "chapter": citation.chapter,
            "verse_start": citation.verse_start,
            "verse_end": citation.verse_end,
            "willis_chapter": None,
            "willis_page_start": None,
            "willis_page_end": None,
        }
    if isinstance(citation, WillisCitationCandidate):
        return {
            "source_type": "willis",
            "book": None,
            "chapter": None,
            "verse_start": None,
            "verse_end": None,
            "willis_chapter": citation.willis_chapter,
            "willis_page_start": citation.willis_page_start,
            "willis_page_end": citation.willis_page_end,
        }
    raise TypeError(f"Unsupported citation type: {type(citation).__name__}")


def _ensure_entity(
    session: Session,
    candidate: CandidateDescriptor,
    now: str,
    inserted_entities: list[str],
) -> None:
    """Insert the candidate's entity if it isn't already in the store."""
    if session.get(Entity, candidate.entity_id_suggestion) is not None:
        return
    session.add(
        Entity(
            id=candidate.entity_id_suggestion,
            name=candidate.entity_name_suggestion,
            entity_type=candidate.entity_type_suggestion,
            summary=None,
            created_at=now,
            updated_at=now,
        )
    )
    session.flush()
    inserted_entities.append(candidate.entity_id_suggestion)


def persist_extraction(
    session: Session,
    result: ExtractionResult,
    *,
    started_at: str | None = None,
) -> PersistOutcome:
    """Write an `ExtractionResult` to the canonical store.

    Commits before returning. The caller owns the `Session` lifecycle.
    """
    now = _now()
    started = started_at or now
    run_id = str(uuid.uuid4())

    existing = existing_dedupe_keys(session)
    unique, duplicates = partition_candidates(result.candidates, known_keys=existing)

    inserted_entities: list[str] = []
    inserted_descriptor_ids: list[str] = []
    provenance = _build_provenance(result, run_id)

    for candidate in unique:
        _ensure_entity(session, candidate, now, inserted_entities)

        descriptor_id = str(uuid.uuid4())
        session.add(
            Descriptor(
                id=descriptor_id,
                entity_id=candidate.entity_id_suggestion,
                statement=candidate.statement,
                tier=candidate.tier,
                symbolic_referent=candidate.symbolic_referent,
                temporal_phase=candidate.temporal_phase,
                review_status="pending",
                provenance=provenance,
                created_at=now,
                updated_at=now,
            )
        )

        for citation in candidate.citations:
            session.add(
                Citation(
                    id=str(uuid.uuid4()),
                    descriptor_id=descriptor_id,
                    created_at=now,
                    **_citation_orm_kwargs(citation),
                )
            )

        inserted_descriptor_ids.append(descriptor_id)

    session.add(
        ExtractionRun(
            id=run_id,
            started_at=started,
            completed_at=now,
            model=result.model,
            prompt_version=result.prompt_version,
            source_scope=result.source_scope,
            descriptor_count=len(inserted_descriptor_ids),
            notes=json.dumps(
                {
                    "candidates_total": len(result.candidates),
                    "candidates_persisted": len(inserted_descriptor_ids),
                    "duplicates_in_batch_or_db": len(duplicates),
                    "raw_response_hash": _raw_response_hash(result.raw_response),
                },
                sort_keys=True,
            ),
        )
    )

    session.commit()

    return PersistOutcome(
        run_id=run_id,
        inserted_entities=inserted_entities,
        inserted_descriptor_ids=inserted_descriptor_ids,
        skipped_duplicate_statements=[c.statement for c in duplicates],
        candidates_total=len(result.candidates),
    )
