"""FastAPI + HTMX review tool for the canonical store.

The app is a thin web layer over `far_country.store.repo`. See
`docs/specs/phase-1-dataset.md` §3.7 for the route contract and
keyboard-shortcut UX.
"""

from far_country.review.app import create_app

__all__ = ["create_app"]
