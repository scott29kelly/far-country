"""Latest-verification lookup for the review UI.

The `verification` table is append-only: re-running `far-country verify run`
inserts new rows rather than overwriting, so verdict history stays
queryable. The review UI needs the *latest* verdict per
`(descriptor_id, citation_id)` to display alongside each citation.

This module wraps that query with a per-request memoization keyed by
descriptor_id so a queue page rendering 20 rows doesn't hammer the DB
20+ times for the same lookup.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class LatestVerdict:
    status: str
    score: float
    rationale: str
    judge_status: str | None
    judge_rationale: str | None
    created_at: str


def latest_verdicts_for_descriptor(
    session: Session, descriptor_id: str
) -> dict[str, LatestVerdict]:
    """Return `{citation_id: LatestVerdict}` for the latest verification row
    per citation of this descriptor.

    Empty if no verification has run.
    """
    stmt = text(
        """
        WITH ranked AS (
          SELECT
            citation_id,
            status, score, rationale,
            judge_status, judge_rationale,
            created_at,
            ROW_NUMBER() OVER (
              PARTITION BY citation_id ORDER BY created_at DESC, id DESC
            ) AS rn
          FROM verification
          WHERE descriptor_id = :did
        )
        SELECT citation_id, status, score, rationale,
               judge_status, judge_rationale, created_at
        FROM ranked WHERE rn = 1
        """
    )
    rows = session.execute(stmt, {"did": descriptor_id}).mappings().all()
    return {
        r["citation_id"]: LatestVerdict(
            status=r["status"],
            score=float(r["score"]) if r["score"] is not None else 0.0,
            rationale=r["rationale"] or "",
            judge_status=r["judge_status"],
            judge_rationale=r["judge_rationale"],
            created_at=r["created_at"],
        )
        for r in rows
    }
