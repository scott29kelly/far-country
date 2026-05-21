"""Initialize the canonical SQLite store at `data/canonical.sqlite`.

Re-running this script against an existing database is a no-op: every migration
uses `IF NOT EXISTS`, so tables and indexes are not dropped or recreated.

Usage:
    uv run python scripts/init_db.py [path]

If `path` is omitted, defaults to `data/canonical.sqlite` relative to the
repository root (the parent of this script's directory).
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = REPO_ROOT / "data" / "canonical.sqlite"

# Make the pipeline package importable when running this script directly,
# without requiring the package to be installed first.
sys.path.insert(0, str(REPO_ROOT / "pipeline" / "src"))

from far_country.store import create_engine_for_path, init_db  # noqa: E402


def main(argv: list[str]) -> int:
    db_path = Path(argv[1]) if len(argv) > 1 else DEFAULT_DB_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine_for_path(db_path)
    applied = init_db(engine)
    engine.dispose()

    print(f"Initialized {db_path}")
    for name in applied:
        print(f"  applied: {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
