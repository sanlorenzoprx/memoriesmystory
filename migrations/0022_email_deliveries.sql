-- Outbound email record (lane L2). One row per send attempt that reached the
-- adapter. No address, subject or body is stored: the recipient is found again
-- from the record the email is about (for an invitation, the invitation row).
-- At most one email per purpose and subject is ever recorded as sent, so a
-- retried or replayed request never emails a person twice.
CREATE TABLE email_deliveries (
 id TEXT PRIMARY KEY,
 purpose TEXT NOT NULL CHECK(purpose IN ('family_invitation')),
 subject_id TEXT NOT NULL,
 requested_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 status TEXT NOT NULL CHECK(status IN ('sent','not_sent')),
 code TEXT CHECK(code IS NULL OR length(code) BETWEEN 1 AND 64),
 provider_message_id TEXT CHECK(provider_message_id IS NULL OR length(provider_message_id) <= 200),
 created_at TEXT NOT NULL,
 CHECK((status='sent')=(code IS NULL))
);
CREATE UNIQUE INDEX email_deliveries_sent_once ON email_deliveries(purpose,subject_id) WHERE status='sent';
CREATE INDEX email_deliveries_subject ON email_deliveries(subject_id,created_at);
CREATE TRIGGER email_deliveries_immutable BEFORE UPDATE ON email_deliveries
BEGIN SELECT RAISE(ABORT,'email delivery records are append-only'); END;
