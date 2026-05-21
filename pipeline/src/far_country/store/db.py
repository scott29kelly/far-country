"""SQLite engine factory and migration runner."""

from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path
from typing import Final

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from far_country.store.migrations import migration_files

DEFAULT_DB_PATH: Final = Path("data/canonical.sqlite")


def create_engine_for_path(db_path: Path | str, *, echo: bool = False) -> Engine:
    """Create a SQLAlchemy engine for a SQLite file at `db_path`.

    Foreign key enforcement is enabled per-connection (SQLite defaults it off).
    """
    url = f"sqlite:///{db_path}"
    engine = create_engine(url, echo=echo, future=True)

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _connection_record):  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)


def init_db(engine: Engine, migrations: Iterable[Path] | None = None) -> list[str]:
    """Apply all migration `.sql` files against the given engine.

    Migrations are idempotent (every statement uses `IF NOT EXISTS`) so running
    `init_db` against an existing database is safe.

    Returns the list of applied migration filenames.
    """
    files = list(migrations) if migrations is not None else migration_files()
    applied: list[str] = []
    with engine.begin() as conn:
        for path in files:
            sql = path.read_text(encoding="utf-8")
            for statement in _split_sql(sql):
                conn.execute(text(statement))
            applied.append(path.name)
    return applied


def _split_sql(sql: str) -> list[str]:
    """Split a SQL script into individual statements on `;` boundaries.

    Naive but sufficient for our migration files, which contain no string
    literals with embedded semicolons.
    """
    statements: list[str] = []
    buf: list[str] = []
    for raw_line in sql.splitlines():
        line = raw_line.split("--", 1)[0]
        buf.append(line)
        if ";" in line:
            statement = "\n".join(buf).strip().rstrip(";").strip()
            if statement:
                statements.append(statement)
            buf = []
    tail = "\n".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements
