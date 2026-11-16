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
