"""The Ezekiel 45/48 holy-allotment measurement dataset (ADR 0017, Track A).

Hand-authored against the ESV text of Ezekiel 45:1-6 and 48:8-22, 30-35
(fetched from the ESV API; the text itself is never stored — ADR 0006).
Values are TEXT-NATIVE: the number and unit as the ESV prints them. The
one genuine translation-level dispute — the holy district's breadth,
where the ESV follows the Septuagint's 20,000 against the Hebrew's
10,000 at 45:1, 48:9, and 48:13 — is tiered `debated` with both
readings documented in its notes; the render follows the ESV as printed
(RENDERING-DECISIONS entry #7 pattern, ADR 0009 rule 4).

Unit convention: the ESV's measure footnote at 45:1/48:8 glosses both
the common cubit (~18 in) and the long cubit (~21 in, "see 40:5").
Records use `long-cubit` throughout per the vision's own declared
standard ("a cubit and a handbreadth," Ezek 40:5; so also 43:13) — the
same convention the temple dataset (temple.py) established for all of
Ezekiel 40-48.

Deliberately NOT recorded (nothing measurable is given, and inventing
is forbidden):
  - the prince's portion (Ezek 45:7-8; 48:21-22) — its extent is
    relational ("from the 25,000 cubits ... to the east border"), never
    a number of its own;
  - the tribal strips (Ezek 48:1-7, 23-29) — named and ordered, never
    dimensioned;
  - the just-measures standards (Ezek 45:10-12: ephah, bath, homer,
    shekel, mina) — capacity and weight, outside the spatial
    measurement schema.

The two Ezek 45:2 records (the 500-cubit sanctuary plot and its
50-cubit open space) attach to the existing `ezekiel-temple` entity —
they measure the temple precinct from the allotment side, corroborating
the ESV's 500-cubit reading of Ezek 42:16-20 (see ezt-precinct-side).

Record shape: (id, subject, dimension, value, unit, tier, cites, basis, notes)
  cites: list of (chapter, verse_start, verse_end | None); book is Ezekiel.
Measurements are grouped as (entity_id, record) pairs because the
allotment survey spans several zone entities.
"""

from __future__ import annotations

from far_country.measure.temple import Cite, Record

ALLOTMENT_ENTITIES: list[dict[str, str]] = [
    {
        "id": "holy-district",
        "name": "The Holy District",
        "entity_type": "place",
        "summary": (
            "The portion of the land set apart for the LORD in the millennial "
            "allotment (Ezek 45:1; 48:8-20) - under the project's framing "
            "(ADR 0012) a literal future district in restored Israel, 25,000 "
            "cubits long and 20,000 broad (ESV; the Hebrew reads 10,000), "
            "holding the priests' and Levites' portions with the sanctuary in "
            "its midst; together with the city strip it squares to 25,000 "
            "(Ezek 48:20)."
        ),
    },
    {
        "id": "priests-portion",
        "name": "The Priests' Portion",
        "entity_type": "place",
        "summary": (
            "The priests' allotment within the holy district (Ezek 45:3-4; "
            "48:10-12): 25,000 cubits by 10,000 for the consecrated sons of "
            "Zadok, a place for their houses and a holy place for the "
            "sanctuary, with the sanctuary of the LORD in its midst."
        ),
    },
    {
        "id": "levites-portion",
        "name": "The Levites' Portion",
        "entity_type": "place",
        "summary": (
            "The Levites' allotment within the holy district (Ezek 45:5; "
            "48:13-14): 25,000 cubits by 10,000 alongside the priests' "
            "territory, held by the Levites who minister at the temple; not "
            "to be sold, exchanged, or alienated (Ezek 48:14)."
        ),
    },
    {
        "id": "city-portion",
        "name": "The Property of the City",
        "entity_type": "place",
        "summary": (
            "The city strip alongside the holy district (Ezek 45:6; "
            "48:15-19): 5,000 cubits broad by 25,000 long, for common use - "
            "dwellings and open country - belonging to the whole house of "
            "Israel, with the city in its midst and food-growing remainders "
            "east and west tilled by the city's workers."
        ),
    },
    {
        "id": "ezekiel-city",
        "name": "Ezekiel's City",
        "entity_type": "place",
        "summary": (
            "The city in the midst of the city strip (Ezek 48:15-17, 30-35): "
            "foursquare at 4,500 cubits per side with 250 cubits of open "
            "land around it and twelve tribal gates, three per side; its "
            "circumference 18,000 cubits and its name from that time on "
            "'The LORD Is There' (Ezek 48:35). Whether this city and John's "
            "New Jerusalem are one, nested, or distinct is a debated "
            "harmonization the dataset does not resolve (ADR 0017); the "
            "render follows Willis's harmonization "
            "(RENDERING-DECISIONS entry #1)."
        ),
    },
]

#: (entity_id, record) — the allotment survey spans several zone entities.
ALLOTMENT_MEASUREMENTS: list[tuple[str, Record]] = [
    # ------------------------------------------------- the holy district
    (
        "holy-district",
        (
            "eza-holy-district-length",
            "the holy district set apart for the LORD, length",
            "length",
            25000,
            "long-cubit",
            "clear",
            [(45, 1, None), (48, 9, None), (48, 13, None)],
            None,
            "The ESV's measure footnote at 45:1/48:8 glosses both the common "
            "and the long cubit; recorded as the long cubit per the vision's "
            "own declared standard (Ezek 40:5), the convention used across "
            "the Ezekiel 40-48 dataset.",
        ),
    ),
    (
        "holy-district",
        (
            "eza-holy-district-breadth",
            "the holy district set apart for the LORD, breadth",
            "breadth",
            20000,
            "long-cubit",
            "debated",
            [(45, 1, None), (48, 9, None), (48, 13, None)],
            None,
            "ESV follows the Septuagint ('20,000'); the Hebrew reads 10,000 "
            "in all three places (ESV footnotes at 45:1, 48:9 ['Compare "
            "45:1'], and 48:13). With 10,000 the district is the priests' "
            "strip alone (48:10); with 20,000 it is the priests' + Levites' "
            "strips together (48:10-13), which 48:20's 25,000-square total "
            "(20,000 + the 5,000 city strip) supports. Both readings "
            "preserved; rendered per the ESV as printed.",
        ),
    ),
    (
        "holy-district",
        (
            "eza-whole-portion-square",
            "the whole set-apart portion (holy district together with the "
            "property of the city), square",
            "side",
            25000,
            "long-cubit",
            "clear",
            [(48, 8, None), (48, 20, None)],
            None,
            "48:8 gives the full strip's 25,000-cubit breadth; 48:20 squares "
            "it: the 20,000-broad holy district plus the 5,000-broad "
            "property of the city.",
        ),
    ),
    # ---------------------------------------------- the priests' portion
    (
        "priests-portion",
        (
            "eza-priests-portion-length",
            "the priests' allotment (the sanctuary section), length",
            "length",
            25000,
            "long-cubit",
            "clear",
            [(45, 3, None), (48, 10, None)],
            None,
            "Measured on the northern and southern sides (48:10), with the "
            "sanctuary of the LORD in its midst.",
        ),
    ),
    (
        "priests-portion",
        (
            "eza-priests-portion-breadth",
            "the priests' allotment (the sanctuary section), breadth",
            "breadth",
            10000,
            "long-cubit",
            "clear",
            [(45, 3, None), (48, 10, None)],
            None,
            "10,000 cubits on the western and on the eastern side (48:10). "
            "The portion is a place for the priests' houses and a holy "
            "place for the sanctuary (45:4).",
        ),
    ),
    # ---------------------------------------------- the Levites' portion
    (
        "levites-portion",
        (
            "eza-levites-portion-length",
            "the Levites' allotment, length",
            "length",
            25000,
            "long-cubit",
            "clear",
            [(45, 5, None), (48, 13, None)],
            None,
            None,
        ),
    ),
    (
        "levites-portion",
        (
            "eza-levites-portion-breadth",
            "the Levites' allotment, breadth",
            "breadth",
            10000,
            "long-cubit",
            "clear",
            [(45, 5, None), (48, 13, None)],
            None,
            "ESV follows the Septuagint at 45:5 for the holding's use ('as "
            "their possession for cities to live in'; Hebrew 'as their "
            "possession, twenty chambers' - ESV footnote).",
        ),
    ),
    # ------------------------------------------- the property of the city
    (
        "city-portion",
        (
            "eza-city-portion-breadth",
            "the property of the city, breadth",
            "breadth",
            5000,
            "long-cubit",
            "clear",
            [(45, 6, None), (48, 15, None)],
            None,
            "For common use for the city, for dwellings and for open "
            "country (48:15); it belongs to the whole house of Israel "
            "(45:6).",
        ),
    ),
    (
        "city-portion",
        (
            "eza-city-portion-length",
            "the property of the city, length",
            "length",
            25000,
            "long-cubit",
            "clear",
            [(45, 6, None), (48, 15, None)],
            None,
            None,
        ),
    ),
    (
        "city-portion",
        (
            "eza-city-remainder-east",
            "remainder of the city strip alongside the holy portion, to the east",
            "length",
            10000,
            "long-cubit",
            "clear",
            [(48, 18, None)],
            None,
            "Its produce is food for the workers of the city, who come from "
            "all the tribes of Israel (48:18-19).",
        ),
    ),
    (
        "city-portion",
        (
            "eza-city-remainder-west",
            "remainder of the city strip alongside the holy portion, to the west",
            "length",
            10000,
            "long-cubit",
            "clear",
            [(48, 18, None)],
            None,
            "See eza-city-remainder-east.",
        ),
    ),
    # ------------------------------------------------------ the city itself
    (
        "ezekiel-city",
        (
            "eza-city-side",
            "the city, each of its four sides",
            "side",
            4500,
            "long-cubit",
            "clear",
            [
                (48, 16, None),
                (48, 30, None),
                (48, 32, None),
                (48, 33, None),
                (48, 34, None),
            ],
            None,
            "Four equal sides, north, south, east, and west (48:16); "
            "repeated per side in the gate roster (48:30-34).",
        ),
    ),
    (
        "ezekiel-city",
        (
            "eza-city-open-land",
            "open land around the city, on each side",
            "breadth",
            250,
            "long-cubit",
            "clear",
            [(48, 17, None)],
            None,
            None,
        ),
    ),
    (
        "ezekiel-city",
        (
            "eza-city-gates-per-side",
            "gates of the city on each side, named after the tribes of Israel",
            "count",
            3,
            "item",
            "clear",
            [(48, 30, 34)],
            None,
            "Three per side, twelve in all: Reuben, Judah, Levi (north); "
            "Joseph, Benjamin, Dan (east); Simeon, Issachar, Zebulun "
            "(south); Gad, Asher, Naphtali (west). 48:34's gate phrasing "
            "carries a minor text-critical variant (ESV footnote: one "
            "Hebrew manuscript, Syriac; most Hebrew manuscripts 'their "
            "gates three') that does not affect the count.",
        ),
    ),
    (
        "ezekiel-city",
        (
            "eza-city-circumference",
            "the circumference of the city",
            "distance",
            18000,
            "long-cubit",
            "clear",
            [(48, 35, None)],
            None,
            "Equals the four 4,500-cubit sides (48:16). Recorded under "
            "dimension 'distance' - the schema's closest fit for a "
            "perimeter.",
        ),
    ),
    # ------------------------- the sanctuary plot (attaches to the temple)
    (
        "ezekiel-temple",
        (
            "eza-sanctuary-plot-side",
            "square plot for the sanctuary within the holy district",
            "side",
            500,
            "long-cubit",
            "clear",
            [(45, 2, None)],
            None,
            "Corroborates the ESV's 500-cubit reading of the 42:16-20 "
            "precinct measure (see ezt-precinct-side).",
        ),
    ),
    (
        "ezekiel-temple",
        (
            "eza-sanctuary-open-space",
            "open space around the sanctuary plot",
            "breadth",
            50,
            "long-cubit",
            "clear",
            [(45, 2, None)],
            None,
            None,
        ),
    ),
]

__all__ = ["ALLOTMENT_ENTITIES", "ALLOTMENT_MEASUREMENTS", "Cite", "Record"]
