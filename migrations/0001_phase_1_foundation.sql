PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX users_email_unique
  ON users (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE user_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('email', 'google', 'facebook')),
  provider_subject TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (provider, provider_subject)
);

CREATE INDEX user_identities_user_id_idx ON user_identities (user_id);

CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX user_sessions_active_user_idx
  ON user_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE memory_story_drafts (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  anonymous_identity_hash TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN (
    'local_draft', 'photo_local', 'photo_uploading', 'photo_durable',
    'audio_recording', 'audio_local', 'audio_uploading', 'originals_durable',
    'processing', 'review_partial', 'review_ready', 'finalizing', 'complete',
    'needs_connection'
  )),
  ui_locale TEXT NOT NULL,
  spoken_locale TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE INDEX memory_story_drafts_owner_updated_idx
  ON memory_story_drafts (owner_user_id, updated_at DESC);
CREATE INDEX memory_story_drafts_expiry_idx
  ON memory_story_drafts (expires_at);

CREATE TABLE memory_stories (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'complete')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  primary_photo_asset_id TEXT,
  primary_audio_asset_id TEXT,
  current_transcript_revision_id TEXT,
  current_muse_description_id TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CHECK (status <> 'complete' OR completed_at IS NOT NULL)
);

CREATE INDEX memory_stories_owner_created_idx
  ON memory_stories (owner_user_id, created_at DESC);
CREATE INDEX memory_stories_owner_status_idx
  ON memory_stories (owner_user_id, status);

CREATE TABLE media_assets (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES memory_story_drafts(id) ON DELETE RESTRICT,
  memory_story_id TEXT REFERENCES memory_stories(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN (
    'original_photo', 'enhanced_photo', 'original_audio', 'cleaned_audio'
  )),
  source_asset_id TEXT REFERENCES media_assets(id) ON DELETE RESTRICT,
  r2_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size > 0),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  r2_etag TEXT,
  durability_status TEXT NOT NULL CHECK (durability_status IN ('pending', 'durable', 'failed')),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  CHECK (durability_status <> 'durable' OR r2_etag IS NOT NULL),
  CHECK (
    (role IN ('original_photo', 'original_audio') AND source_asset_id IS NULL) OR
    (role IN ('enhanced_photo', 'cleaned_audio') AND source_asset_id IS NOT NULL)
  )
);

CREATE INDEX media_assets_draft_role_idx ON media_assets (draft_id, role);
CREATE INDEX media_assets_story_role_idx ON media_assets (memory_story_id, role);
CREATE INDEX media_assets_source_idx ON media_assets (source_asset_id);
CREATE INDEX media_assets_durability_idx ON media_assets (durability_status, created_at);

CREATE TRIGGER media_assets_immutable_original_identity
BEFORE UPDATE OF id, role, r2_key, byte_size, sha256 ON media_assets
WHEN OLD.role IN ('original_photo', 'original_audio') AND (
  NEW.id <> OLD.id OR
  NEW.role <> OLD.role OR
  NEW.r2_key <> OLD.r2_key OR
  NEW.byte_size <> OLD.byte_size OR
  NEW.sha256 <> OLD.sha256
)
BEGIN
  SELECT RAISE(ABORT, 'immutable original asset identity cannot be changed');
END;

CREATE TRIGGER memory_stories_complete_requires_originals
BEFORE UPDATE OF status, primary_photo_asset_id, primary_audio_asset_id ON memory_stories
WHEN NEW.status = 'complete'
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM media_assets
    WHERE id = NEW.primary_photo_asset_id
      AND memory_story_id = NEW.id
      AND role = 'original_photo'
      AND durability_status = 'durable'
  ) THEN RAISE(ABORT, 'completion requires a durable original photo') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM media_assets
    WHERE id = NEW.primary_audio_asset_id
      AND memory_story_id = NEW.id
      AND role = 'original_audio'
      AND durability_status = 'durable'
  ) THEN RAISE(ABORT, 'completion requires a durable original audio') END;
END;

CREATE TRIGGER memory_stories_complete_insert_forbidden
BEFORE INSERT ON memory_stories
WHEN NEW.status = 'complete'
BEGIN
  SELECT RAISE(ABORT, 'memory story must be finalized from a durable draft state');
END;

CREATE TRIGGER memory_stories_cannot_reopen_complete
BEFORE UPDATE OF status ON memory_stories
WHEN OLD.status = 'complete' AND NEW.status <> 'complete'
BEGIN
  SELECT RAISE(ABORT, 'completed memory stories cannot return to draft');
END;

CREATE TABLE transcript_revisions (
  id TEXT PRIMARY KEY,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  source_audio_asset_id TEXT NOT NULL REFERENCES media_assets(id) ON DELETE RESTRICT,
  parent_revision_id TEXT REFERENCES transcript_revisions(id) ON DELETE RESTRICT,
  revision_kind TEXT NOT NULL CHECK (revision_kind IN (
    'machine_transcript', 'corrected_transcript', 'translated_transcript'
  )),
  text TEXT NOT NULL,
  locale TEXT NOT NULL,
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('machine', 'user', 'translator')),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  model_config_version TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX transcript_revisions_story_created_idx
  ON transcript_revisions (memory_story_id, created_at);

CREATE TRIGGER transcript_revisions_append_only
BEFORE UPDATE ON transcript_revisions
BEGIN
  SELECT RAISE(ABORT, 'transcript revisions are append only');
END;

CREATE TABLE generated_artifacts (
  id TEXT PRIMARY KEY,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('muse_legacy_description', 'muse_prompt')),
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
  source_refs_json TEXT NOT NULL,
  model_config_version TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX generated_artifacts_story_kind_idx
  ON generated_artifacts (memory_story_id, kind, created_at);

CREATE TABLE memory_story_facts (
  id TEXT PRIMARY KEY,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('person', 'place', 'date', 'event', 'relationship', 'theme')),
  value TEXT NOT NULL,
  truth_state TEXT NOT NULL CHECK (truth_state IN (
    'confirmed', 'approximate', 'unknown', 'disputed', 'ai_suggested_unconfirmed'
  )),
  source_type TEXT NOT NULL CHECK (source_type IN ('testimony', 'user', 'machine', 'import')),
  source_ref TEXT,
  confirmed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  superseded_at TEXT
);

CREATE INDEX memory_story_facts_story_current_idx
  ON memory_story_facts (memory_story_id, kind)
  WHERE superseded_at IS NULL;

CREATE TABLE story_entitlements (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan = 'free'),
  free_story_limit INTEGER NOT NULL DEFAULT 5 CHECK (free_story_limit = 5),
  free_stories_unlocked INTEGER NOT NULL DEFAULT 1,
  free_stories_completed INTEGER NOT NULL DEFAULT 0,
  paid_story_capacity INTEGER NOT NULL DEFAULT 0 CHECK (paid_story_capacity >= 0),
  updated_at TEXT NOT NULL,
  CHECK (free_stories_unlocked BETWEEN 1 AND free_story_limit),
  CHECK (free_stories_completed BETWEEN 0 AND free_stories_unlocked)
);

CREATE TABLE memory_story_shares (
  id TEXT PRIMARY KEY,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL DEFAULT 'private_link' CHECK (visibility = 'private_link'),
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX memory_story_shares_owner_story_idx
  ON memory_story_shares (owner_user_id, memory_story_id);

CREATE TABLE share_events (
  id TEXT PRIMARY KEY,
  share_id TEXT NOT NULL REFERENCES memory_story_shares(id) ON DELETE CASCADE,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  action TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  unlock_granted INTEGER NOT NULL DEFAULT 0 CHECK (unlock_granted IN (0, 1)),
  application_version TEXT NOT NULL,
  cancelled_at TEXT,
  idempotency_key TEXT NOT NULL UNIQUE
);

CREATE UNIQUE INDEX share_events_one_unlock_per_story_account_idx
  ON share_events (memory_story_id, account_id)
  WHERE unlock_granted = 1;

CREATE TABLE agreement_acceptances (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  draft_id TEXT NOT NULL REFERENCES memory_story_drafts(id) ON DELETE RESTRICT,
  agreement_kind TEXT NOT NULL,
  agreement_version TEXT NOT NULL,
  context TEXT NOT NULL,
  accepted_at TEXT NOT NULL,
  UNIQUE (draft_id, agreement_kind, agreement_version, context)
);

CREATE TABLE operation_receipts (
  idempotency_key TEXT PRIMARY KEY,
  operation_kind TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('user', 'draft', 'story', 'share', 'asset')),
  scope_id TEXT NOT NULL,
  request_hash TEXT NOT NULL CHECK (length(request_hash) = 64),
  status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
  result_ref TEXT,
  correlation_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (operation_kind, scope_type, scope_id, idempotency_key)
);

CREATE INDEX operation_receipts_scope_idx
  ON operation_receipts (scope_type, scope_id, operation_kind, created_at);

CREATE TABLE memory_story_events (
  id TEXT PRIMARY KEY,
  memory_story_id TEXT NOT NULL REFERENCES memory_stories(id) ON DELETE CASCADE,
  event_kind TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'provider')),
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  correlation_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE INDEX memory_story_events_story_time_idx
  ON memory_story_events (memory_story_id, occurred_at);
