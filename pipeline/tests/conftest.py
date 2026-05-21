"""Pytest fixtures shared across the test suite."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from far_country.store import create_engine_for_path, create_session_factory, init_db


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "test.sqlite"


@pytest.fixture
def engine(db_path: Path) -> Iterator[Engine]:
    eng = create_engine_for_path(db_path)
    init_db(eng)
    try:
        yield eng
    finally:
        eng.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    factory = create_session_factory(engine)
    with factory() as s:
        yield s
