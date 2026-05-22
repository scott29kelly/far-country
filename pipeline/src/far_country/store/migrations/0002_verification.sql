-- Persist citation-verification results produced by `far-country verify run`.
-- Each row is one (descriptor, citation) check for a given extraction run.
-- Re-running verification for the same descriptor/citation/run inserts a new
-- row; history is preserved so reviewers can see how a verdict changed over
-- time (e.g., when the judge is later added or thresholds are tuned).

CREATE TABLE IF NOT EXISTS verification (
    id              TEXT PRIMARY KEY,
    descriptor_id   TEXT NOT NULL REFERENCES descriptor(id),
    citation_id     TEXT NOT NULL REFERENCES citation(id),
    run_id          TEXT NOT NULL REFERENCES extraction_run(id),
    score           REAL NOT NULL,
    status          TEXT NOT NULL CHECK (status IN ('pass','partial','fail')),
    rationale       TEXT NOT NULL,
    judge_status    TEXT CHECK (judge_status IS NULL OR judge_status IN
                      ('pass','partial','fail')),
    judge_rationale TEXT,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_run        ON verification(run_id);
CREATE INDEX IF NOT EXISTS idx_verification_descriptor ON verification(descriptor_id);
CREATE INDEX IF NOT EXISTS idx_verification_citation   ON verification(citation_id);
