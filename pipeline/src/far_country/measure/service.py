"""Seed and export the measurement dataset (ADR 0017).

`seed_temple` / `seed_allotment` / `seed_city` upsert the hand-authored
records into the canonical store (idempotent by slug id).
`export_measurements` writes `data/exports/measurements.json`
(approved-only, additive — existing export consumers untouched).
`emit_engine_module` / `emit_allotment_module` / `emit_city_module`
write the generated, citation-annotated TypeScript modules the world
engine consumes (ADR 0017 decision 3), split by slug prefix (`ezt-`
temple, `eza-` allotment, `rev-` city) so each generated file is stable
under the others' growth; meters happen in the engine's resolver
(ADR 0018).
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

from far_country.measure.allotment import ALLOTMENT_ENTITIES, ALLOTMENT_MEASUREMENTS
from far_country.measure.city import CITY_ENTITY, CITY_MEASUREMENTS
from far_country.measure.temple import TEMPLE_ENTITY, TEMPLE_MEASUREMENTS, Record
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
    entities_created: int


def seed_temple(
    session: Session,
    *,
    review_status: str = "pending",
    reviewer_notes: str | None = None,
) -> SeedOutcome:
    """Upsert the temple entity + measurement records. Idempotent by slug id."""
    return _seed_records(
        session,
        entities=[TEMPLE_ENTITY],
        measurements=[(TEMPLE_ENTITY["id"], rec) for rec in TEMPLE_MEASUREMENTS],
        provenance={
            "method": "manual",
            "session": "temple-poc-2026-07-02",
            "source_text": "ESV API (Ezekiel 40-42; 43:13-27)",
        },
        review_status=review_status,
        reviewer_notes=reviewer_notes,
    )


def seed_allotment(
    session: Session,
    *,
    review_status: str = "pending",
    reviewer_notes: str | None = None,
) -> SeedOutcome:
    """Upsert the allotment zone entities + measurement records.

    Idempotent by slug id. The temple entity is included in the upsert
    set because the Ezek 45:2 sanctuary-plot records attach to it — the
    allotment can therefore seed into a store where `seed_temple` has
    not run.
    """
    return _seed_records(
        session,
        entities=[*ALLOTMENT_ENTITIES, TEMPLE_ENTITY],
        measurements=ALLOTMENT_MEASUREMENTS,
        provenance={
            "method": "manual",
            "session": "allotment-track-a-2026-07-21",
            "source_text": "ESV API (Ezekiel 45:1-6; 48:8-22, 30-35)",
        },
        review_status=review_status,
        reviewer_notes=reviewer_notes,
    )


def seed_city(
    session: Session,
    *,
    review_status: str = "pending",
    reviewer_notes: str | None = None,
) -> SeedOutcome:
    """Upsert the Revelation 21 city measurement records.

    Idempotent by slug id. Attaches to the existing `new-jerusalem`
    entity; the fallback entity row only fires in a fresh store where
    the descriptor pipeline has not run.
    """
    return _seed_records(
        session,
        entities=[CITY_ENTITY],
        measurements=CITY_MEASUREMENTS,
        provenance={
            "method": "manual",
            "session": "city-rev21-2026-07-22",
            "source_text": "ESV API (Revelation 21:15-17)",
        },
        review_status=review_status,
        reviewer_notes=reviewer_notes,
        book="Revelation",
    )


def _seed_records(
    session: Session,
    *,
    entities: list[dict[str, str | None]],
    measurements: list[tuple[str, Record]],
    provenance: dict[str, str],
    review_status: str,
    reviewer_notes: str | None,
    book: str = "Ezekiel",
) -> SeedOutcome:
    """Upsert entities (create-if-missing) + measurement records by slug id."""
    now = _now()
    provenance_json = json.dumps(provenance)

    entities_created = 0
    for ent in entities:
        if session.get(Entity, ent["id"]) is None:
            session.add(
                Entity(
                    id=ent["id"],
                    name=ent["name"],
                    entity_type=ent["entity_type"],
                    summary=ent["summary"],
                    created_at=now,
                    updated_at=now,
                )
            )
            entities_created += 1

    inserted = 0
    updated = 0
    for entity_id, rec in measurements:
        mid, subject, dimension, value, unit, tier, cites, basis, notes = rec
        row = session.get(Measurement, mid)
        if row is None:
            row = Measurement(
                id=mid,
                entity_id=entity_id,
                subject=subject,
                dimension=dimension,
                value=float(value),
                unit=unit,
                basis=basis,
                tier=tier,
                notes=notes,
                review_status=review_status,
                reviewer_notes=reviewer_notes,
                provenance=provenance_json,
                created_at=now,
                updated_at=now,
            )
            session.add(row)
            inserted += 1
        else:
            row.entity_id = entity_id
            row.subject = subject
            row.dimension = dimension
            row.value = float(value)
            row.unit = unit
            row.basis = basis
            row.tier = tier
            row.notes = notes
            row.review_status = review_status
            row.reviewer_notes = reviewer_notes
            row.provenance = provenance_json
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
                    book=book,
                    chapter=chapter,
                    verse_start=v0,
                    verse_end=v1,
                    created_at=now,
                )
            )
    session.commit()
    return SeedOutcome(inserted=inserted, updated=updated, entities_created=entities_created)


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


def _approved_measurements(session: Session, *, id_prefix: str | None = None) -> list[Measurement]:
    stmt = (
        select(Measurement)
        .options(selectinload(Measurement.citations))
        .where(Measurement.review_status == "approved")
        .order_by(Measurement.entity_id, Measurement.id)
    )
    if id_prefix is not None:
        stmt = stmt.where(Measurement.id.startswith(id_prefix))
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
    """Write the generated temple TS module the world engine consumes.

    Each record carries the text-native value/unit, the long-cubit
    realization (`cu`, per Ezek 40:5's reed and the ADR 0018 unit table;
    null for counts), and its reference — so geometry code that reads
    `EZT['ezt-gate-length']` is one hop from Ezekiel 40:15.
    """
    return _emit_module(
        session,
        out_path,
        id_prefix="ezt-",
        interface_name="TempleMeasurement",
        const_name="EZT",
        description_lines=[
            " * The Ezekiel temple measurement dataset (ADR 0017), text-native",
            " * values with their long-cubit realization. Meters happen in",
            " * templeModel.ts via LONG_CUBIT_M (ADR 0018). Every entry cites",
            " * the ESV verse it came from; tiers per docs/data-model.md.",
        ],
    )


def emit_allotment_module(session: Session, out_path: Path) -> Path:
    """Write the generated allotment TS module (Ezek 45/48, slug prefix eza-)."""
    return _emit_module(
        session,
        out_path,
        id_prefix="eza-",
        interface_name="AllotmentMeasurement",
        const_name="EZA",
        description_lines=[
            " * The Ezekiel 45/48 holy-allotment measurement dataset (ADR 0017,",
            " * Track A): the holy district, priests'/Levites' portions, city",
            " * strip, and Ezekiel's city, text-native values with their",
            " * long-cubit realization. Meters happen at consumption via",
            " * LONG_CUBIT_M (ADR 0018). Every entry cites the ESV verse it",
            " * came from; tiers per docs/data-model.md.",
        ],
    )


def emit_city_module(session: Session, out_path: Path) -> Path:
    """Write the generated Rev 21 city TS module (slug prefix rev-).

    Revelation declares no internal unit standard (no Ezek 40:5), so
    the records stay purely text-native — no `cu` field; the engine's
    resolver owns the ESV-footnote unit glosses (stadion, common cubit).
    """
    return _emit_module(
        session,
        out_path,
        id_prefix="rev-",
        interface_name="CityMeasurement",
        const_name="REV",
        description_lines=[
            " * The Revelation 21 city measurement dataset (ADR 0017): the",
            " * measuring-rod passage (Rev 21:15-17), text-native values only.",
            " * Revelation declares no internal unit standard, so meters happen",
            " * entirely in config.ts against the ESV footnote glosses",
            " * (ADR 0018 pattern). Every entry cites the ESV verse it came",
            " * from; tiers per docs/data-model.md.",
        ],
        include_cu=False,
    )


def _emit_module(
    session: Session,
    out_path: Path,
    *,
    id_prefix: str,
    interface_name: str,
    const_name: str,
    description_lines: list[str],
    include_cu: bool = True,
) -> Path:
    rows = _approved_measurements(session, id_prefix=id_prefix)
    cu_field = (
        [
            "  /** realization in long cubits (Ezek 40:5); null for counts */",
            "  cu: number | null;",
        ]
        if include_cu
        else []
    )
    lines: list[str] = [
        "/**",
        " * GENERATED by `far-country measure export` - DO NOT EDIT.",
        " *",
        *description_lines,
        " */",
        "",
        f"export interface {interface_name} {{",
        "  /** the number as the text gives it */",
        "  value: number;",
        "  unit: string;",
        *cu_field,
        "  ref: string;",
        "  subject: string;",
        "  tier: string;",
        "}",
        "",
        f"export const {const_name}: Record<string, {interface_name}> = {{",
    ]
    for m in rows:
        factor = UNIT_TO_LONG_CUBITS.get(m.unit)
        cu = "null" if factor is None else json.dumps(round(m.value * factor, 6))
        cu_part = f"cu: {cu}, " if include_cu else ""
        refs = "; ".join(_ref_str(c) for c in m.citations)
        subject = m.subject.replace("'", "\\'")
        lines.append(
            f"  '{m.id}': {{ value: {json.dumps(m.value)}, unit: '{m.unit}', "
            f"{cu_part}ref: '{refs}', subject: '{subject}', tier: '{m.tier}' }},"
        )
    lines.append("};")
    lines.append("")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines), encoding="utf-8")
    return out_path
