"""Data-access functions for the review UI and other read consumers.

Thin wrappers around SQLAlchemy queries so views never embed SQL. Each
function takes an active `Session`; the caller owns its lifecycle.

Naming follows the spec's review-UI vocabulary (`list_pending`,
`update_review_status`, etc.) so route handlers read straight off the
spec.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from far_country.store.models import (
    REVIEW_STATUSES,
    TIERS,
    Citation,
    Descriptor,
    Entity,
    ExtractionRun,
    Verification,
)
from far_country.verify.citation_check import VerificationResult

ReviewStatus = Literal["pending", "approved", "rejected", "needs-discussion"]

PAGE_SIZE_DEFAULT = 20


@dataclass(frozen=True)
class CountsByStatus:
    pending: int
    approved: int
    rejected: int
    needs_discussion: int

    @property
    def total(self) -> int:
        return self.pending + self.approved + self.rejected + self.needs_discussion


@dataclass(frozen=True)
class CountsByTier:
    clear: int
    fuzzy: int
    debated: int
    symbolic: int


@dataclass(frozen=True)
class RunSummary:
    id: str
    started_at: str
    completed_at: str | None
    model: str
    prompt_version: str
    source_scope: str
    descriptor_count: int | None


@dataclass(frozen=True)
class DescriptorWithContext:
    descriptor: Descriptor
    entity: Entity
    citations: Sequence[Citation]


def _now() -> str:
    return datetime.now(UTC).isoformat()


# ----------------------- overview counts -----------------------


def counts_by_status(session: Session) -> CountsByStatus:
    stmt = select(Descriptor.review_status, func.count()).group_by(Descriptor.review_status)
    rows = dict(session.execute(stmt).all())
    return CountsByStatus(
        pending=int(rows.get("pending", 0)),
        approved=int(rows.get("approved", 0)),
        rejected=int(rows.get("rejected", 0)),
        needs_discussion=int(rows.get("needs-discussion", 0)),
    )


def counts_by_tier(session: Session) -> CountsByTier:
    stmt = select(Descriptor.tier, func.count()).group_by(Descriptor.tier)
    rows = dict(session.execute(stmt).all())
    return CountsByTier(
        clear=int(rows.get("clear", 0)),
        fuzzy=int(rows.get("fuzzy", 0)),
        debated=int(rows.get("debated", 0)),
        symbolic=int(rows.get("symbolic", 0)),
    )


def recent_runs(session: Session, *, limit: int = 10) -> list[RunSummary]:
    stmt = select(ExtractionRun).order_by(ExtractionRun.started_at.desc()).limit(limit)
    runs = session.scalars(stmt).all()
    return [
        RunSummary(
            id=r.id,
            started_at=r.started_at,
            completed_at=r.completed_at,
            model=r.model,
            prompt_version=r.prompt_version,
            source_scope=r.source_scope,
            descriptor_count=r.descriptor_count,
        )
        for r in runs
    ]


# ----------------------- queue / detail -----------------------


def list_descriptors(
    session: Session,
    *,
    status: ReviewStatus | None = "pending",
    page: int = 1,
    page_size: int = PAGE_SIZE_DEFAULT,
) -> tuple[list[DescriptorWithContext], int]:
    """Return `(rows_on_page, total_matching)` ordered oldest-first.

    Oldest-first puts the work the reviewer hasn't seen at the front. If
    `status` is None, all statuses are returned.
    """
    page = max(page, 1)
    page_size = max(page_size, 1)

    base = select(Descriptor).options(
        selectinload(Descriptor.citations),
        selectinload(Descriptor.entity),
    )
    if status is not None:
        base = base.where(Descriptor.review_status == status)

    total = session.scalar(select(func.count()).select_from(base.order_by(None).subquery())) or 0

    rows = session.scalars(
        base.order_by(Descriptor.created_at.asc(), Descriptor.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return (
        [
            DescriptorWithContext(
                descriptor=d,
                entity=d.entity,
                citations=list(d.citations),
            )
            for d in rows
        ],
        int(total),
    )


def get_descriptor(session: Session, descriptor_id: str) -> DescriptorWithContext | None:
    stmt = (
        select(Descriptor)
        .where(Descriptor.id == descriptor_id)
        .options(
            selectinload(Descriptor.citations),
            selectinload(Descriptor.entity),
        )
    )
    descriptor = session.scalars(stmt).unique().one_or_none()
    if descriptor is None:
        return None
    return DescriptorWithContext(
        descriptor=descriptor,
        entity=descriptor.entity,
        citations=list(descriptor.citations),
    )


def list_approved_for_entity(
    session: Session, entity_id: str
) -> tuple[Entity | None, list[DescriptorWithContext]]:
    entity = session.get(Entity, entity_id)
    if entity is None:
        return None, []
    stmt = (
        select(Descriptor)
        .where(
            Descriptor.entity_id == entity_id,
            Descriptor.review_status == "approved",
        )
        .options(selectinload(Descriptor.citations))
        .order_by(Descriptor.tier.asc(), Descriptor.created_at.asc())
    )
    descriptors = session.scalars(stmt).all()
    return entity, [
        DescriptorWithContext(descriptor=d, entity=entity, citations=list(d.citations))
        for d in descriptors
    ]


# ----------------------- state transitions -----------------------


class DescriptorNotFoundError(LookupError):
    """Raised when an update targets a descriptor that doesn't exist."""


def update_review_status(
    session: Session,
    descriptor_id: str,
    status: ReviewStatus,
    *,
    reviewer_notes: str | None = None,
) -> Descriptor:
    """Flip a descriptor's `review_status`, optionally appending notes.

    Reviewer notes are *appended* (with a timestamp prefix) rather than
    overwritten, so the audit trail of past comments is preserved when a
    descriptor is re-reviewed.
    """
    if status not in REVIEW_STATUSES:
        raise ValueError(f"Unknown review status: {status!r}")

    descriptor = session.get(Descriptor, descriptor_id)
    if descriptor is None:
        raise DescriptorNotFoundError(descriptor_id)

    now = _now()
    descriptor.review_status = status
    descriptor.updated_at = now
    if reviewer_notes:
        descriptor.reviewer_notes = _append_note(descriptor.reviewer_notes, reviewer_notes, now)
    session.commit()
    session.refresh(descriptor)
    return descriptor


def edit_descriptor(
    session: Session,
    descriptor_id: str,
    *,
    statement: str | None = None,
    tier: str | None = None,
    symbolic_referent: str | None = None,
    temporal_phase: str | None = None,
    reviewer_notes: str | None = None,
) -> Descriptor:
    """Update one or more editable fields. After any edit, the descriptor
    goes back to `pending` so the change is re-reviewed (per the lifecycle
    diagram in `docs/data-model.md` §3).
    """
    descriptor = session.get(Descriptor, descriptor_id)
    if descriptor is None:
        raise DescriptorNotFoundError(descriptor_id)

    if tier is not None and tier not in TIERS:
        raise ValueError(f"Unknown tier: {tier!r}")

    now = _now()
    if statement is not None:
        descriptor.statement = statement
    if tier is not None:
        descriptor.tier = tier
        # symbolic_referent constraint: required iff tier == 'symbolic'
        if tier != "symbolic":
            descriptor.symbolic_referent = None
    if symbolic_referent is not None:
        descriptor.symbolic_referent = symbolic_referent or None
    if temporal_phase is not None:
        descriptor.temporal_phase = temporal_phase or None
    if reviewer_notes:
        descriptor.reviewer_notes = _append_note(descriptor.reviewer_notes, reviewer_notes, now)

    descriptor.review_status = "pending"
    descriptor.updated_at = now
    session.commit()
    session.refresh(descriptor)
    return descriptor


def _append_note(existing: str | None, addition: str, now: str) -> str:
    entry = f"[{now}] {addition.strip()}"
    if not existing:
        return entry
    return f"{existing.rstrip()}\n{entry}"


# ----------------------- verification persistence -----------------------


def save_verification_results(
    session: Session,
    run_id: str,
    results: Sequence[VerificationResult],
) -> list[Verification]:
    """Persist a batch of `VerificationResult` rows for an extraction run.

    Results missing `descriptor_id` or `citation_id` are skipped (a
    `VerificationResult` constructed outside a stored descriptor is not
    persistable). Each row gets a fresh uuid; re-running verify for the
    same descriptor/citation/run appends new rows rather than overwriting,
    so verdict history stays queryable.

    Returns the inserted rows, in input order.
    """
    import uuid

    now = _now()
    inserted: list[Verification] = []
    for result in results:
        if result.descriptor_id is None or result.citation_id is None:
            continue
        row = Verification(
            id=str(uuid.uuid4()),
            descriptor_id=result.descriptor_id,
            citation_id=result.citation_id,
            run_id=run_id,
            score=float(result.score),
            status=result.status,
            rationale=result.rationale,
            judge_status=result.judge_status,
            judge_rationale=result.judge_rationale,
            created_at=now,
        )
        session.add(row)
        inserted.append(row)
    session.commit()
    for row in inserted:
        session.refresh(row)
    return inserted
