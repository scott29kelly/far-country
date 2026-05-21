"""Integration tests for the review FastAPI app.

We drive the app through `TestClient` so the routes, templates, and
SQLAlchemy session wiring all execute together. The DB is per-test
(tmp_path) so each test starts from an empty store.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from far_country.review.app import create_app
from far_country.store import (
    create_engine_for_path,
    create_session_factory,
    init_db,
)
from far_country.store.models import Citation, Descriptor, Entity, ExtractionRun


def _seed(db_path: Path, *, descriptor_id: str = "d-1") -> None:
    engine = create_engine_for_path(db_path)
    init_db(engine)
    factory = create_session_factory(engine)
    with factory() as session:
        session.add(
            Entity(
                id="new-jerusalem",
                name="The New Jerusalem",
                entity_type="place",
                created_at="2026-05-21T00:00:00+00:00",
                updated_at="2026-05-21T00:00:00+00:00",
            )
        )
        session.add(
            Descriptor(
                id=descriptor_id,
                entity_id="new-jerusalem",
                statement="The New Jerusalem comes down out of heaven from God.",
                tier="clear",
                temporal_phase="final",
                review_status="pending",
                created_at="2026-05-21T00:00:00+00:00",
                updated_at="2026-05-21T00:00:00+00:00",
            )
        )
        session.add(
            Citation(
                id="c-1",
                descriptor_id=descriptor_id,
                source_type="scripture",
                book="Revelation",
                chapter=21,
                verse_start=2,
                created_at="2026-05-21T00:00:00+00:00",
            )
        )
        session.add(
            ExtractionRun(
                id="r-1",
                started_at="2026-05-21T00:00:00+00:00",
                completed_at="2026-05-21T00:01:00+00:00",
                model="claude-opus-4-7",
                prompt_version="0.1.0",
                source_scope="esv:revelation:21",
                descriptor_count=1,
            )
        )
        session.commit()
    engine.dispose()


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    db_path = tmp_path / "review.sqlite"
    _seed(db_path)
    app = create_app(db_path=db_path)
    return TestClient(app)


def test_index_renders_status_and_tier_counts(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    body = response.text
    assert "Overview" in body
    assert "Pending" in body
    assert "esv:revelation:21" in body  # recent run row appears


def test_queue_lists_pending_descriptor(client: TestClient) -> None:
    response = client.get("/queue")
    assert response.status_code == 200
    body = response.text
    assert "The New Jerusalem comes down out of heaven" in body
    assert "Approve (a)" in body


def test_queue_status_filter_all_includes_approved(client: TestClient, tmp_path: Path) -> None:
    # Approve the existing descriptor, then check it shows up under ?status_filter=all.
    client.post("/queue/d-1/approve")
    response = client.get("/queue?status_filter=all")
    assert response.status_code == 200
    assert "The New Jerusalem comes down" in response.text


def test_descriptor_detail_renders_edit_form(client: TestClient) -> None:
    response = client.get("/queue/d-1")
    assert response.status_code == 200
    body = response.text
    assert "Edit" in body
    assert 'name="statement"' in body
    assert 'name="tier"' in body


def test_descriptor_detail_404s_on_missing(client: TestClient) -> None:
    response = client.get("/queue/does-not-exist")
    assert response.status_code == 404


def test_approve_action_updates_status_and_returns_partial(client: TestClient) -> None:
    response = client.post(
        "/queue/d-1/approve",
        headers={"HX-Request": "true"},
    )
    assert response.status_code == 200
    # HTMX response is the row partial — no <html> wrapper.
    assert "<html" not in response.text
    assert "status-approved" in response.text

    # Confirm pending count fell to zero.
    overview = client.get("/")
    assert "Pending</span><strong>0</strong>" in overview.text.replace("\n", "")


def test_reject_then_appears_in_rejected_filter(client: TestClient) -> None:
    client.post("/queue/d-1/reject", headers={"HX-Request": "true"})
    response = client.get("/queue?status_filter=rejected")
    assert response.status_code == 200
    assert "The New Jerusalem comes down" in response.text


def test_discuss_accepts_optional_note(client: TestClient) -> None:
    response = client.post(
        "/queue/d-1/discuss",
        headers={"HX-Request": "true"},
        data={"reviewer_notes": "Need a second opinion on temporal_phase."},
    )
    assert response.status_code == 200
    assert "status-needs-discussion" in response.text

    detail = client.get("/queue/d-1")
    assert "Need a second opinion" in detail.text


def test_edit_persists_changes_and_returns_to_pending(client: TestClient) -> None:
    response = client.post(
        "/queue/d-1/edit",
        headers={"HX-Request": "true"},
        data={
            "statement": "The New Jerusalem descends from heaven, prepared as a bride.",
            "tier": "clear",
            "temporal_phase": "final",
        },
    )
    assert response.status_code == 200
    assert "status-pending" in response.text

    detail = client.get("/queue/d-1")
    assert "prepared as a bride" in detail.text


def test_edit_rejects_unknown_tier_with_400(client: TestClient) -> None:
    response = client.post(
        "/queue/d-1/edit",
        data={"tier": "absurd"},
    )
    assert response.status_code == 400


def test_entity_view_404s_on_missing(client: TestClient) -> None:
    response = client.get("/entities/no-such-entity")
    assert response.status_code == 404


def test_entity_view_shows_only_approved(client: TestClient) -> None:
    # Pending descriptor should NOT appear on the entity page.
    response = client.get("/entities/new-jerusalem")
    assert response.status_code == 200
    assert "Approved descriptors (0)" in response.text

    client.post("/queue/d-1/approve")
    response = client.get("/entities/new-jerusalem")
    assert "Approved descriptors (1)" in response.text
    assert "The New Jerusalem comes down" in response.text
