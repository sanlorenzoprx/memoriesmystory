CREATE TABLE family_access_grants (
 id TEXT PRIMARY KEY,
 archive_id TEXT NOT NULL REFERENCES family_archives(id) ON DELETE CASCADE,
 owner_user_id TEXT NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('viewer','contributor')),
 scope_kind TEXT NOT NULL CHECK(scope_kind IN ('archive','chapter','memory')),
 scope_id TEXT NOT NULL,
 target_email TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','revoked')),
 accepted_by_user_id TEXT REFERENCES users(id),
 accepted_at TEXT,
 expires_at TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 CHECK(state<>'accepted' OR (accepted_by_user_id IS NOT NULL AND accepted_at IS NOT NULL))
);
CREATE INDEX family_access_owner ON family_access_grants(owner_user_id,archive_id,id);
CREATE INDEX family_access_member ON family_access_grants(accepted_by_user_id,state,scope_kind,scope_id);
CREATE TABLE family_access_events (
 grant_id TEXT NOT NULL REFERENCES family_access_grants(id) ON DELETE CASCADE,
 version INTEGER NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('invited','accepted','revoked')),
 actor_user_id TEXT NOT NULL REFERENCES users(id),
 recorded_at TEXT NOT NULL,
 PRIMARY KEY(grant_id,version)
);
CREATE TRIGGER family_access_owner_insert BEFORE INSERT ON family_access_grants
WHEN NOT EXISTS(SELECT 1 FROM family_archives WHERE id=NEW.archive_id AND owner_user_id=NEW.owner_user_id)
BEGIN SELECT RAISE(ABORT,'family_access_owner'); END;
CREATE TRIGGER family_access_identity_immutable BEFORE UPDATE ON family_access_grants
WHEN OLD.id<>NEW.id OR OLD.archive_id<>NEW.archive_id OR OLD.owner_user_id<>NEW.owner_user_id OR OLD.role<>NEW.role OR OLD.scope_kind<>NEW.scope_kind OR OLD.scope_id<>NEW.scope_id OR OLD.target_email<>NEW.target_email OR OLD.token_hash<>NEW.token_hash OR OLD.created_at<>NEW.created_at OR (OLD.accepted_by_user_id IS NOT NULL AND (NEW.accepted_by_user_id IS NULL OR NEW.accepted_by_user_id<>OLD.accepted_by_user_id))
BEGIN SELECT RAISE(ABORT,'family_access_identity'); END;
CREATE TRIGGER family_access_revocation_final BEFORE UPDATE ON family_access_grants
WHEN OLD.state='revoked' AND NEW.state<>'revoked'
BEGIN SELECT RAISE(ABORT,'family_access_revoked'); END;
CREATE TRIGGER family_access_events_immutable BEFORE UPDATE ON family_access_events
BEGIN SELECT RAISE(ABORT,'family_access_events_immutable'); END;
