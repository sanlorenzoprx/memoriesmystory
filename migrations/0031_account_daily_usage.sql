-- Per-account daily ceilings on operations that spend model or call budget
-- (lanes L5.4 and L7). One counter per person, day and operation, raised
-- atomically before the operation runs. Uploads and saves are never counted,
-- so preserving a memory is never refused by a ceiling.
CREATE TABLE account_daily_usage (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL CHECK(length(day)=10),
 operation TEXT NOT NULL CHECK(operation IN ('muse','muse_speech','muse_conversation','voice_reply','transcription','scan','call')),
 count INTEGER NOT NULL CHECK(count>=1),
 PRIMARY KEY(user_id,day,operation)
);
