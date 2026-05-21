-- Initial schema for the Far Country canonical store.
-- Mirrors docs/data-model.md §2. Update both together when the schema evolves.

CREATE TABLE IF NOT EXISTS entity (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    entity_type  TEXT NOT NULL CHECK (entity_type IN
                   ('person','place','thing','event','attribute')),
    summary      TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS descriptor (
    id                TEXT PRIMARY KEY,
    entity_id         TEXT NOT NULL REFERENCES entity(id),
    statement         TEXT NOT NULL,
    tier              TEXT NOT NULL CHECK (tier IN
                        ('clear','fuzzy','debated','symbolic')),
    symbolic_referent TEXT,
    temporal_phase    TEXT CHECK (temporal_phase IN
                        ('intermediate','final','either','unspecified')),
    review_status     TEXT NOT NULL CHECK (review_status IN
                        ('pending','approved','rejected','needs-discussion'))
                        DEFAULT 'pending',
    reviewer_notes    TEXT,
    provenance        TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    -- symbolic_referent is required iff tier='symbolic' (docs/data-model.md §3).
    CHECK (tier != 'symbolic' OR symbolic_referent IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS citation (
    id                 TEXT PRIMARY KEY,
    descriptor_id      TEXT NOT NULL REFERENCES descriptor(id),
    source_type        TEXT NOT NULL CHECK (source_type IN
                         ('scripture','willis','secondary')),
    book               TEXT,
    chapter            INTEGER,
    verse_start        INTEGER,
    verse_end          INTEGER,
    willis_chapter     TEXT,
    willis_page_start  INTEGER,
    willis_page_end    INTEGER,
    secondary_work     TEXT,
    secondary_locator  TEXT,
    quote              TEXT,
    created_at         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_relation (
    id             TEXT PRIMARY KEY,
    from_entity_id TEXT NOT NULL REFERENCES entity(id),
    to_entity_id   TEXT NOT NULL REFERENCES entity(id),
    relation_type  TEXT NOT NULL,
    notes          TEXT,
    created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extraction_run (
    id               TEXT PRIMARY KEY,
    started_at       TEXT NOT NULL,
    completed_at     TEXT,
    model            TEXT NOT NULL,
    prompt_version   TEXT NOT NULL,
    source_scope     TEXT NOT NULL,
    descriptor_count INTEGER,
    notes            TEXT
);

CREATE INDEX IF NOT EXISTS idx_descriptor_entity   ON descriptor(entity_id);
CREATE INDEX IF NOT EXISTS idx_descriptor_tier     ON descriptor(tier);
CREATE INDEX IF NOT EXISTS idx_descriptor_status   ON descriptor(review_status);
CREATE INDEX IF NOT EXISTS idx_citation_descriptor ON citation(descriptor_id);
