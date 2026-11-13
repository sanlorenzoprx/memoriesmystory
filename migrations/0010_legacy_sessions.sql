CREATE TABLE legacy_sessions (
  id TEXT PRIMARY KEY,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  photo_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  mode TEXT NOT NULL CHECK(mode IN ('in_person','remote')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','live','paused','ready','closed')),
  consent_epoch INTEGER NOT NULL DEFAULT 1 CHECK(consent_epoch>0),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX legacy_sessions_owner_idx ON legacy_sessions(owner_user_id,created_at DESC);
CREATE TABLE legacy_participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES legacy_sessions(id) ON DELETE CASCADE,
  account_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK(role IN ('host','guest')),
  display_name TEXT,
  consent TEXT NOT NULL DEFAULT 'pending' CHECK(consent IN ('pending','accepted','declined')),
  consent_version TEXT,
  invite_hash TEXT UNIQUE,
  invite_expires_at TEXT,
  joined_at TEXT,
  join_request_hash TEXT,
  access_hash TEXT UNIQUE,
  access_expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX legacy_one_active_role ON legacy_participants(session_id,role) WHERE revoked_at IS NULL;
CREATE TABLE legacy_consent_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES legacy_sessions(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES legacy_participants(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK(decision IN ('accepted','declined')),
  consent_version TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('audio','audio_video')),
  created_at TEXT NOT NULL
);
CREATE TRIGGER legacy_consent_history_immutable BEFORE UPDATE ON legacy_consent_events
BEGIN SELECT RAISE(ABORT,'consent history is immutable'); END;
CREATE TRIGGER legacy_session_source_immutable BEFORE UPDATE OF memory_story_id,photo_asset_id,owner_user_id,mode,created_at ON legacy_sessions
BEGIN SELECT RAISE(ABORT,'session source and ownership are immutable'); END;
CREATE TRIGGER legacy_session_source_scope BEFORE INSERT ON legacy_sessions
WHEN NOT EXISTS (
  SELECT 1 FROM memory_stories s JOIN media_assets p ON p.id=NEW.photo_asset_id
  WHERE s.id=NEW.memory_story_id AND s.owner_user_id=NEW.owner_user_id
    AND s.status='complete' AND p.durability_status='durable'
    AND (p.id=s.primary_photo_asset_id OR (p.role='enhanced_photo' AND p.source_asset_id=s.primary_photo_asset_id))
)
BEGIN SELECT RAISE(ABORT,'session requires an owned preserved source photograph'); END;

CREATE TRIGGER legacy_consent_scope BEFORE INSERT ON legacy_consent_events
WHEN NOT EXISTS (
  SELECT 1 FROM legacy_participants p JOIN legacy_sessions s ON s.id=p.session_id
  WHERE p.id=NEW.participant_id AND p.session_id=NEW.session_id
    AND p.revoked_at IS NULL AND p.joined_at IS NOT NULL AND s.status!='closed'
    AND NEW.scope=CASE WHEN s.mode='remote' THEN 'audio_video' ELSE 'audio' END
)
BEGIN SELECT RAISE(ABORT,'consent requires the active joined participant and session scope'); END;
