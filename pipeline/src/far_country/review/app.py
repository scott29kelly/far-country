"""FastAPI factory for the Far Country review UI.

The app is constructed via `create_app(db_path=...)` so tests can point
at an isolated SQLite file. In production the db path comes from the
`FAR_COUNTRY_DB` env var (defaulting to `data/canonical.sqlite`).
"""

import os
from collections.abc import Iterator
from pathlib import Path

from fastapi import Depends, FastAPI, Form, HTTPException, Request, status
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from far_country.review.verses import lookup_verses
from far_country.store import (
    DEFAULT_DB_PATH,
    DescriptorNotFoundError,
    counts_by_status,
    counts_by_tier,
    create_engine_for_path,
    create_session_factory,
    edit_descriptor,
    get_descriptor,
    init_db,
    list_approved_for_entity,
    list_descriptors,
    recent_runs,
    update_review_status,
)

REVIEW_PACKAGE_DIR = Path(__file__).resolve().parent
TEMPLATES_DIR = REVIEW_PACKAGE_DIR / "templates"
STATIC_DIR = REVIEW_PACKAGE_DIR / "static"


def _resolved_db_path(db_path: "Path | str | None") -> Path:
    if db_path is not None:
        return Path(db_path)
    env_path = os.environ.get("FAR_COUNTRY_DB")
    if env_path:
        return Path(env_path)
    return DEFAULT_DB_PATH


def create_app(db_path: "Path | str | None" = None) -> FastAPI:
    """Build a FastAPI instance bound to a specific SQLite file.

    Engine + session factory live on `app.state` so tests can introspect
    them or substitute a fresh database between requests.
    """
    resolved = _resolved_db_path(db_path)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine_for_path(resolved)
    init_db(engine)
    session_factory = create_session_factory(engine)

    app = FastAPI(title="Far Country Review", docs_url=None, redoc_url=None)
    app.state.engine = engine
    app.state.session_factory = session_factory
    app.state.db_path = resolved

    templates = Jinja2Templates(directory=TEMPLATES_DIR)
    templates.env.globals["lookup_verses"] = lookup_verses
    app.state.templates = templates

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    def get_session() -> Iterator[Session]:
        with session_factory() as session:
            yield session

    def _is_htmx(request: Request) -> bool:
        return request.headers.get("HX-Request", "").lower() == "true"

    # ------------------------- overview -------------------------

    @app.get("/", response_class=HTMLResponse)
    def index(
        request: Request,
        session: Session = Depends(get_session),
    ) -> HTMLResponse:
        return templates.TemplateResponse(
            request=request,
            name="index.html",
            context={
                "status_counts": counts_by_status(session),
                "tier_counts": counts_by_tier(session),
                "runs": recent_runs(session, limit=10),
                "db_path": str(app.state.db_path),
            },
        )

    # ------------------------- queue -------------------------

    @app.get("/queue", response_class=HTMLResponse)
    def queue(
        request: Request,
        page: int = 1,
        status_filter: str = "pending",
        session: Session = Depends(get_session),
    ) -> HTMLResponse:
        filt = status_filter if status_filter != "all" else None
        rows, total = list_descriptors(session, status=filt, page=page)  # type: ignore[arg-type]
        return templates.TemplateResponse(
            request=request,
            name="queue.html",
            context={
                "rows": rows,
                "total": total,
                "page": page,
                "status_filter": status_filter,
            },
        )

    @app.get("/queue/{descriptor_id}", response_class=HTMLResponse)
    def descriptor_detail(
        request: Request,
        descriptor_id: str,
        session: Session = Depends(get_session),
    ) -> HTMLResponse:
        context = get_descriptor(session, descriptor_id)
        if context is None:
            raise HTTPException(status_code=404, detail="Descriptor not found")
        return templates.TemplateResponse(
            request=request,
            name="descriptor.html",
            context={"row": context},
        )

    # ------------------------- entity view -------------------------

    @app.get("/entities/{slug}", response_class=HTMLResponse)
    def entity_view(
        request: Request,
        slug: str,
        session: Session = Depends(get_session),
    ) -> HTMLResponse:
        entity, descriptors = list_approved_for_entity(session, slug)
        if entity is None:
            raise HTTPException(status_code=404, detail="Entity not found")
        return templates.TemplateResponse(
            request=request,
            name="entity.html",
            context={"entity": entity, "rows": descriptors},
        )

    # ------------------------- actions -------------------------

    def _render_row(request: Request, descriptor_id: str, session: Session) -> HTMLResponse:
        context = get_descriptor(session, descriptor_id)
        if context is None:
            raise HTTPException(status_code=404, detail="Descriptor not found")
        return templates.TemplateResponse(
            request=request,
            name="_descriptor_row.html",
            context={"row": context},
        )

    def _action_response(
        request: Request,
        descriptor_id: str,
        session: Session,
    ) -> HTMLResponse:
        """Decide between HTMX partial swap and full-page redirect-style render."""
        if _is_htmx(request):
            return _render_row(request, descriptor_id, session)
        return descriptor_detail(request, descriptor_id, session)  # type: ignore[no-any-return]

    @app.post("/queue/{descriptor_id}/approve", response_class=HTMLResponse)
    def approve(
        request: Request,
        descriptor_id: str,
        session: Session = Depends(get_session),
    ) -> HTMLResponse:
        _do_status_update(session, descriptor_id, "approved")
        return _action_response(request, descriptor_id, session)

    @app.post("/queue/{descriptor_id}/reject", response_class=HTMLResponse)
    def reject(
        request: Request,
        descriptor_id: str,
        session: Session = Depends(get_session),
    ) -> HTMLResponse:
        _do_status_update(session, descriptor_id, "rejected")
        return _action_response(request, descriptor_id, session)

    @app.post("/queue/{descriptor_id}/discuss", response_class=HTMLResponse)
    def discuss(
        request: Request,
        descriptor_id: str,
        reviewer_notes: str | None = Form(default=None),
        session: Session = Depends(get_session),
    ) -> HTMLResponse:
        _do_status_update(session, descriptor_id, "needs-discussion", reviewer_notes=reviewer_notes)
        return _action_response(request, descriptor_id, session)

    @app.post("/queue/{descriptor_id}/edit", response_class=HTMLResponse)
    def edit(
        request: Request,
        descriptor_id: str,
        statement: str | None = Form(default=None),
        tier: str | None = Form(default=None),
        symbolic_referent: str | None = Form(default=None),
        temporal_phase: str | None = Form(default=None),
        reviewer_notes: str | None = Form(default=None),
        session: Session = Depends(get_session),
    ) -> HTMLResponse:
        try:
            edit_descriptor(
                session,
                descriptor_id,
                statement=statement,
                tier=tier,
                symbolic_referent=symbolic_referent,
                temporal_phase=temporal_phase,
                reviewer_notes=reviewer_notes,
            )
        except DescriptorNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Descriptor not found") from exc
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
        return _action_response(request, descriptor_id, session)

    return app


def _do_status_update(
    session: Session,
    descriptor_id: str,
    new_status,
    *,
    reviewer_notes: str | None = None,
) -> None:
    try:
        update_review_status(session, descriptor_id, new_status, reviewer_notes=reviewer_notes)
    except DescriptorNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Descriptor not found") from exc


# No module-level `app = create_app()`: that would force a DB init on
# every import (including during tests). Production wires uvicorn against
# `apps/review/main.py` or invokes `create_app()` from a launcher.
