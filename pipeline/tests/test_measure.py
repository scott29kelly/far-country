"""Tests for the measurement dataset seeding + exports (ADR 0017)."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from far_country.measure import (
    ALLOTMENT_ENTITIES,
    ALLOTMENT_MEASUREMENTS,
    CITY_MEASUREMENTS,
    TEMPLE_MEASUREMENTS,
    emit_allotment_module,
    emit_city_module,
    emit_engine_module,
    export_measurements,
    seed_allotment,
    seed_city,
    seed_temple,
)
from far_country.store.models import Measurement, MeasurementCitation

EXPECTED_ALLOTMENT_ENTITY_IDS = {
    "holy-district",
    "priests-portion",
    "levites-portion",
    "city-portion",
    "ezekiel-city",
}


def test_allotment_records_are_well_formed() -> None:
    ids = [rec[0] for _, rec in ALLOTMENT_MEASUREMENTS]
    assert len(ids) == len(set(ids)), "slug ids must be unique"
    assert all(i.startswith("eza-") for i in ids), "allotment slugs use the eza- prefix"

    declared = {e["id"] for e in ALLOTMENT_ENTITIES}
    assert declared == EXPECTED_ALLOTMENT_ENTITY_IDS
    referenced = {entity_id for entity_id, _ in ALLOTMENT_MEASUREMENTS}
    # ezekiel-temple hosts the Ezek 45:2 sanctuary-plot records
    assert referenced == declared | {"ezekiel-temple"}

    for entity_id, rec in ALLOTMENT_MEASUREMENTS:
        mid, subject, dimension, value, unit, tier, cites, basis, notes = rec
        assert value > 0, mid
        assert tier in {"clear", "fuzzy", "debated", "symbolic"}, mid
        assert cites, f"{mid} must carry at least one citation"
        for chapter, v0, v1 in cites:
            assert chapter in (45, 48), mid
            assert v0 >= 1, mid
            assert v1 is None or v1 > v0, mid


def test_debated_crux_preserved() -> None:
    """Ezek 45:1's breadth (MT 10,000 vs LXX 20,000) must tier debated."""
    by_id = {rec[0]: rec for _, rec in ALLOTMENT_MEASUREMENTS}
    breadth = by_id["eza-holy-district-breadth"]
    assert breadth[3] == 20000  # the ESV as printed
    assert breadth[5] == "debated"
    assert "10,000" in (breadth[8] or ""), "the Hebrew reading must be preserved"
    cited_chapters_verses = {(c, v0) for c, v0, _ in breadth[6]}
    assert (45, 1) in cited_chapters_verses


def test_seed_allotment_idempotent(session: Session) -> None:
    first = seed_allotment(session, review_status="pending")
    assert first.inserted == len(ALLOTMENT_MEASUREMENTS)
    assert first.updated == 0
    # 5 zone entities + ezekiel-temple (not previously seeded here)
    assert first.entities_created == len(ALLOTMENT_ENTITIES) + 1

    again = seed_allotment(session, review_status="approved")
    assert again.inserted == 0
    assert again.updated == len(ALLOTMENT_MEASUREMENTS)
    assert again.entities_created == 0

    # citations are replaced, not duplicated, on re-seed
    cites = session.scalars(select(MeasurementCitation)).all()
    expected = sum(len(rec[6]) for _, rec in ALLOTMENT_MEASUREMENTS)
    assert len(cites) == expected


def test_seed_temple_still_seeds(session: Session) -> None:
    outcome = seed_temple(session)
    assert outcome.inserted == len(TEMPLE_MEASUREMENTS)
    assert outcome.entities_created == 1
    rows = session.scalars(select(Measurement)).all()
    assert all(r.id.startswith("ezt-") for r in rows)


def test_exports_split_by_prefix(session: Session, tmp_path: Path) -> None:
    seed_temple(session, review_status="approved")
    seed_allotment(session, review_status="approved")

    json_path = export_measurements(session, tmp_path)
    assert "eza-holy-district-breadth" in json_path.read_text(encoding="utf-8")

    ezt_path = emit_engine_module(session, tmp_path / "temple.gen.ts")
    eza_path = emit_allotment_module(session, tmp_path / "allotment.gen.ts")
    ezt = ezt_path.read_text(encoding="utf-8")
    eza = eza_path.read_text(encoding="utf-8")

    assert "export const EZT" in ezt and "eza-" not in ezt
    assert "export const EZA" in eza and "'ezt-" not in eza
    # spot-check a realization: 4,500 long cubits pass through as cu 4500
    assert "'eza-city-side': { value: 4500.0, unit: 'long-cubit', cu: 4500.0" in eza


def test_pending_records_not_exported(session: Session, tmp_path: Path) -> None:
    seed_allotment(session, review_status="pending")
    eza = emit_allotment_module(session, tmp_path / "allotment.gen.ts").read_text(encoding="utf-8")
    assert "eza-" not in eza


def test_city_records_are_well_formed() -> None:
    ids = [rec[0] for _, rec in CITY_MEASUREMENTS]
    assert len(ids) == len(set(ids)), "slug ids must be unique"
    assert all(i.startswith("rev-") for i in ids), "city slugs use the rev- prefix"
    assert {entity_id for entity_id, _ in CITY_MEASUREMENTS} == {"new-jerusalem"}

    for _, rec in CITY_MEASUREMENTS:
        mid, subject, dimension, value, unit, tier, cites, basis, notes = rec
        assert value > 0, mid
        assert tier in {"clear", "fuzzy", "debated", "symbolic"}, mid
        assert cites, f"{mid} must carry at least one citation"
        for chapter, v0, v1 in cites:
            assert chapter == 21, mid
            assert v0 >= 1, mid
            assert v1 is None or v1 > v0, mid


def test_city_wall_referent_underdetermined() -> None:
    """Rev 21:17's 144 cubits names no dimension — the record must stay fuzzy
    with the thickness reading preserved in its notes."""
    by_id = {rec[0]: rec for _, rec in CITY_MEASUREMENTS}
    wall = by_id["rev-city-wall"]
    assert wall[3] == 144
    assert wall[4] == "cubit"
    assert wall[5] == "fuzzy"
    assert "thickness" in (wall[8] or ""), "the thickness reading must be preserved"


def test_seed_city_attaches_to_new_jerusalem(session: Session) -> None:
    first = seed_city(session, review_status="pending")
    assert first.inserted == len(CITY_MEASUREMENTS)
    assert first.entities_created == 1  # fresh store: the fallback entity row

    again = seed_city(session, review_status="approved")
    assert again.inserted == 0
    assert again.updated == len(CITY_MEASUREMENTS)
    assert again.entities_created == 0

    rows = session.scalars(select(Measurement)).all()
    assert all(r.entity_id == "new-jerusalem" for r in rows)
    cites = session.scalars(select(MeasurementCitation)).all()
    assert all(c.book == "Revelation" for c in cites)


def test_city_module_is_text_native(session: Session, tmp_path: Path) -> None:
    seed_city(session, review_status="approved")
    seed_allotment(session, review_status="approved")

    rev_path = emit_city_module(session, tmp_path / "city.gen.ts")
    rev = rev_path.read_text(encoding="utf-8")
    assert "export const REV" in rev and "'eza-" not in rev
    # Revelation has no internal unit standard: no long-cubit field at all
    assert "cu:" not in rev
    assert "'rev-city-side': { value: 12000.0, unit: 'stadia', ref: 'Revelation 21:16'" in rev

    # the eza module is unaffected by the city records
    eza = emit_allotment_module(session, tmp_path / "allotment.gen.ts").read_text(encoding="utf-8")
    assert "'rev-" not in eza
