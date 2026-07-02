-- Measurements: cited dimensional data driving parametric geometry (ADR 0017).
-- Values are TEXT-NATIVE (long cubits, reeds, spans, stadia, counts) — never a
-- metric conversion; meters happen in the units/scale resolver (ADR 0018) at
-- consumption. Ids are STABLE SLUGS because geometry code references
-- measurements by id (ADR 0017 decision 3).

CREATE TABLE IF NOT EXISTS measurement (
  id              TEXT PRIMARY KEY,
  entity_id       TEXT NOT NULL REFERENCES entity(id),
  subject         TEXT NOT NULL,
  dimension       TEXT NOT NULL CHECK (dimension IN
                    ('length','breadth','height','thickness','depth',
                     'distance','side','count')),
  value           REAL NOT NULL,
  unit            TEXT NOT NULL CHECK (unit IN
                    ('long-cubit','cubit','reed','handbreadth','span',
                     'stadia','step','story','item')),
  basis           TEXT,
  tier            TEXT NOT NULL CHECK (tier IN
                    ('clear','fuzzy','debated','symbolic')),
  notes           TEXT,
  review_status   TEXT NOT NULL CHECK (review_status IN
                    ('pending','approved','rejected','needs-discussion'))
                    DEFAULT 'pending',
  reviewer_notes  TEXT,
  provenance      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

-- Citations for measurements — same shape as `citation`, keyed to measurement
-- rows (additive mirror; `citation.descriptor_id` stays NOT NULL).
CREATE TABLE IF NOT EXISTS measurement_citation (
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

CREATE INDEX IF NOT EXISTS idx_measurement_entity ON measurement(entity_id);
CREATE INDEX IF NOT EXISTS idx_measurement_status ON measurement(review_status);
CREATE INDEX IF NOT EXISTS idx_measurement_citation_measurement ON measurement_citation(measurement_id);
