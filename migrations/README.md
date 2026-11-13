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
