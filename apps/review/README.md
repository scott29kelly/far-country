# Far Country — Review UI

A small FastAPI + HTMX tool for triaging extracted descriptors against the
canonical SQLite store. See [`docs/specs/phase-1-dataset.md`](../../docs/specs/phase-1-dataset.md)
§3.7 for the route contract.

## Run locally

```bash
uv run --project pipeline python apps/review/main.py
# → http://127.0.0.1:8765
```

The app reads the canonical store at `data/canonical.sqlite` by default.
Override with `FAR_COUNTRY_DB=/path/to/other.sqlite`. The DB is created
(empty) if it doesn't exist yet — initialise it by running
`far-country extract passage ...` first.

## Layout

The runtime code lives at `pipeline/src/far_country/review/`:

- `app.py` — FastAPI factory (`create_app(db_path=...)`).
- `templates/` — Jinja2 templates (base layout + page templates + the
  `_descriptor_row.html` partial reused by HTMX action responses).
- `static/style.css`, `static/keybinds.js` — minimal styling and the
  keyboard-shortcut handler.

This launcher script is the only file under `apps/review/`. Keeping the
Python code in the `far_country` package means there is a single
`pyproject.toml` and a single test directory; `apps/review/` is just the
deployment entry point.

## Keyboard shortcuts

In the queue and detail views, with focus outside any form field:

| Key | Action |
| --- | --- |
| `a` | Approve current descriptor |
| `r` | Reject current descriptor |
| `d` | Send to discussion queue |
| `e` | Open edit view |
| `j` / `k` | Next / previous descriptor |

## Tests

The app is exercised by `pipeline/tests/test_review_app.py` via the
FastAPI test client. Run with `uv run --project pipeline pytest`.
