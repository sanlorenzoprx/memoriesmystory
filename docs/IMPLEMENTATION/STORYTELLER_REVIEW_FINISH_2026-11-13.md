# Storyteller review and voluntary finish

**Date:** 2026-11-13  
**Protected-main base:** `0d4452eb9ffb78ad22758d00ab32df0fdead0367`  
**Dependency:** draft PR #21, `be1e85e98c7e16bb8977879b502906c3b0ff9f30`; its GitHub CI passed and it remains unmerged.  
**Branch:** `feat/storyteller-review-finish` (started from current main, then advanced to its #21 dependency).  
**Head:** the commit containing this receipt, identified by the dependent PR.  
**Status:** implementation and local verification; independent review and GitHub Verify pending. Not merged, not deployed, not release-accepted.

## Customer outcome

A storyteller can review and revise transcript/context before or after preserving a Living Memory, read the original machine transcript and earlier accepted versions, and choose when to finish without answering every Muse question or waiting for transcription. An explicit confirmation of durable photograph and original voice replaces mandatory context anchors as the completion gate. Unsent text/voice requires a deliberate discard choice. The owner remains the author; the platform does not judge testimony.

## Implementation and privacy

- Migration 0008 adds append-only, owner-attributed review snapshots with source IDs, expected story version, request hash and effective context. The guard runs first in the same atomic D1 batch as transcript/context changes. Stale/concurrent saves fail without a partial correction; identical retries converge to one review. Context writes through older Muse endpoints also invalidate stale open reviews.
- Corrections append to `transcript_revisions` with parent/source/owner/locale provenance. Original photo/audio and machine/earlier transcript/context rows remain unchanged. The completion snapshot now maps transcript/context fields to the client contract and returns a version.
- Owner-only `GET/PUT /resources/drafts/:id/review` provides paginated history and editing, origin/CSRF checks, bounded request-body reads (including chunked requests), validation and safe errors. A failed save keeps browser words and its retry identity. Explicitly reopening the latest details requires consent to discard unsaved edits.
- Review UI supports stated/approximate/unknown/omitted details, original transcript/history and focus return after save/cancel. Preservation is disabled while edits are unsaved and until the source checkbox is selected.
- Source-confirmed completion records an attributable source snapshot, remains idempotent, and activates/consumes completion capacity once. No transcript, Muse turn count or four-anchor checklist is required. Delayed transcription retains completed status instead of reopening the archive item.
- Share preview identifies the selected transcript revision; share creation pins it. Public captions read that pinned revision, including pre-migration backfill and artifacts made by the preceding Worker during deployment. Private corrections do not expand old links. Revocation remains unchanged.
- Deletion now removes transcript descendants before parents in its existing D1 transaction. This preserves the restrictive lineage constraint while allowing complete removal of corrected histories and their review rows.

## Verification

**Final canonical verification: PASS.** `XDG_CONFIG_HOME=/workspace/work/config PLAYWRIGHT_BROWSERS_PATH=/workspace/work/browsers npm run verify` passed typecheck, lint, **97 unit/integration tests in 26 files**, schema checks for **36 required objects**, build, Cloudflare deployment dry run and **18 phone-Chromium browser tests**. Final browser duration: 1.0 minute. No check was skipped. `git diff --check` also passed. No paid provider call, live migration, deployment or real-family fixture was used.

Meaningful cases include correction attribution/lineage and unchanged original rows; same-key retries; stale/concurrent edits; context changes from another Muse writer; owner/stranger and origin boundaries; oversized chunked requests; paginated immutable history; post-completion editing without another activation/capacity charge; frozen captions; pre-migration/transitional shares; deletion of a multi-generation transcript chain; pausing edits while retaining reads; completion with no transcript/context/Muse turns; delayed transcription after completion; browser early-finish/outage/save-retry/reload/history/unsent-reply and focus behavior.

### Failures found and corrected

- New corrected-history deletion initially returned 500: the original transcript's self-reference used `ON DELETE RESTRICT`, so cascade order could encounter a parent before its child. The regression now includes three generations and passes after leaf-first transactional deletion.
- A new browser locator using exact label text did not match a controlled textarea, despite its accessible textbox name being correct. It now uses that exact accessible textbox role/name; assertions still require the edited text, retry identity, persisted reload and retained original history.
- One unchanged offline-background-upload browser case timed out during the first broad run. Its original assertions were retained; the focused replay and subsequent full run passed. This is observed timing sensitivity, not a claimed offline-code fix.
- A focus-return assertion was added while an earlier built-bundle browser run was in progress; that older bundle failed the new assertion. The final source-frozen rebuild includes the focus behavior and passed it.
- The new delayed-transcription test exposed an old test harness using only migrations 0001–0003 and silently ignoring a modern entitlement fixture. It now uses the current migration sequence, rather than weakening its capacity assertion.

## Migration, recovery and rollback

Apply additive migration 0008 before its matching Worker/client, using synthetic staging first. Legacy artifacts are pinned at migration time; the cutover trigger pins shares made by the preceding Worker. Confirm source/revision/privacy cases, normal solo capture and revoke/delete after migration. No remote application has occurred.

After a private correction exists, an old Worker that reads the current transcript for public shares is unsafe to restore. Retain the caption-pinning reader and additive schema; set `STORY_REVIEW_WRITES_PAUSED=true` to pause new edits while authorized sources/history remain readable. Roll forward after repair. Never delete accepted revisions or modify originals as rollback. A paused required capability is not first-release acceptance.

## Anti-drift review

- **Idea/mechanism/value:** preserve the person's own account with voluntary help and continued author control.
- **Source authenticity:** YES. Unchanged original assets, append-only transcript/context history and source/parent/locale references; no AI-authored fact is adopted automatically.
- **Privacy/ownership:** YES. Owner-only edits/history; public artifacts pin the explicitly selected transcript; no private revision is added to an old link.
- **Recovery:** YES for changed paths. Atomic stale-version guards, durable-source confirmation, request limits, preserved unsaved browser words, stable retry identity, explicit discard and pausable writes. Unsaved form text is not claimed to survive browser/device loss.
- **Cross-device:** version conflicts are tested synthetically; real-device acceptance remains pending.
- **Muse:** optional; original recording is primary; no truth verdict, inferred name/date or forced agreement.
- **Architecture:** existing Workers/D1/R2, one additive migration, narrow API/UI modules; no new provider, model or service platform.
- **Growth/economics:** no sharing reward or additional activation on revision. Existing deletion capacity behavior is unchanged; see discrepancy below.
- **Evidence limits:** English new UI only; full EN/ES remains A04. Automated local browser evidence is not physical iPhone/Android, manual screen-reader, live provider or uncoached-human acceptance.

## Remaining work and discovered policy discrepancy

Continue A04 complete bilingual UI, remaining A05/A07 accessibility/media/security/operations work, then the internal solo human/device checkpoint and every required expanded-release group. Exact offers/terms, contributor/retention/stewardship policy and live-provider credentials remain prerequisites for their respective acceptance. No production action is authorized by passing tests.

Existing deletion code/tests decrement `free_stories_completed` to zero after a completed memory is deleted. Previous CURRENT_STATE wording said capacity was not restored; it is corrected to reflect the evidence. This work does not choose a different trial/capacity policy. Resolve that policy explicitly before paid-capacity/release acceptance.
