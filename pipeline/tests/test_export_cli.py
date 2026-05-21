"""Smoke tests for the `far-country export` CLI subcommand."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from typer.testing import CliRunner

from far_country.cli import app
from far_country.store import (
    create_engine_for_path,
    create_session_factory,
    init_db,
)
from far_country.store.models import Citation, Descriptor, Entity

runner = CliRunner()


@pytest.fixture
def seeded_db(tmp_path: Path) -> Path:
    db_path = tmp_path / "canonical.sqlite"
    engine = create_engine_for_path(db_path)
    init_db(engine)
    factory = create_session_factory(engine)
    now = "2026-05-21T00:00:00+00:00"
    with factory() as session:
        session.add(
            Entity(
                id="new-jerusalem",
                name="The New Jerusalem",
                entity_type="place",
                created_at=now,
                updated_at=now,
            )
        )
        session.add(
            Descriptor(
                id="d-1",
                entity_id="new-jerusalem",
                statement="The New Jerusalem comes down out of heaven from God.",
                tier="clear",
                temporal_phase="final",
                review_status="approved",
                created_at=now,
                updated_at=now,
            )
        )
        session.add(
            Citation(
                id="c-1",
                descriptor_id="d-1",
                source_type="scripture",
                book="Revelation",
                chapter=21,
                verse_start=2,
                created_at=now,
            )
        )
        session.commit()
    engine.dispose()
    return db_path


def test_export_writes_expected_files(seeded_db: Path, tmp_path: Path) -> None:
    out_dir = tmp_path / "exports"
    result = runner.invoke(
        app,
        [
            "export",
            "--db-path",
            str(seeded_db),
            "--out-dir",
            str(out_dir),
        ],
    )
    assert result.exit_code == 0, result.stdout
    assert (out_dir / "canonical.json").exists()
    assert (out_dir / "entities" / "new-jerusalem.json").exists()
    assert (out_dir / "manifest.json").exists()

    canonical = json.loads((out_dir / "canonical.json").read_text(encoding="utf-8"))
    assert canonical["entities"][0]["id"] == "new-jerusalem"
    assert canonical["descriptors"][0]["id"] == "d-1"

    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["counts"]["descriptors"] == 1
    assert manifest["entity_files"] == ["entities/new-jerusalem.json"]


def test_export_empty_store_writes_zero_count_manifest(tmp_path: Path) -> None:
    db_path = tmp_path / "empty.sqlite"
    out_dir = tmp_path / "exports"
    result = runner.invoke(
        app,
        ["export", "--db-path", str(db_path), "--out-dir", str(out_dir)],
    )
    assert result.exit_code == 0, result.stdout
    manifest = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["counts"] == {
        "entities": 0,
        "descriptors": 0,
        "citations": 0,
        "relations": 0,
    }
