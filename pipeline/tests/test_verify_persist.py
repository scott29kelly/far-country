"""Tests for verification-result persistence.

Covers `save_verification_results` (repo layer) and the
`far-country verify run` CLI's persist / --no-persist paths.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from far_country.store import save_verification_results
from far_country.store.models import (
    Citation,
    Descriptor,
    Entity,
    ExtractionRun,
    Verification,
)
from far_country.verify.citation_check import VerificationResult

NOW = "2026-05-22T12:00:00+00:00"


def _seed_run(session: Session) -> tuple[ExtractionRun, Descriptor, Citation]:
    """Insert one entity → descriptor → citation chained off an extraction_run."""
    run = ExtractionRun(
        id="run-1",
        started_at=NOW,
        completed_at=NOW,
        model="claude-opus-4-7",
        prompt_version="0.1.0",
        source_scope="esv:revelation:21",
    )
    entity = Entity(
        id="new-jerusalem",
        name="The New Jerusalem",
        entity_type="place",
        created_at=NOW,
        updated_at=NOW,
    )
    descriptor = Descriptor(
        id="d-1",
        entity_id="new-jerusalem",
        statement="The New Jerusalem descends from heaven.",
        tier="clear",
        temporal_phase="final",
        review_status="pending",
        created_at=NOW,
        updated_at=NOW,
    )
    citation = Citation(
        id="c-1",
        descriptor_id="d-1",
        source_type="scripture",
        book="Revelation",
        chapter=21,
        verse_start=2,
        created_at=NOW,
    )
    session.add_all([run, entity, descriptor, citation])
    session.commit()
    return run, descriptor, citation


# ----------------------- save_verification_results -----------------------


def test_save_persists_one_row_per_result(session: Session) -> None:
    _seed_run(session)
    results = [
        VerificationResult(
            descriptor_id="d-1",
            citation_id="c-1",
            score=0.83,
            status="pass",
            rationale="keyword overlap 0.83 (pass>=0.60, partial>=0.30)",
        ),
    ]

    rows = save_verification_results(session, "run-1", results)

    assert len(rows) == 1
    row = rows[0]
    assert row.descriptor_id == "d-1"
    assert row.citation_id == "c-1"
    assert row.run_id == "run-1"
    assert row.score == 0.83
    assert row.status == "pass"
    assert row.judge_status is None
    assert row.judge_rationale is None
    assert row.created_at  # ISO timestamp populated


def test_save_persists_judge_fields_when_present(session: Session) -> None:
    _seed_run(session)
    results = [
        VerificationResult(
            descriptor_id="d-1",
            citation_id="c-1",
            score=0.25,
            status="fail",
            rationale="keyword overlap 0.25",
            judge_status="partial",
            judge_rationale="Statement is loosely supported by v2.",
        ),
    ]

    rows = save_verification_results(session, "run-1", results)

    assert rows[0].judge_status == "partial"
    assert rows[0].judge_rationale == "Statement is loosely supported by v2."


def test_save_skips_results_missing_ids(session: Session) -> None:
    _seed_run(session)
    results = [
        # Ad-hoc verifier output with no descriptor/citation ids — not persistable.
        VerificationResult(
            descriptor_id=None,
            citation_id=None,
            score=0.5,
            status="partial",
            rationale="no anchor",
        ),
        VerificationResult(
            descriptor_id="d-1",
            citation_id="c-1",
            score=1.0,
            status="pass",
            rationale="full overlap",
        ),
    ]

    rows = save_verification_results(session, "run-1", results)

    assert len(rows) == 1
    assert rows[0].citation_id == "c-1"


def test_save_appends_on_rerun(session: Session) -> None:
    """Re-running verify for the same descriptor/citation/run adds rows,
    not overwrites — verdict history must be preserved."""
    _seed_run(session)
    result = VerificationResult(
        descriptor_id="d-1",
        citation_id="c-1",
        score=0.8,
        status="pass",
        rationale="first pass",
    )

    save_verification_results(session, "run-1", [result])
    save_verification_results(session, "run-1", [result])

    all_rows = session.scalars(select(Verification)).all()
    assert len(all_rows) == 2
    assert len({r.id for r in all_rows}) == 2


def test_save_enforces_status_check_constraint(session: Session) -> None:
    """Status must be pass|partial|fail at the DB layer too."""
    import pytest
    from sqlalchemy.exc import IntegrityError

    _seed_run(session)
    bogus = VerificationResult(
        descriptor_id="d-1",
        citation_id="c-1",
        score=0.5,
        status="maybe",  # type: ignore[arg-type]
        rationale="nope",
    )
    with pytest.raises(IntegrityError):
        save_verification_results(session, "run-1", [bogus])
    session.rollback()


# ----------------------- CLI: `far-country verify run` -----------------------


def _seed_run_with_provenance(db_path) -> None:
    """Seed the DB so `verify run RUN_ID` finds a descriptor + citation.

    The CLI matches descriptors by the `run_id` embedded in
    `descriptor.provenance` (JSON), so the seed mirrors that contract.
    """
    import json as _json

    from far_country.store import create_engine_for_path, create_session_factory, init_db

    engine = create_engine_for_path(db_path)
    init_db(engine)
    factory = create_session_factory(engine)
    with factory() as session:
        session.add(
            ExtractionRun(
                id="run-cli",
                started_at=NOW,
                completed_at=NOW,
                model="claude-opus-4-7",
                prompt_version="0.1.0",
                source_scope="esv:revelation:21",
            )
        )
        session.add(
            Entity(
                id="new-jerusalem",
                name="The New Jerusalem",
                entity_type="place",
                created_at=NOW,
                updated_at=NOW,
            )
        )
        session.add(
            Descriptor(
                id="d-cli",
                entity_id="new-jerusalem",
                statement="The New Jerusalem descends from heaven.",
                tier="clear",
                temporal_phase="final",
                review_status="pending",
                provenance=_json.dumps({"run_id": "run-cli"}),
                created_at=NOW,
                updated_at=NOW,
            )
        )
        session.add(
            Citation(
                id="c-cli",
                descriptor_id="d-cli",
                source_type="scripture",
                book="Revelation",
                chapter=21,
                verse_start=2,
                created_at=NOW,
            )
        )
        session.commit()
    engine.dispose()


def _prime_esv_cache(cache_dir, book: str, chapter: int, raw_text: str) -> None:
    """Write a synthetic ESV cache file so ESVClient.get_passage() never hits the API."""
    import json as _json

    from far_country.ingest.esv import book_slug

    chapter_dir = cache_dir / book_slug(book) / f"{chapter}.json"
    chapter_dir.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "canonical": f"{book} {chapter}",
        "passages": [raw_text],
    }
    chapter_dir.write_text(_json.dumps(payload), encoding="utf-8")


def test_verify_run_persists_rows_by_default(tmp_path, monkeypatch) -> None:
    from typer.testing import CliRunner

    from far_country.cli import app
    from far_country.store import create_engine_for_path, create_session_factory, init_db

    monkeypatch.setenv("ESV_API_KEY", "test-key-not-used-cache-hits")

    db_path = tmp_path / "canonical.sqlite"
    cache_dir = tmp_path / "esv-cache"
    _seed_run_with_provenance(db_path)
    _prime_esv_cache(
        cache_dir,
        "Revelation",
        21,
        "[2] And I saw the holy city, new Jerusalem, coming down out of heaven from God.",
    )

    runner = CliRunner()
    result = runner.invoke(
        app,
        [
            "verify",
            "run",
            "run-cli",
            "--db-path",
            str(db_path),
            "--cache-dir",
            str(cache_dir),
        ],
    )

    assert result.exit_code == 0, result.stdout
    assert "persisted" in result.stdout

    engine = create_engine_for_path(db_path)
    init_db(engine)
    factory = create_session_factory(engine)
    with factory() as session:
        rows = session.scalars(select(Verification)).all()
    engine.dispose()

    assert len(rows) == 1
    row = rows[0]
    assert row.descriptor_id == "d-cli"
    assert row.citation_id == "c-cli"
    assert row.run_id == "run-cli"
    assert row.status in {"pass", "partial", "fail"}


def test_verify_run_no_persist_skips_writes(tmp_path, monkeypatch) -> None:
    from typer.testing import CliRunner

    from far_country.cli import app
    from far_country.store import create_engine_for_path, create_session_factory, init_db

    monkeypatch.setenv("ESV_API_KEY", "test-key-not-used-cache-hits")

    db_path = tmp_path / "canonical.sqlite"
    cache_dir = tmp_path / "esv-cache"
    _seed_run_with_provenance(db_path)
    _prime_esv_cache(
        cache_dir,
        "Revelation",
        21,
        "[2] And I saw the holy city, new Jerusalem, coming down out of heaven from God.",
    )

    runner = CliRunner()
    result = runner.invoke(
        app,
        [
            "verify",
            "run",
            "run-cli",
            "--db-path",
            str(db_path),
            "--cache-dir",
            str(cache_dir),
            "--no-persist",
        ],
    )

    assert result.exit_code == 0, result.stdout
    assert "not written" in result.stdout

    engine = create_engine_for_path(db_path)
    init_db(engine)
    factory = create_session_factory(engine)
    with factory() as session:
        rows = session.scalars(select(Verification)).all()
    engine.dispose()

    assert rows == []
