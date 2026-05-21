"""End-to-end smoke test for Phase 1: ingest → extract → persist → review → approve → export.

Closes spec acceptance criterion 1: "the pipeline can process Revelation 21
end-to-end with no manual intervention." We don't call the real ESV API
or Anthropic — both are mocked:

- ESV: a pre-populated cache directory under `tests/fixtures/esv/` so
  ESVClient never hits the network. Per ADR 0006, the fixture uses
  synthetic placeholder verse text, not real ESV text.
- Anthropic: an injected `ModelCaller` that returns a canned LLM
  response from `tests/fixtures/llm/revelation_21.json`.

The test then drives the review UI via FastAPI's TestClient, approves
each pending descriptor, exports the canonical JSON, and validates the
output against the published schema. If this test passes, every layer
the Phase 1 spec calls out is wired correctly.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from fastapi.testclient import TestClient

from far_country.export import (
    SCHEMA_VERSION,
    build_canonical_export,
    validate_canonical,
    validate_entity,
    write_canonical_export,
    write_manifest,
)
from far_country.extract.extractor import Extractor
from far_country.extract.persist import persist_extraction
from far_country.ingest import ESVClient
from far_country.review.app import create_app
from far_country.store import (
    create_engine_for_path,
    create_session_factory,
    init_db,
)
from far_country.store.models import Descriptor

FIXTURES_ROOT = Path(__file__).resolve().parent / "fixtures"
ESV_FIXTURE_ROOT = FIXTURES_ROOT / "esv"
LLM_FIXTURE_PATH = FIXTURES_ROOT / "llm" / "revelation_21.json"


def _stage_esv_cache(target_dir: Path) -> None:
    """Copy the fixture ESV cache into the tmp cache dir ESVClient expects."""
    target_dir.mkdir(parents=True, exist_ok=True)
    for chapter_file in (ESV_FIXTURE_ROOT / "revelation").iterdir():
        if chapter_file.suffix != ".json":
            continue
        book_dir = target_dir / "revelation"
        book_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy(chapter_file, book_dir / chapter_file.name)


def _canned_caller(canned_response: str):
    """Build a `ModelCaller` that returns the same response for every call."""

    def caller(system: str, user: str) -> str:  # noqa: ARG001
        return canned_response

    return caller


def test_revelation_21_end_to_end(tmp_path: Path) -> None:
    # ---------------- 1. Stage fixtures ----------------
    cache_dir = tmp_path / "esv_cache"
    _stage_esv_cache(cache_dir)
    canned_response = LLM_FIXTURE_PATH.read_text(encoding="utf-8")

    db_path = tmp_path / "canonical.sqlite"
    out_dir = tmp_path / "exports"

    # ---------------- 2. Ingest (cache hit only) ----------------
    with ESVClient(api_key="fake-key", cache_dir=cache_dir) as client:
        passage = client.get_passage("Revelation", 21)
    assert passage.book == "Revelation"
    assert passage.chapter == 21
    assert len(passage.verses) >= 8

    # ---------------- 3. Extract (canned LLM response) ----------------
    extractor = Extractor(_canned_caller(canned_response))
    result = extractor.extract_from_passage(passage)
    assert len(result.candidates) == 3
    assert {c.entity_id_suggestion for c in result.candidates} == {"new-jerusalem"}
    assert any(c.tier == "symbolic" for c in result.candidates)
    assert result.source_scope == "esv:revelation:21"

    # ---------------- 4. Persist ----------------
    engine = create_engine_for_path(db_path)
    init_db(engine)
    session_factory = create_session_factory(engine)
    with session_factory() as session:
        outcome = persist_extraction(session, result)
    assert len(outcome.inserted_descriptor_ids) == 3
    assert outcome.inserted_entities == ["new-jerusalem"]

    # Verify the descriptor sits in 'pending' before any review action.
    with session_factory() as session:
        pending = session.query(Descriptor).filter(Descriptor.review_status == "pending").count()
    assert pending == 3

    # ---------------- 5. Review UI sees the queue ----------------
    engine.dispose()  # release the file lock before FastAPI re-opens it
    app = create_app(db_path=db_path)
    client = TestClient(app)

    queue_response = client.get("/queue")
    assert queue_response.status_code == 200
    body = queue_response.text
    # Statements from the fixture should render in the queue HTML.
    assert "comes down out of heaven" in body
    assert "no temple" in body
    assert "pure gold" in body

    # ---------------- 6. Reviewer approves every descriptor ----------------
    descriptor_ids = list(outcome.inserted_descriptor_ids)
    for did in descriptor_ids:
        r = client.post(f"/queue/{did}/approve", headers={"HX-Request": "true"})
        assert r.status_code == 200, r.text
        assert "status-approved" in r.text

    # Overview should now report all 3 approved.
    overview = client.get("/")
    assert overview.status_code == 200
    flat = overview.text.replace("\n", "")
    assert "Approved</span><strong>3</strong>" in flat
    assert "Pending</span><strong>0</strong>" in flat

    # Entity page should list all approved descriptors.
    entity_page = client.get("/entities/new-jerusalem")
    assert entity_page.status_code == 200
    assert "Approved descriptors (3)" in entity_page.text

    # ---------------- 7. Export ----------------
    # Re-open the engine for the export step — FastAPI's app has its own.
    engine = create_engine_for_path(db_path)
    session_factory = create_session_factory(engine)
    with session_factory() as session:
        canonical = build_canonical_export(session)
        write_canonical_export(session, out_dir)
    entity_filenames = ["entities/new-jerusalem.json"]
    write_manifest(out_dir, canonical=canonical, entity_filenames=entity_filenames)

    # ---------------- 8. Output files exist and validate ----------------
    canonical_path = out_dir / "canonical.json"
    entity_path = out_dir / "entities" / "new-jerusalem.json"
    manifest_path = out_dir / "manifest.json"
    assert canonical_path.exists()
    assert entity_path.exists()
    assert manifest_path.exists()

    canonical_payload = json.loads(canonical_path.read_text(encoding="utf-8"))
    entity_payload = json.loads(entity_path.read_text(encoding="utf-8"))
    manifest_payload = json.loads(manifest_path.read_text(encoding="utf-8"))

    validate_canonical(canonical_payload)
    validate_entity(entity_payload)

    assert canonical_payload["schema_version"] == SCHEMA_VERSION
    assert len(canonical_payload["entities"]) == 1
    assert len(canonical_payload["descriptors"]) == 3
    assert len(canonical_payload["citations"]) == 3

    assert entity_payload["id"] == "new-jerusalem"
    assert entity_payload["name"] == "The New Jerusalem"
    assert entity_payload["entity_type"] == "place"
    assert len(entity_payload["descriptors"]) == 3
    # The symbolic descriptor carries its referent through every layer.
    symbolic = [d for d in entity_payload["descriptors"] if d["tier"] == "symbolic"]
    assert len(symbolic) == 1
    assert symbolic[0]["symbolic_referent"]

    assert manifest_payload["counts"] == {
        "entities": 1,
        "descriptors": 3,
        "citations": 3,
        "relations": 0,
    }
