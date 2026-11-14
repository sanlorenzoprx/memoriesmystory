-- Managed remote recordings remain distinct from D02's single in-person microphone.
CREATE TABLE legacy_remote_recordings (
 id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL REFERENCES legacy_sessions(id) ON DELETE CASCADE,
 created_by_participant_id TEXT NOT NULL REFERENCES legacy_participants(id) ON DELETE RESTRICT,
 source_photo_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
 consent_epoch INTEGER NOT NULL,
 consent_snapshot_json TEXT NOT NULL CHECK(json_valid(consent_snapshot_json)),
 provider_meeting_id TEXT NOT NULL,
 provider_track_id TEXT,
 provider_composite_id TEXT,
 phase TEXT NOT NULL CHECK(phase IN ('queued','allocating_track','queued_composite','allocating_composite','preparing','recording','stopping','processing','preserved','partial_preserved','needs_review','failed','discarded')),
 capture_stopped INTEGER NOT NULL DEFAULT 0 CHECK(capture_stopped IN (0,1)),
 stop_requested_at TEXT,
 max_duration_seconds INTEGER NOT NULL CHECK(max_duration_seconds>=60),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 preserved_at TEXT,
 failure_code TEXT,
 failure_count INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT,
 lease_expires_at TEXT
);
CREATE UNIQUE INDEX legacy_remote_one_active_recording ON legacy_remote_recordings(session_id)
WHERE phase NOT IN ('preserved','partial_preserved','needs_review','failed','discarded');
CREATE INDEX legacy_remote_recordings_session ON legacy_remote_recordings(session_id,created_at DESC);
CREATE TRIGGER legacy_remote_recording_authority_immutable
BEFORE UPDATE OF session_id,created_by_participant_id,source_photo_asset_id,consent_epoch,consent_snapshot_json,provider_meeting_id,max_duration_seconds,created_at ON legacy_remote_recordings
BEGIN SELECT RAISE(ABORT,'recording source and consent snapshot are immutable'); END;
CREATE TRIGGER legacy_remote_recording_provider_identity
BEFORE UPDATE OF provider_track_id,provider_composite_id ON legacy_remote_recordings
WHEN (OLD.provider_track_id IS NOT NULL AND NEW.provider_track_id IS NOT OLD.provider_track_id)
 OR (OLD.provider_composite_id IS NOT NULL AND NEW.provider_composite_id IS NOT OLD.provider_composite_id)
BEGIN SELECT RAISE(ABORT,'provider recording identity is immutable'); END;
CREATE TRIGGER legacy_remote_recording_create_scope BEFORE INSERT ON legacy_remote_recordings
WHEN NOT EXISTS (
 SELECT 1 FROM legacy_sessions s JOIN legacy_participants p ON p.session_id=s.id
 JOIN legacy_remote_calls c ON c.session_id=s.id
 WHERE s.id=NEW.session_id AND s.mode='remote' AND s.status!='closed' AND s.deletion_requested_at IS NULL
 AND p.id=NEW.created_by_participant_id AND p.role='host' AND p.revoked_at IS NULL
 AND c.state='ready' AND c.meeting_id=NEW.provider_meeting_id AND s.photo_asset_id=NEW.source_photo_asset_id
 AND s.consent_epoch=NEW.consent_epoch
 AND 2=(SELECT count(*) FROM legacy_participants a WHERE a.session_id=s.id AND a.revoked_at IS NULL
  AND a.joined_at IS NOT NULL AND a.consent='accepted' AND a.consent_version='legacy-recording-v1'
  AND (a.role='host' OR a.access_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')))
)
BEGIN SELECT RAISE(ABORT,'remote recording requires both current participant agreements'); END;
CREATE TABLE legacy_remote_sources (
 id TEXT PRIMARY KEY,
 recording_id TEXT NOT NULL REFERENCES legacy_remote_recordings(id) ON DELETE CASCADE,
 participant_id TEXT REFERENCES legacy_participants(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('composite_video','participant_audio')),
 provider_recording_id TEXT NOT NULL,
 provider_filename TEXT NOT NULL,
 content_type TEXT NOT NULL CHECK(content_type IN ('video/mp4','video/webm','audio/webm')),
 durability_status TEXT NOT NULL DEFAULT 'pending' CHECK(durability_status IN ('pending','durable','quarantined')),
 r2_key TEXT UNIQUE,
 sha256 TEXT,
 byte_size INTEGER,
 r2_etag TEXT,
 durable_at TEXT,
 created_at TEXT NOT NULL,
 CHECK((kind='participant_audio' AND participant_id IS NOT NULL) OR (kind='composite_video' AND participant_id IS NULL)),
 CHECK(durability_status!='durable' OR (r2_key IS NOT NULL AND length(sha256)=64 AND sha256 NOT GLOB '*[^a-f0-9]*' AND byte_size>0 AND r2_etag IS NOT NULL AND durable_at IS NOT NULL)),
 UNIQUE(recording_id,provider_recording_id,provider_filename)
);
CREATE TRIGGER legacy_remote_source_provenance_immutable
BEFORE UPDATE OF recording_id,participant_id,kind,provider_recording_id,provider_filename,content_type,created_at ON legacy_remote_sources
BEGIN SELECT RAISE(ABORT,'source provenance is immutable'); END;
CREATE TRIGGER legacy_remote_source_durable_insert BEFORE INSERT ON legacy_remote_sources
WHEN NEW.durability_status!='pending'
BEGIN SELECT RAISE(ABORT,'source must pass pending storage verification'); END;
CREATE TRIGGER legacy_remote_source_receipt_immutable BEFORE UPDATE ON legacy_remote_sources
WHEN OLD.durability_status='durable'
BEGIN SELECT RAISE(ABORT,'durable source bytes and receipt are immutable'); END;
CREATE TRIGGER legacy_remote_source_scope BEFORE INSERT ON legacy_remote_sources
WHEN NOT EXISTS (
 SELECT 1 FROM legacy_remote_recordings r WHERE r.id=NEW.recording_id
 AND ((NEW.kind='composite_video' AND r.provider_composite_id=NEW.provider_recording_id)
 OR (NEW.kind='participant_audio' AND r.provider_track_id=NEW.provider_recording_id
 AND EXISTS(SELECT 1 FROM legacy_participants p WHERE p.id=NEW.participant_id AND p.session_id=r.session_id)))
)
BEGIN SELECT RAISE(ABORT,'source must belong to its recording and participant'); END;
CREATE TRIGGER legacy_remote_source_durable_consent BEFORE UPDATE OF durability_status ON legacy_remote_sources
WHEN NEW.durability_status='durable' AND NOT EXISTS (
 SELECT 1 FROM legacy_remote_recordings r JOIN legacy_sessions s ON s.id=r.session_id
 WHERE r.id=NEW.recording_id AND r.phase='processing' AND r.capture_stopped=1 AND s.status!='closed'
 AND s.deletion_requested_at IS NULL AND s.consent_epoch=r.consent_epoch
 AND 2=(SELECT count(*) FROM legacy_participants a WHERE a.session_id=s.id AND a.revoked_at IS NULL AND a.joined_at IS NOT NULL
  AND a.consent='accepted' AND a.consent_version='legacy-recording-v1'
  AND (a.role='host' OR a.access_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now')))
)
BEGIN SELECT RAISE(ABORT,'source consent changed before durable confirmation'); END;
CREATE TRIGGER legacy_remote_recording_preserved BEFORE UPDATE OF phase ON legacy_remote_recordings
WHEN NEW.phase='preserved' AND (
 NEW.capture_stopped!=1 OR NEW.preserved_at IS NULL
 OR EXISTS(SELECT 1 FROM legacy_remote_sources x WHERE x.recording_id=NEW.id AND x.durability_status!='durable')
 OR NOT EXISTS(SELECT 1 FROM legacy_remote_sources x WHERE x.recording_id=NEW.id AND x.kind='composite_video' AND x.durability_status='durable')
 OR 2!=(SELECT count(DISTINCT x.participant_id) FROM legacy_remote_sources x WHERE x.recording_id=NEW.id AND x.kind='participant_audio' AND x.durability_status='durable')
 OR NOT EXISTS(SELECT 1 FROM legacy_sessions s WHERE s.id=NEW.session_id AND s.status!='closed' AND s.deletion_requested_at IS NULL AND s.consent_epoch=NEW.consent_epoch
 AND 2=(SELECT count(*) FROM legacy_participants a WHERE a.session_id=s.id AND a.revoked_at IS NULL
 AND a.joined_at IS NOT NULL AND a.consent='accepted' AND a.consent_version='legacy-recording-v1'
 AND (a.role='host' OR a.access_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))))
)
BEGIN SELECT RAISE(ABORT,'all expected originals must be durably confirmed'); END;
CREATE TABLE legacy_remote_source_claims (
 id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL REFERENCES legacy_remote_sources(id) ON DELETE CASCADE,
 participant_id TEXT NOT NULL REFERENCES legacy_participants(id) ON DELETE CASCADE,
 note TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TRIGGER legacy_remote_source_claim_immutable BEFORE UPDATE ON legacy_remote_source_claims
BEGIN SELECT RAISE(ABORT,'speaker claims are additive'); END;
CREATE TRIGGER legacy_remote_source_claim_scope BEFORE INSERT ON legacy_remote_source_claims
WHEN NOT EXISTS (
 SELECT 1 FROM legacy_remote_sources x JOIN legacy_remote_recordings r ON r.id=x.recording_id
 JOIN legacy_participants p ON p.id=x.participant_id
 WHERE x.id=NEW.source_id AND x.kind='participant_audio' AND x.durability_status='durable'
 AND r.phase IN ('preserved','partial_preserved') AND p.id=NEW.participant_id AND p.revoked_at IS NULL
)
BEGIN SELECT RAISE(ABORT,'only the recorded participant can identify their own voice'); END;

CREATE TABLE legacy_remote_recording_usage (
 recording_id TEXT PRIMARY KEY,
 owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 daily_limit INTEGER NOT NULL CHECK(daily_limit>0 AND daily_limit<=1000),
 created_at TEXT NOT NULL
);
CREATE INDEX legacy_remote_recording_usage_owner ON legacy_remote_recording_usage(owner_user_id,created_at);

CREATE TRIGGER legacy_remote_recording_daily_limit BEFORE INSERT ON legacy_remote_recording_usage
WHEN (SELECT count(*) FROM legacy_remote_recording_usage u WHERE u.owner_user_id=NEW.owner_user_id AND u.created_at>=substr(NEW.created_at,1,10)||'T00:00:00.000Z')>=NEW.daily_limit
BEGIN SELECT RAISE(ABORT,'remote recording daily limit'); END;
CREATE TRIGGER legacy_remote_recording_partial_preserved BEFORE UPDATE OF phase ON legacy_remote_recordings
WHEN NEW.phase='partial_preserved' AND (
 NEW.capture_stopped!=1 OR NEW.preserved_at IS NULL
 OR NOT EXISTS(SELECT 1 FROM legacy_remote_sources x WHERE x.recording_id=NEW.id AND x.durability_status='durable')
 OR EXISTS(SELECT 1 FROM legacy_remote_sources x WHERE x.recording_id=NEW.id AND x.durability_status!='durable')
 OR NOT EXISTS(SELECT 1 FROM legacy_sessions s WHERE s.id=NEW.session_id AND s.status!='closed' AND s.deletion_requested_at IS NULL AND s.consent_epoch=NEW.consent_epoch
 AND 2=(SELECT count(*) FROM legacy_participants a WHERE a.session_id=s.id AND a.revoked_at IS NULL
 AND a.joined_at IS NOT NULL AND a.consent='accepted' AND a.consent_version='legacy-recording-v1'
 AND (a.role='host' OR a.access_expires_at>strftime('%Y-%m-%dT%H:%M:%fZ','now'))))
)
BEGIN SELECT RAISE(ABORT,'partial sources must be durably confirmed'); END;
