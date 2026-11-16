-- Opt-in owner reminders (lane L2.5; number allocated by the coordinator).
-- One row per real send attempt; nothing is recorded while sending is off.
-- At most one reminder per person per calendar month is ever recorded as
-- sent (decision D6 default: monthly at most). No address or body is stored.
CREATE TABLE owner_reminders (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 sent_month TEXT NOT NULL CHECK(length(sent_month)=7),
 status TEXT NOT NULL CHECK(status IN ('sent','not_sent')),
 code TEXT CHECK(code IS NULL OR length(code) BETWEEN 1 AND 64),
 created_at TEXT NOT NULL,
 CHECK((status='sent')=(code IS NULL))
);
CREATE UNIQUE INDEX owner_reminders_monthly ON owner_reminders(user_id,sent_month) WHERE status='sent';
CREATE INDEX owner_reminders_user ON owner_reminders(user_id,created_at);
CREATE TRIGGER owner_reminders_immutable BEFORE UPDATE ON owner_reminders
BEGIN SELECT RAISE(ABORT,'owner reminders are append-only'); END;
