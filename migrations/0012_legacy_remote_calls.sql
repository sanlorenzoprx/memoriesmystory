-- Provider allocation is separate from immutable source assets and recording consent.
CREATE TABLE legacy_remote_calls (
  session_id TEXT PRIMARY KEY REFERENCES legacy_sessions(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK(state IN ('provisioning','ready','failed','closed')),
  meeting_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE legacy_remote_participants (
  participant_id TEXT PRIMARY KEY REFERENCES legacy_participants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES legacy_remote_calls(session_id) ON DELETE CASCADE,
  provider_participant_id TEXT NOT NULL
);
-- Deletion closes the parent before it discovers provider allocations. A late
-- join cannot create a new allocation behind that cleanup boundary.
CREATE TRIGGER legacy_remote_open_session
BEFORE INSERT ON legacy_remote_calls
WHEN NOT EXISTS (
  SELECT 1 FROM legacy_sessions s WHERE s.id=NEW.session_id
    AND s.mode='remote' AND s.status!='closed' AND s.deletion_requested_at IS NULL
)
BEGIN
  SELECT RAISE(ABORT, 'legacy_session_closed');
END;
