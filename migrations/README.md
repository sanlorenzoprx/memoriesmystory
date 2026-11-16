# D1 Migrations

Use ordered, reversible-where-possible D1 migrations. Schema decisions must preserve original assets, attribution, truth states, revision history, and exportability.

`0001_phase_1_foundation.sql` establishes the Phase 1 ownership, draft, story, media, transcript, generated-artifact, fact, entitlement, sharing, agreement, idempotency-receipt, and event contracts. Original asset identity and transcript revisions are protected by database triggers in addition to application-domain rules.

Run the disposable local schema verification with:

```bash
npm run test:schema
```

The zero D1 ID in `wrangler.jsonc` is intentionally non-deployable. An authorized staging configuration must replace it with the provisioned staging database ID.

## 0008 — storyteller review and caption pinning

Apply this additive migration before the matching review/finish Worker and client.
It adds owner review snapshots with atomic version guards and append-only history,
invalidates stale reviews after context writes, and pins existing/shared captions.
A cutover trigger also pins caption shares created by the preceding Worker during deployment.
No source photo/audio or original transcript text is rewritten.

After private transcript revisions exist, keep the new caption-pinning reader on
rollback; an older reader follows the current transcript and can expand existing
shares. Retain the additive schema and pause new edits using
`STORY_REVIEW_WRITES_PAUSED=true`, then roll forward. Never erase source/revision
history to revert a UI change. See the November 13 storyteller-review decision.

## 0018 — family voice recollections

Apply this additive migration before the matching Worker and client. It adds the
immutable `family_contribution_voice_sources` table, authorship/immutability and
source-kind guards, and the read-only `family_contribution_sources` view that the
contribution routes read. Tables from 0017 are not altered. The Worker reads the
view, so do not deploy the matching Worker before this migration is applied.

## 0019 — supplementary family photographs

Apply after 0018 and before the matching Worker and client. It adds the immutable
`family_contribution_photo_sources` table and its guards, and drops and recreates
the read-only `family_contribution_sources` view to include photographs. No stored
row is changed.

## 0020 — speaker's written words

Apply after 0019 and before the matching Worker and client. It adds the append-only
`family_contribution_voice_transcripts` table, the owner's
`family_contribution_transcript_pins`, and their guards. A trigger on
`family_contributions` removes a pin when the voice is excluded or withdrawn.
No stored row is changed.

## 0021 — album permission for invited relatives

Apply after 0020 and before the matching Worker and client. It adds
`family_album_permissions`, `family_album_permission_events` and
`family_album_authors`, and replaces the `family_chapter_member_scope` trigger so
the recorded maker of an album may place the owner's complete memories in it.
No stored row is changed.

## 0025 — scheduled integrity (fixity) checks

Apply after 0021 and before the matching Worker. It adds the append-only
`fixity_checks` table and a trigger that refuses updates. Deleting a memory
removes its rows, so no hash of deleted family media is kept. No stored row is
changed. Migrations 0022–0024 are reserved for lane L2 and may land later; 0025
does not depend on them.

## 0022 — email delivery record

Apply before the matching Worker. It adds the append-only `email_deliveries`
table (purpose, subject id, status and stable code; no address, subject or
body) with a partial unique index so a purpose and subject are recorded as sent
at most once. No stored row is changed. 0023–0024 stay reserved for lane L2.

## 0023 — email preferences

Apply after 0022 and before the matching Worker. It adds `email_preferences`
(every optional kind defaults off) and the append-only
`email_preference_events` history, which records changes made in settings and
through signed unsubscribe links. No stored row is changed.

## 0024 — family update notices

Apply after 0023 and before the matching Worker. It adds the append-only
`family_update_notices` table (member, day, status and stable code; no address
or body), with a partial unique index so a person is recorded as notified at
most once a day. No stored row is changed. This completes lane L2's reserved
range 0022–0024.

## 0038 — owner reminders

Allocated by the coordinator to lane L2 (its range 0022–0024 was used). Apply
before the matching Worker. It adds the append-only `owner_reminders` table
(person, month, status and stable code; no address or body), with a partial
unique index so a person is recorded as reminded at most once per calendar
month. It does not depend on any of 0026–0037. No stored row is changed.

## 0028 — one-time sharing agreement

Apply before the matching Worker. It adds the append-only `share_agreements`
table (person, scope `family_friends` or `public`, wording version, time).
After this deploys, a share link cannot be created until the owner has made
the friends-and-family choice once. Existing links keep working. No stored row
is changed.
