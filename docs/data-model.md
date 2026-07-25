# Data Model

This document defines the canonical schema for the Far Country dataset. It is the single source of truth for what a "descriptor" is, what fields it carries, and how entities relate. The SQLite store and the JSON exports both conform to this schema.

The schema is intentionally minimal. We add fields only when a concrete need appears.

---

## 1. Entity types

The world model describes heaven in five entity types:

| Entity type | Meaning | Examples |
| --- | --- | --- |
| `Person` | Named or categorical persons present in heaven | God the Father, Jesus Christ, the Holy Spirit, the angels, the four living creatures, the 24 elders, the redeemed, named saints |
| `Place` | Locations, regions, structures | New Jerusalem, the throne room, the city walls, the gates, the river of life, the new earth, the new heavens |
| `Thing` | Objects, materials, artifacts | Tree of life, sea of glass, golden lampstands, white robes, crowns, the book of life |
| `Event` | Actions, occurrences, ongoing realities | Bodily resurrection, the marriage supper of the Lamb, the final judgment, the wiping away of tears |
| `Attribute` | Qualities, conditions, absences | No more death, no night, no sun needed, perfect knowledge, glorified bodies |

Each entity carries descriptors. A descriptor is a single, citation-grounded statement about that entity.

---

## 2. Tables (canonical SQLite schema)

```sql
-- Entities: the "things" in the world model
CREATE TABLE entity (
  id              TEXT PRIMARY KEY,          -- stable slug, e.g. 'new-jerusalem'
  name            TEXT NOT NULL,             -- display name
  entity_type     TEXT NOT NULL CHECK (entity_type IN
                    ('person','place','thing','event','attribute')),
  summary         TEXT,                      -- 1–3 sentence introduction
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- Descriptors: individual sourced claims about an entity
CREATE TABLE descriptor (
  id              TEXT PRIMARY KEY,          -- uuid
  entity_id       TEXT NOT NULL REFERENCES entity(id),
  statement       TEXT NOT NULL,             -- the descriptor itself, in plain prose
  tier            TEXT NOT NULL CHECK (tier IN
                    ('clear','fuzzy','debated','symbolic')),
  symbolic_referent TEXT,                    -- required iff tier='symbolic'
  temporal_phase  TEXT CHECK (temporal_phase IN
                    ('intermediate','final','either','unspecified')),
  review_status   TEXT NOT NULL CHECK (review_status IN
                    ('pending','approved','rejected','needs-discussion'))
                    DEFAULT 'pending',
  reviewer_notes  TEXT,
  provenance      TEXT,                      -- JSON: which extraction run, prompt version, model
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- Citations: pointers from descriptors back to source text
CREATE TABLE citation (
  id              TEXT PRIMARY KEY,
  descriptor_id   TEXT NOT NULL REFERENCES descriptor(id),
  source_type     TEXT NOT NULL CHECK (source_type IN ('scripture','willis','secondary')),
  -- Scripture fields (used when source_type='scripture')
  book            TEXT,                      -- 'Revelation'
  chapter         INTEGER,
  verse_start     INTEGER,
  verse_end       INTEGER,                   -- nullable; null = single verse
  -- Willis fields (used when source_type='willis')
  willis_chapter  TEXT,
  willis_page_start INTEGER,
  willis_page_end INTEGER,
  -- Secondary fields (used when source_type='secondary')
  secondary_work  TEXT,                      -- e.g. 'Alcorn, Heaven'
  secondary_locator TEXT,                    -- chapter/page/section
  quote           TEXT,                      -- optional supporting quote
  created_at      TEXT NOT NULL
);

-- Relations: entity-to-entity links (where applicable)
CREATE TABLE entity_relation (
  id              TEXT PRIMARY KEY,
  from_entity_id  TEXT NOT NULL REFERENCES entity(id),
  to_entity_id    TEXT NOT NULL REFERENCES entity(id),
  relation_type   TEXT NOT NULL,             -- 'contains','located-in','part-of','associated-with'
  notes           TEXT,
  created_at      TEXT NOT NULL
);

-- Provenance: what extraction runs produced what
CREATE TABLE extraction_run (
  id              TEXT PRIMARY KEY,
  started_at      TEXT NOT NULL,
  completed_at    TEXT,
  model           TEXT NOT NULL,             -- e.g. 'claude-opus-4-7'
  prompt_version  TEXT NOT NULL,             -- semver, e.g. '0.1.0'
  source_scope    TEXT NOT NULL,             -- 'esv:revelation:21-22', 'willis:ch3', etc.
  descriptor_count INTEGER,
  notes           TEXT
);

-- Audit log of citation-verification runs. Each row is one (descriptor,
-- citation) check produced by `far-country verify run`. Re-running verify
-- appends new rows rather than overwriting, so verdict history is preserved.
CREATE TABLE verification (
  id              TEXT PRIMARY KEY,
  descriptor_id   TEXT NOT NULL REFERENCES descriptor(id),
  citation_id     TEXT NOT NULL REFERENCES citation(id),
  run_id          TEXT NOT NULL REFERENCES extraction_run(id),
  score           REAL NOT NULL,             -- 0..1 keyword-overlap score
  status          TEXT NOT NULL CHECK (status IN ('pass','partial','fail')),
  rationale       TEXT NOT NULL,
  judge_status    TEXT CHECK (judge_status IS NULL OR judge_status IN
                    ('pass','partial','fail')),
  judge_rationale TEXT,
  created_at      TEXT NOT NULL
);

-- Measurements: cited dimensional data driving parametric geometry
-- (ADR 0017). Values are TEXT-NATIVE — the unit is what the text says
-- (long cubits, reeds, spans, stadia, counts), never a metric conversion;
-- meters happen in the units/scale resolver (ADR 0018) at consumption.
CREATE TABLE measurement (
  id              TEXT PRIMARY KEY,          -- STABLE SLUG, e.g. 'ezt-precinct-side'
                                             -- (geometry code references measurements
                                             -- by id — ADR 0017 decision 3)
  entity_id       TEXT NOT NULL REFERENCES entity(id),
  subject         TEXT NOT NULL,             -- what is measured, plain prose
  dimension       TEXT NOT NULL CHECK (dimension IN
                    ('length','breadth','height','thickness','depth',
                     'distance','side','count')),
  value           REAL NOT NULL,             -- the number as given in the text
  unit            TEXT NOT NULL CHECK (unit IN
                    ('long-cubit','cubit','reed','handbreadth','span',
                     'stadia','step','story','item')),
  basis           TEXT,                      -- derivation note, e.g. 'reed = 6 long cubits (Ezek 40:5)'
  tier            TEXT NOT NULL CHECK (tier IN
                    ('clear','fuzzy','debated','symbolic')),
  notes           TEXT,                      -- text-critical / interpretive notes (ESV footnotes etc.)
  review_status   TEXT NOT NULL CHECK (review_status IN
                    ('pending','approved','rejected','needs-discussion'))
                    DEFAULT 'pending',
  reviewer_notes  TEXT,
  provenance      TEXT,                      -- JSON: which run/session authored it
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- Citations for measurements — same shape as `citation`, keyed to
-- measurement rows (additive mirror; `citation.descriptor_id` stays NOT NULL)
CREATE TABLE measurement_citation (
  id              TEXT PRIMARY KEY,
  measurement_id  TEXT NOT NULL REFERENCES measurement(id),
  source_type     TEXT NOT NULL CHECK (source_type IN ('scripture','willis','secondary')),
  book            TEXT,
  chapter         INTEGER,
  verse_start     INTEGER,
  verse_end       INTEGER,
  willis_chapter  TEXT,
  willis_page_start INTEGER,
  willis_page_end INTEGER,
  secondary_work  TEXT,
  secondary_locator TEXT,
  quote           TEXT,
  created_at      TEXT NOT NULL
);

CREATE INDEX idx_descriptor_entity ON descriptor(entity_id);
CREATE INDEX idx_descriptor_tier   ON descriptor(tier);
CREATE INDEX idx_descriptor_status ON descriptor(review_status);
CREATE INDEX idx_citation_descriptor ON citation(descriptor_id);
CREATE INDEX idx_verification_run        ON verification(run_id);
CREATE INDEX idx_verification_descriptor ON verification(descriptor_id);
CREATE INDEX idx_verification_citation   ON verification(citation_id);
CREATE INDEX idx_measurement_entity ON measurement(entity_id);
CREATE INDEX idx_measurement_status ON measurement(review_status);
CREATE INDEX idx_measurement_citation_measurement ON measurement_citation(measurement_id);
```

---

## 3. Field semantics

### `descriptor.statement`

A single self-contained claim, written in clear English. Not a paraphrase of the verse — a *claim* about heaven that the verse supports. Examples:

- ✓ "The walls of the New Jerusalem are made of jasper."
- ✓ "There is no temple in the New Jerusalem because God Almighty and the Lamb are its temple."
- ✗ "Revelation 21:22 says there is no temple." *(meta-claim; not what we want)*
- ✗ "Heaven is amazing." *(unfalsifiable, ungrounded, useless)*

### `descriptor.tier`

See [`hermeneutics.md`](hermeneutics.md) §4. Routing label, not quality label.

### `descriptor.symbolic_referent`

**Required when `tier='symbolic'`.** Identifies what the symbol points to. Without it, a `symbolic` descriptor is just an image with no anchor — we do not allow that.

Example for "the streets of the city are pure gold, like transparent glass" (Rev 21:21):
- `symbolic_referent`: "divine glory, supreme value, and purity — gold as the most precious earthly material gestures at heavenly worth; transparency underscores that this exceeds known gold."

### `descriptor.temporal_phase`

Captures the phase of redemptive history a descriptor refers to:
- `intermediate` — the state of the soul between death and bodily resurrection (e.g., "to be absent from the body is to be at home with the Lord," 2 Cor 5:8)
- `final` — the eternal state: after the general resurrection, in the new heavens and new earth in their final, deathless form (much of Rev 21–22)
- `either` — descriptors that apply across phases (e.g., the presence of God)
- `unspecified` — Scripture does not clearly indicate phase; routed to review

This addresses PRD Open Question Q1.

> **Premillennial framing — known schema gap ([ADR 0012](adr/0012-eschatological-framing-premillennial.md)).**
> Under the project's eschatological framing, future-facing redemptive history has
> **three** phases, not two: the **intermediate** state, the **millennial kingdom**
> (Christ reigning, the New Jerusalem descended, restored Israel and its Ezekiel
> 40–48 temple, mortal nations alongside resurrected saints), and the **eternal
> state**. The enum above has **no value for the millennial phase**, and `final`
> as defined conflates "millennial" with "eternal." This is a known gap. The fix —
> add a `millennial` value to the enum, or carry a separate age-spanning field —
> requires a migration of `canonical.sqlite` (a CHECK-constraint change) and is
> **deferred to the Phase 1 data-model pass**, documented here rather than silently
> applied. Note: ADR 0008 had disabled `intermediate`; ADR 0012 re-enables it, so it
> remains valid in the enum above and in the `CHECK` constraint near the top of this
> document.

### `descriptor.review_status`

The lifecycle of a descriptor:

```
                    ┌──────────────┐
       extraction → │   pending    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┬──────────────────┐
              ▼            ▼            ▼                  ▼
        ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐
        │ approved │  │ rejected │  │ needs-    │  │  (sent back to   │
        └──────────┘  └──────────┘  │ discussion│  │   pending after  │
                                    └─────┬─────┘  │   edit)          │
                                          │        └──────────────────┘
                                          ▼
                                    (manual resolution)
```

Only `approved` descriptors are exported to consumers (browse UI, 3D layer, Q&A).

### `citation`

A descriptor must have at least one citation. Typical pattern:

- 1 scripture citation (always) + 0–1 willis citations.
- For `debated` descriptors, often 2–3 scripture citations spanning different passages.
- `secondary` citations are supporting only; they cannot stand alone.

### `measurement`

A cited dimensional fact (ADR 0017). Distinctives vs descriptors:

- **`id` is a stable slug**, not a UUID — geometry code consumes measurements
  by id (e.g. `ezt-precinct-side`), so ids are part of the public contract.
- **`value` + `unit` are text-native.** "One reed" is stored as `1 reed`, not
  `6` and not `3.15 m`. `basis` records in-text derivations ("reed = 6 long
  cubits, Ezek 40:5"). The metric realization is the resolver's job
  (ADR 0018); the store never contains meters.
- **Counts use `unit='item'|'story'|'step'`** with `dimension='count'`
  (thirty chambers, three stories, seven steps).
- **No `temporal_phase`.** Phase belongs to the entity and its descriptors;
  a measurement is a property of the structure the entity describes. (This
  also avoids the known millennial-phase enum gap, ADR 0012.)
- **Tiers work as for descriptors.** Text-critical variants (ESV following
  the Septuagint at Ezek 40:48–49; the cubits-vs-reeds question at Ezek
  42:16–20) are tiered `fuzzy`/`debated` with the variant documented in
  `notes` — rendered readings follow the ESV as printed, recorded in
  `RENDERING-DECISIONS.md` per ADR 0009 rule 4.
- Only `approved` measurements export or drive geometry.

### `entity_relation`

Used for the world model graph. Examples:

- `(throne, contains, river-of-life)` — "out from the throne" (Rev 22:1)
- `(river-of-life, flows-through, new-jerusalem)`
- `(twelve-gates, part-of, new-jerusalem)`
- `(twelve-foundations, inscribed-with, twelve-apostles)`

Relation types are not pre-fixed; we will grow the vocabulary as needed and freeze it before Phase 2.

---

## 4. JSON export shape

The canonical export is a flat JSON file plus per-entity files for the browse UI:

```json
// data/exports/canonical.json
{
  "schema_version": "0.1.0",
  "generated_at": "2026-05-21T00:00:00Z",
  "entities": [ ... ],
  "descriptors": [ ... ],
  "citations": [ ... ],
  "relations": [ ... ]
}
```

```json
// data/exports/entities/new-jerusalem.json
{
  "id": "new-jerusalem",
  "name": "The New Jerusalem",
  "entity_type": "place",
  "summary": "The eternal city of God, descending out of heaven from God, prepared as a bride adorned for her husband.",
  "descriptors": [
    {
      "id": "...",
      "statement": "The New Jerusalem comes down out of heaven from God.",
      "tier": "clear",
      "temporal_phase": "final",
      "citations": [
        {"source_type": "scripture", "book": "Revelation", "chapter": 21, "verse_start": 2}
      ]
    }
  ],
  "relations": [ ... ]
}
```

Only `review_status='approved'` descriptors appear in exports.

**Which entities qualify (schema 0.3.0).** An entity is exported when it is
grounded in *something* approved and cited — at least one descriptor **or** at
least one measurement. Measurements carry the same citation, tier, and review
discipline as descriptors (ADR 0017), so a measurement-only entity (the Ezek
45:4-5 campus zones, Ezekiel's temple) is approved content, not noise, and
appears both as a per-entity file and in `canonical.json`'s `entities` array
so the browse index can find it.

The `descriptors` and `citations` arrays stay strictly descriptor-driven. This
is deliberate and load-bearing: Q&A retrieval embeds `canonical.descriptors`,
so a measurement-only entity contributes no embeddable row and the
grounded-answer contract ("every answer cites a descriptor") is unchanged by
this widening. Consumers must therefore handle an entity with zero descriptors.
Tier filtering in the browse UI is likewise descriptor-driven — an entity
grounded only by measurements is searchable by name but matches no tier chip.

Measurements export to their own file (additive — existing consumers are
untouched), and to a generated, citation-annotated TypeScript module vendored
into the world engine (ADR 0017 decision 3):

```json
// data/exports/measurements.json
{
  "schema_version": "0.1.0",
  "generated_at": "...",
  "measurements": [
    {
      "id": "ezt-outer-wall-thickness",
      "entity_id": "ezekiel-temple",
      "subject": "thickness of the wall around the outside of the temple area",
      "dimension": "thickness",
      "value": 1, "unit": "reed",
      "basis": "reed = 6 long cubits (Ezek 40:5)",
      "tier": "clear",
      "citations": [
        {"source_type": "scripture", "book": "Ezekiel", "chapter": 40, "verse_start": 5}
      ]
    }
  ]
}
```

---

## 5. Versioning

- **Schema:** semver. Breaking changes increment major. Field additions increment minor.
- **Prompt versions:** semver, tracked in `extraction_run.prompt_version`. Allows us to re-run extraction over the same source with a refined prompt and compare.
- **Exports:** every export is timestamped and includes `schema_version`. Consumers (browse UI, 3D layer) check schema_version on load.

---

## 6. What lives outside the SQLite store

- **Source text:** ESV text is fetched from the API at extraction time and not stored in canonical.sqlite (licensing). Willis text is held in `data/raw/willis/` locally, not committed.
- **Embeddings / retrieval indices:** generated on demand for Phase 2 Q&A; live in `data/cache/`.
- **3D assets:** procedurally generated from the dataset at render time, with any baked geometry stored under `apps/world/public/`.

This keeps the canonical store small, portable, and re-derivable.
