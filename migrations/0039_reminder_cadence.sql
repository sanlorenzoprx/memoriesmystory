-- Person-chosen reminder cadence (decision 2026-11-16, section 3; number
-- allocated by the coordinator). Weekly is selected when reminders are turned
-- on; every two weeks and monthly are the other choices. The once-a-month
-- index is replaced by once-a-day: the cadence itself is enforced by the
-- reminder pass against each person's choice.
ALTER TABLE email_preferences ADD COLUMN reminder_cadence TEXT NOT NULL DEFAULT 'weekly' CHECK(reminder_cadence IN ('weekly','biweekly','monthly'));
DROP INDEX owner_reminders_monthly;
CREATE UNIQUE INDEX owner_reminders_daily ON owner_reminders(user_id,substr(created_at,1,10)) WHERE status='sent';
