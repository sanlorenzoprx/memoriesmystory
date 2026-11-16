-- Scheduled integrity (fixity) checks on stored files (A5, lane L3).
-- Each row records one re-hash of one stored object against the hash recorded
-- when it was preserved. Rows are never changed. They are removed only when
-- the memory they belong to is deleted, so no hash of deleted family media is
-- kept. A check never repairs or rewrites the object it checks.
CREATE TABLE fixity_checks (
 id TEXT PRIMARY KEY,
 source_kind TEXT NOT NULL CHECK(source_kind IN ('asset','voice-reply','contribution-voice','contribution-photo','session-recording','session-source')),
 source_id TEXT NOT NULL,
 outcome TEXT NOT NULL CHECK(outcome IN ('match','mismatch','missing')),
 expected_sha256 TEXT NOT NULL CHECK(length(expected_sha256)=64),
 observed_sha256 TEXT CHECK(observed_sha256 IS NULL OR length(observed_sha256)=64),
 observed_byte_size INTEGER CHECK(observed_byte_size IS NULL OR observed_byte_size>=0),
 checked_at TEXT NOT NULL,
 CHECK((outcome='missing')=(observed_sha256 IS NULL)),
 CHECK(outcome<>'match' OR observed_sha256=expected_sha256)
);
CREATE INDEX fixity_checks_source ON fixity_checks(source_id,checked_at);
CREATE INDEX fixity_checks_outcome ON fixity_checks(outcome,checked_at);
CREATE TRIGGER fixity_checks_immutable BEFORE UPDATE ON fixity_checks
BEGIN SELECT RAISE(ABORT,'fixity results are append-only'); END;
