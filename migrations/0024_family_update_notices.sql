-- "Something new is waiting" notices to invited family (lane L2.4). One row
-- per real send attempt; nothing is recorded while sending is off. At most one
-- notice per person per day is ever recorded as sent. No address or body is
-- stored.
CREATE TABLE family_update_notices (
 id TEXT PRIMARY KEY,
 member_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 sent_on TEXT NOT NULL CHECK(length(sent_on)=10),
 status TEXT NOT NULL CHECK(status IN ('sent','not_sent')),
 code TEXT CHECK(code IS NULL OR length(code) BETWEEN 1 AND 64),
 created_at TEXT NOT NULL,
 CHECK((status='sent')=(code IS NULL))
);
CREATE UNIQUE INDEX family_update_notices_daily ON family_update_notices(member_user_id,sent_on) WHERE status='sent';
CREATE INDEX family_update_notices_member ON family_update_notices(member_user_id,created_at);
CREATE TRIGGER family_update_notices_immutable BEFORE UPDATE ON family_update_notices
BEGIN SELECT RAISE(ABORT,'family update notices are append-only'); END;
