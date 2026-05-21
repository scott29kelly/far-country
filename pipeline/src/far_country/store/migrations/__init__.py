"""Number-prefixed `.sql` migration files applied in lexicographic order."""

from importlib import resources
from pathlib import Path


def migration_files() -> list[Path]:
    """Return all `.sql` migration files in this package, sorted by filename."""
    package = resources.files(__name__)
    paths: list[Path] = []
    for entry in package.iterdir():
        if entry.is_file() and entry.name.endswith(".sql"):
            paths.append(Path(str(entry)))
    return sorted(paths, key=lambda p: p.name)
