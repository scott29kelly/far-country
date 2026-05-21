"""Uvicorn launcher for the Far Country review UI.

Run with:

    uv run --project pipeline python apps/review/main.py

Configuration via environment variables:

- `FAR_COUNTRY_DB` — path to the canonical SQLite file.
  Defaults to `data/canonical.sqlite` (resolved from CWD).
- `FAR_COUNTRY_REVIEW_HOST` — bind address. Defaults to `127.0.0.1`.
- `FAR_COUNTRY_REVIEW_PORT` — port. Defaults to `8765`.

The Python entry points (`create_app`, the FastAPI factory) live in
`far_country.review.app`; this file is the thin shell that wires uvicorn.
"""

from __future__ import annotations

import os

import uvicorn

from far_country.review.app import create_app


def main() -> None:
    host = os.environ.get("FAR_COUNTRY_REVIEW_HOST", "127.0.0.1")
    port = int(os.environ.get("FAR_COUNTRY_REVIEW_PORT", "8765"))
    app = create_app()
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
