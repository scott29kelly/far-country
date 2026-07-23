"""The Revelation 21 city measurement dataset (ADR 0017, city side).

Hand-authored against the ESV text of Revelation 21:15-17 — the
measuring-rod passage, the only place John's vision gives numbers
(fetched from the ESV API; the text itself is never stored — ADR 0006).
Values are TEXT-NATIVE: the number and unit as the ESV prints them
(stadia at 21:16; cubits at 21:17). Unlike Ezekiel 40-48, Revelation
declares no internal unit standard, so records carry no long-cubit
realization; meters happen entirely in the engine's resolver against
the ESV's own footnote glosses (a stadion "about 607 feet", a cubit
"about 18 inches" — ADR 0018 pattern).

Deliberately NOT recorded (nothing measurable is given, and inventing
is forbidden):
  - the gates and the wall's extent (Rev 21:12-15) — the rod measures
    "the city and its gates and walls," but only the city and the wall
    receive numbers; the twelve gates / three-per-side roster is
    descriptor territory (the `twelve-gates-of-the-city` entity);
  - the wall's foundations (Rev 21:19-20) — named stones, never
    dimensioned;
  - "great and high" for the wall (21:12) — qualitative.

Both records attach to the existing `new-jerusalem` entity (the
canonical descriptor-driven entity the world's city pick resolves);
the fallback entity row below exists only so a fresh store can take
the seed without the descriptor pipeline having run first.

Record shape: (id, subject, dimension, value, unit, tier, cites, basis, notes)
  cites: list of (chapter, verse_start, verse_end | None); book is Revelation.
"""

from __future__ import annotations

from far_country.measure.temple import Cite, Record

CITY_ENTITY: dict[str, str | None] = {
    "id": "new-jerusalem",
    "name": "New Jerusalem",
    "entity_type": "place",
    # summary stays None: the canonical entity is descriptor-driven and
    # carries no authored summary; inventing one here is not this
    # dataset's job (create-if-missing only — an existing row is kept).
    "summary": None,
}

#: (entity_id, record) — mirrors the allotment seeding shape.
CITY_MEASUREMENTS: list[tuple[str, Record]] = [
    (
        "new-jerusalem",
        (
            "rev-city-side",
            "the city, each dimension (its length, width, and height are equal)",
            "side",
            12000,
            "stadia",
            "clear",
            [(21, 16, None)],
            None,
            "The city lies foursquare; he measured it with the rod at "
            "12,000 stadia, and 'its length and width and height are "
            "equal' (21:16). Recorded per dimension, the plain reading of "
            "the equality clause; a minority reading takes 12,000 as the "
            "total perimeter (3,000 per side). ESV footnote: 'About 1,380 "
            "miles; a stadion was about 607 feet.' Whether the equal "
            "height makes a cube or a pyramid the text does not say — a "
            "form question for the render, not this record (the engine's "
            "terraced massing is a documented decision, "
            "RENDERING-DECISIONS entry #2).",
        ),
    ),
    (
        "new-jerusalem",
        (
            "rev-city-wall",
            "the wall of the city, measured by the angel",
            "height",
            144,
            "cubit",
            "fuzzy",
            [(21, 17, None)],
            None,
            "'He also measured its wall, 144 cubits by human measurement, "
            "which is also an angel's measurement' (21:17). The text does "
            "not say WHICH dimension: recorded as height after 21:12's "
            "'a great, high wall', but many interpreters read thickness "
            "(a wall-section measure) — hence tier `fuzzy`; the referent "
            "is underdetermined, the number is not. ESV footnote: 'About "
            "216 feet; a cubit was about 18 inches' — the common cubit, "
            "not Ezekiel's long cubit (Ezek 40:5 does not govern John's "
            "vision).",
        ),
    ),
]

__all__ = ["CITY_ENTITY", "CITY_MEASUREMENTS", "Cite", "Record"]
