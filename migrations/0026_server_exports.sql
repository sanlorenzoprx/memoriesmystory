-- Server-built exports for archives too large for one device (lane L3).
-- A job lists every original to include; a background pass reads each one
-- once to record its ZIP checksum and confirm its SHA-256 against the
-- preserved record. Downloads stream each original straight from storage
-- after a small header. Jobs expire after seven days, and deleting a memory
-- removes its owner's prepared exports.
CREATE TABLE server_export_jobs (
 id TEXT PRIMARY KEY,
 owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 state TEXT NOT NULL CHECK(state IN ('building','ready','failed')),
 locale TEXT NOT NULL,
 file_count INTEGER NOT NULL CHECK(file_count>=0),
 total_bytes INTEGER NOT NULL CHECK(total_bytes>=0),
 volume_count INTEGER NOT NULL CHECK(volume_count>=1),
 next_position INTEGER NOT NULL DEFAULT 0,
 error_code TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE UNIQUE INDEX server_export_one_building ON server_export_jobs(owner_user_id) WHERE state='building';
CREATE INDEX server_export_jobs_owner ON server_export_jobs(owner_user_id,created_at);
CREATE INDEX server_export_jobs_expiry ON server_export_jobs(expires_at);
CREATE TABLE server_export_entries (
 job_id TEXT NOT NULL REFERENCES server_export_jobs(id) ON DELETE CASCADE,
 position INTEGER NOT NULL CHECK(position>=0),
 volume INTEGER NOT NULL CHECK(volume>=1),
 memory_story_id TEXT NOT NULL,
 path TEXT NOT NULL,
 r2_key TEXT NOT NULL,
 byte_size INTEGER NOT NULL CHECK(byte_size>=0),
 expected_sha256 TEXT NOT NULL CHECK(length(expected_sha256)=64),
 crc32 INTEGER,
 verified INTEGER CHECK(verified IS NULL OR verified IN (0,1)),
 PRIMARY KEY(job_id,position)
);
CREATE INDEX server_export_entries_volume ON server_export_entries(job_id,volume,position);
