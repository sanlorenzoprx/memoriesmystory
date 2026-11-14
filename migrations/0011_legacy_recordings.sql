CREATE INDEX legacy_consent_participant_idx ON legacy_consent_events(participant_id);
CREATE TABLE legacy_recordings (
 id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL REFERENCES legacy_sessions(id) ON DELETE CASCADE,
 captured_by_participant_id TEXT NOT NULL REFERENCES legacy_participants(id) ON DELETE CASCADE,
 consent_epoch INTEGER NOT NULL,
 consent_snapshot_json TEXT NOT NULL,
 source_photo_asset_id TEXT NOT NULL,
 created_at TEXT NOT NULL,
 upload_expires_at TEXT NOT NULL
);
CREATE INDEX legacy_recordings_session_idx ON legacy_recordings(session_id,created_at);
CREATE TRIGGER legacy_recording_immutable BEFORE UPDATE ON legacy_recordings
BEGIN SELECT RAISE(ABORT,'original recording provenance is immutable'); END;
CREATE TRIGGER legacy_recording_scope BEFORE INSERT ON legacy_recordings
WHEN NOT EXISTS (
 SELECT 1 FROM legacy_sessions s JOIN legacy_participants p ON p.session_id=s.id
 WHERE s.id=NEW.session_id AND s.mode='in_person' AND s.status!='closed'
 AND s.photo_asset_id=NEW.source_photo_asset_id AND s.consent_epoch=NEW.consent_epoch
 AND p.id=NEW.captured_by_participant_id AND p.role='host' AND p.revoked_at IS NULL
 AND 2=(SELECT count(*) FROM legacy_participants a WHERE a.session_id=s.id AND a.revoked_at IS NULL AND a.joined_at IS NOT NULL AND a.consent='accepted' AND a.consent_version='legacy-recording-v1' AND (a.role='host' OR a.access_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')))
)
BEGIN SELECT RAISE(ABORT,'recording requires the host and both current consents'); END;
CREATE TABLE legacy_recording_media (
 recording_id TEXT PRIMARY KEY REFERENCES legacy_recordings(id) ON DELETE CASCADE,
 r2_key TEXT NOT NULL UNIQUE,
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 byte_size INTEGER NOT NULL CHECK(byte_size>0),
 content_type TEXT NOT NULL,
 duration_ms INTEGER NOT NULL CHECK(duration_ms>0),
 interrupted INTEGER NOT NULL CHECK(interrupted IN (0,1)),
 durability_status TEXT NOT NULL CHECK(durability_status IN ('pending','durable')),
 r2_etag TEXT,
 durable_at TEXT,
 CHECK(durability_status!='durable' OR (r2_etag IS NOT NULL AND durable_at IS NOT NULL))
);
CREATE TRIGGER legacy_recording_media_immutable BEFORE UPDATE OF recording_id,r2_key,sha256,byte_size,content_type,duration_ms,interrupted ON legacy_recording_media
BEGIN SELECT RAISE(ABORT,'original recording bytes and metadata are immutable'); END;
CREATE TRIGGER legacy_recording_durable_consent BEFORE UPDATE OF durability_status ON legacy_recording_media
WHEN NEW.durability_status='durable' AND OLD.durability_status!='durable' AND NOT EXISTS (
 SELECT 1 FROM legacy_recordings r JOIN legacy_sessions s ON s.id=r.session_id
 WHERE r.id=NEW.recording_id AND s.status!='closed' AND r.consent_epoch=s.consent_epoch
 AND 2=(SELECT count(*) FROM legacy_participants a WHERE a.session_id=s.id AND a.revoked_at IS NULL AND a.joined_at IS NOT NULL AND a.consent='accepted' AND a.consent_version='legacy-recording-v1' AND (a.role='host' OR a.access_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')))
)
BEGIN SELECT RAISE(ABORT,'recording consent changed before durable confirmation'); END;
CREATE TABLE legacy_recording_claims (
 id TEXT PRIMARY KEY,
 recording_id TEXT NOT NULL REFERENCES legacy_recordings(id) ON DELETE CASCADE,
 participant_id TEXT NOT NULL REFERENCES legacy_participants(id) ON DELETE CASCADE,
 start_ms INTEGER NOT NULL CHECK(start_ms>=0),
 end_ms INTEGER NOT NULL CHECK(end_ms>start_ms),
 note TEXT NOT NULL,
 attribution_type TEXT NOT NULL CHECK(attribution_type='self_identified'),
 created_at TEXT NOT NULL
);
CREATE TRIGGER legacy_recording_claim_immutable BEFORE UPDATE ON legacy_recording_claims
BEGIN SELECT RAISE(ABORT,'speaker attribution history is additive'); END;
CREATE TRIGGER legacy_recording_claim_scope BEFORE INSERT ON legacy_recording_claims
WHEN NOT EXISTS (
 SELECT 1 FROM legacy_recordings r JOIN legacy_recording_media m ON m.recording_id=r.id
 JOIN legacy_participants p ON p.session_id=r.session_id
 WHERE r.id=NEW.recording_id AND p.id=NEW.participant_id AND p.revoked_at IS NULL
 AND p.joined_at IS NOT NULL AND m.durability_status='durable' AND NEW.end_ms<=m.duration_ms
)
BEGIN SELECT RAISE(ABORT,'speaker attribution requires a participant and preserved source range'); END;

CREATE TRIGGER legacy_recording_durable_insert_forbidden BEFORE INSERT ON legacy_recording_media
WHEN NEW.durability_status='durable'
BEGIN SELECT RAISE(ABORT,'recording must pass pending storage before durable confirmation'); END;

CREATE TRIGGER legacy_recording_receipt_immutable BEFORE UPDATE ON legacy_recording_media
WHEN OLD.durability_status='durable'
BEGIN SELECT RAISE(ABORT,'durable recording receipt is immutable'); END;

ALTER TABLE legacy_sessions ADD COLUMN deletion_requested_at TEXT;
