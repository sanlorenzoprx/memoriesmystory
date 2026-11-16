-- Email preferences and their history (lane L2.3). A person with no row has
-- chosen nothing and receives nothing optional: every kind is opt-in. Each
-- change is recorded, including changes made from a signed unsubscribe link.
CREATE TABLE email_preferences (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 family_updates INTEGER NOT NULL DEFAULT 0 CHECK(family_updates IN (0,1)),
 owner_reminders INTEGER NOT NULL DEFAULT 0 CHECK(owner_reminders IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at TEXT NOT NULL
);
CREATE TABLE email_preference_events (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('family_updates','owner_reminders')),
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 source TEXT NOT NULL CHECK(source IN ('settings','unsubscribe_link')),
 created_at TEXT NOT NULL
);
CREATE INDEX email_preference_events_user ON email_preference_events(user_id,created_at);
CREATE TRIGGER email_preference_events_immutable BEFORE UPDATE ON email_preference_events
BEGIN SELECT RAISE(ABORT,'email preference history is append-only'); END;
