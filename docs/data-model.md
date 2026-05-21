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

CREATE INDEX idx_descriptor_entity ON descriptor(entity_id);
CREATE INDEX idx_descriptor_tier   ON descriptor(tier);
CREATE INDEX idx_descriptor_status ON descriptor(review_status);
CREATE INDEX idx_citation_descriptor ON citation(descriptor_id);
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

Captures whether the descriptor refers to:
- `intermediate` — the state of the soul between death and bodily resurrection (e.g., "to be absent from the body is to be at home with the Lord," 2 Cor 5:8)
- `final` — the eternal state after bodily resurrection and the new heavens-and-new-earth (e.g., Rev 21–22 material)
- `either` — descriptors that apply to both phases (e.g., the presence of God)
- `unspecified` — Scripture does not clearly indicate phase; routed to review

This addresses PRD Open Question Q1.

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
