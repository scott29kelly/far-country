"""Seed and export the measurement dataset (ADR 0017).

`seed_temple` upserts the hand-authored Ezekiel temple records into the
canonical store (idempotent by slug id). `export_measurements` writes
`data/exports/measurements.json` (approved-only, additive — existing export
consumers untouched). `emit_engine_module` writes the generated,
citation-annotated TypeScript module the world engine consumes
(ADR 0017 decision 3); meters happen in the engine's resolver (ADR 0018).
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from far_country.measure.temple import TEMPLE_ENTITY, TEMPLE_MEASUREMENTS
from far_country.store.models import Entity, Measurement, MeasurementCitation

SCHEMA_VERSION: Final = "0.1.0"

#: text-native unit -> long cubits (None = not a length; engine reads .value)
UNIT_TO_LONG_CUBITS: Final[dict[str, float | None]] = {
    "long-cubit": 1.0,
    "cubit": 1.0,  # within Ezek 40-48 the vision's own long cubit governs (40:5)
    "reed": 6.0,  # Ezek 40:5
    "handbreadth": 1.0 / 7.0,  # long cubit = cubit + handbreadth = 7 handbreadths
    "span": 0.43,  # ESV notes: span ~9 in vs long cubit ~21 in
    "stadia": None,
    "step": None,
    "story": None,
    "item": None,
}


def _now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class SeedOutcome:
    inserted: int
    updated: int
    entity_created: bool


def seed_temple(
    session: Session,
    *,
    review_status: str = "pending",
    reviewer_notes: str | None = None,
) -> SeedOutcome:
    """Upsert the temple entity + measurement records. Idempotent by slug id."""
    now = _now()
    provenance = json.dumps(
        {
            "method": "manual",
            "session": "temple-poc-2026-07-02",
            "source_text": "ESV API (Ezekiel 40-42; 43:13-27)",
        }
    )

    entity_created = False
    if session.get(Entity, TEMPLE_ENTITY["id"]) is None:
        session.add(
            Entity(
                id=TEMPLE_ENTITY["id"],
                name=TEMPLE_ENTITY["name"],
                entity_type=TEMPLE_ENTITY["entity_type"],
                summary=TEMPLE_ENTITY["summary"],
                created_at=now,
                updated_at=now,
            )
        )
        entity_created = True

    inserted = 0
    updated = 0
    for rec in TEMPLE_MEASUREMENTS:
        mid, subject, dimension, value, unit, tier, cites, basis, notes = rec
        row = session.get(Measurement, mid)
        if row is None:
            row = Measurement(
                id=mid,
                entity_id=TEMPLE_ENTITY["id"],
                subject=subject,
                dimension=dimension,
                value=float(value),
                unit=unit,
                basis=basis,
                tier=tier,
                notes=notes,
                review_status=review_status,
                reviewer_notes=reviewer_notes,
                provenance=provenance,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            inserted += 1
        else:
            row.subject = subject
            row.dimension = dimension
            row.value = float(value)
            row.unit = unit
            row.basis = basis
            row.tier = tier
            row.notes = notes
            row.review_status = review_status
            row.reviewer_notes = reviewer_notes
            row.provenance = provenance
            row.updated_at = now
            for old in list(row.citations):
                session.delete(old)
            updated += 1
        session.flush()
        for chapter, v0, v1 in cites:
            session.add(
                MeasurementCitation(
                    id=str(uuid.uuid4()),
                    measurement_id=mid,
                    source_type="scripture",
                    book="Ezekiel",
                    chapter=chapter,
                    verse_start=v0,
                    verse_end=v1,
                    created_at=now,
                )
            )
    session.commit()
    return SeedOutcome(inserted=inserted, updated=updated, entity_created=entity_created)


def _cite_dict(c: MeasurementCitation) -> dict[str, Any]:
    return {
        "source_type": c.source_type,
        "book": c.book,
        "chapter": c.chapter,
        "verse_start": c.verse_start,
        "verse_end": c.verse_end,
    }


def _ref_str(c: MeasurementCitation) -> str:
    ref = f"{c.book} {c.chapter}:{c.verse_start}"
    if c.verse_end is not None and c.verse_end != c.verse_start:
        ref += f"-{c.verse_end}"
    return ref


def _approved_measurements(session: Session) -> list[Measurement]:
    stmt = (
        select(Measurement)
        .options(selectinload(Measurement.citations))
        .where(Measurement.review_status == "approved")
        .order_by(Measurement.entity_id, Measurement.id)
    )
    return list(session.scalars(stmt).unique())


def export_measurements(session: Session, out_dir: Path) -> Path:
    """Write `measurements.json` (approved-only) into `out_dir`."""
    rows = _approved_measurements(session)
    payload = {
        "schema_version": SCHEMA_VERSION,
        "generated_at": _now(),
        "measurements": [
            {
                "id": m.id,
                "entity_id": m.entity_id,
                "subject": m.subject,
                "dimension": m.dimension,
                "value": m.value,
                "unit": m.unit,
                "basis": m.basis,
                "tier": m.tier,
                "notes": m.notes,
                "citations": [_cite_dict(c) for c in m.citations],
            }
            for m in rows
        ],
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "measurements.json"
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return path


def emit_engine_module(session: Session, out_path: Path) -> Path:
    """Write the generated TS module the world engine consumes.

    Each record carries the text-native value/unit, the long-cubit
    realization (`cu`, per Ezek 40:5's reed and the ADR 0018 unit table;
    null for counts), and its reference — so geometry code that reads
    `EZT['ezt-gate-length']` is one hop from Ezekiel 40:15.
    """
    rows = _approved_measurements(session)
    lines: list[str] = [
        "/**",
        " * GENERATED by `far-country measure export` - DO NOT EDIT.",
        " *",
        " * The Ezekiel temple measurement dataset (ADR 0017), text-native",
        " * values with their long-cubit realization. Meters happen in",
        " * templeModel.ts via LONG_CUBIT_M (ADR 0018). Every entry cites",
        " * the ESV verse it came from; tiers per docs/data-model.md.",
        " */",
        "",
        "export interface TempleMeasurement {",
        "  /** the number as the text gives it */",
        "  value: number;",
        "  unit: string;",
        "  /** realization in long cubits (Ezek 40:5); null for counts */",
        "  cu: number | null;",
        "  ref: string;",
        "  subject: string;",
        "  tier: string;",
        "}",
        "",
        "export const EZT: Record<string, TempleMeasurement> = {",
    ]
    for m in rows:
        factor = UNIT_TO_LONG_CUBITS.get(m.unit)
        cu = "null" if factor is None else json.dumps(round(m.value * factor, 6))
        refs = "; ".join(_ref_str(c) for c in m.citations)
        subject = m.subject.replace("'", "\\'")
        lines.append(
            f"  '{m.id}': {{ value: {json.dumps(m.value)}, unit: '{m.unit}', "
            f"cu: {cu}, ref: '{refs}', subject: '{subject}', tier: '{m.tier}' }},"
        )
    lines.append("};")
    lines.append("")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path
