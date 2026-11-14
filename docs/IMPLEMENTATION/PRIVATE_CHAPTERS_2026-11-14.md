# E01 — Private Chapters and archive organization

Base: current main after PR #39 (`2896e5c`). The owner requested the complete V2 implementation and deferred physical/device testing until the full MVP v0.5 implementation milestone. D03 real-cloud proof 43628170649 passed before this slice began. This advances implementation without closing human/device, legal or release acceptance gates.

## Outcome

A signed-in owner can create private Chapters, choose existing complete Living Memories, arrange their order, choose a cover, edit Chapter descriptions and human-entered memory names, and move a Chapter between their private archives. One Living Memory may belong to multiple Chapters through references. Removing a Chapter or archive removes organization only; underlying memories, original media and completion state remain intact. The existing `/archive/:draftId` and `/memory/:id` paths remain compatible.

The archive screen introduces optional Chapters after an owned completed memory exists. English/Spanish controls update without translating human titles/notes or discarding drafts. Failed saves retain edits and their request key; stale versions are rejected. Leaving unsaved Chapter, name or archive details requires a deliberate discard choice. Saved notices follow confirmed metadata responses, and malformed success acknowledgements/old HTML fallbacks are rejected. Explicit labels and heading focus support keyboard/screen-reader use. Media presence is checked privately before showing photo/voice availability; missing originals do not produce a playback promise.

## Preservation and authorization

Migration 0014 adds owner-private archives, Chapters, many-to-many memory references and separately attributed memory-name metadata. Ownership is immutable, moves preserve owner identity, covers require membership, and source references require an owned complete memory. Chapter/archive deletion cannot cascade into Living Memories or media. The only R2 operation in organization routes is availability reading; no media is copied, rewritten or deleted.

Every route requires the owner account session; remote conversation invitation cookies and external share artifacts do not grant archive rights. Mutations require same-origin/CSRF checks, bounded input and user/operation-scoped idempotence. Conditional D1 updates, receipts and membership changes execute in one batch; stale/replayed requests cannot overwrite a later Chapter version. JSON membership input uses bounded SQL parameters and a fixed small batch instead of a parameter or statement per reference. Reads are paginated and asset metadata is joined before bounded private R2 heads. Prototype organization limits are central technical guards, not approved paid offers.

## Evidence

Local core verification passed: typecheck, lint, all 211 unit/integration tests, schema integrity/foreign keys/63 required objects, production build and Cloudflare dry run. All 49 phone-Chromium tests passed, including the two new English/Spanish Chapter journeys and the prior solo/camera/recording/recovery flows.

Authorization tests deny unrelated families' enumeration, mutation, existing foreign memories and ownership-changing moves. Organization tests prove one source can appear in two Chapters without copying bytes; archive/Chapter removal preserves sources; reference ordering/covers and separate memory names persist; missing objects yield unavailable metadata. A native workerd/D1/R2 test commits 120 ordered references and an idempotent receipt, rejects stale edits, then removes the Chapter while source keys/ETags and all underlying complete memories remain unchanged. Synthetic entitlement capacity is adjusted only in fixtures to seed multiple existing complete memories; product offers and allowances are unchanged.

The browser tests preserve unsaved bilingual notes after a simulated failed save, retain the same retry key, change interface language without rewriting testimony/metadata, verify cover and reference ordering, then remove the Chapter without media writes. The handoff contract now checks the verified D03 cloud receipt and keeps its human acceptance pending while Family Archive implementation is active.

Clean-install CI and real-cloud Chapter route verification remain to be recorded against the committed candidate. No production/full-application staging deployment, family invitation/contribution scope, human acceptance or completed V2/MVP v0.5 is claimed. Apply migration 0014 before matching Worker/client deployment. The existing large bundle warning remains.

Anti-drift: human organization strengthens retrieval without changing original testimony; no generated facts, identity guesses, relationships or historical dates; private by default with owner-scoped retrieval; no new sharing or reward; originals remain immutable; retry/version recovery is explicit; export can follow references without duplicated source bytes. Next within Family Archive is E02 human-entered people/relationship references, after the E01 verification receipt.

## Merged candidate and cloud-verification preparation

PR #40 merged as `5519350bd4316b4ec0e89a9c3a85ccfacf5bd261` after clean-install CI run 43633691702 passed. The reviewed application candidate is `3bbb1096b1291fefa5cc0fee80a69519904801fb`; the operator workflow pins that complete immutable commit rather than the older recording-only candidate.

The follow-up operator check optionally compiles the actual private Chapter handler into the existing isolated archive proof. After real recording preservation it denies archive enumeration/mutation to anonymous and conversation-guest sessions, creates two Chapters referencing the same existing synthetic complete memory, verifies cover membership, successful retry and stale-write rejection, then removes organization. It compares every recording source's receipt, independently read bytes, hash and length before/after, checks the underlying memory remains complete, and repeats the actual private playback/integrity check. Existing cloud restart, private-bucket policy and resource cleanup checks remain in force. The test uses synthetic material and existing owner-authorized temporary resources; it does not deploy the full staging application or change production.

Real-cloud Chapter evidence is pending the explicitly dispatched `storage=isolated-cloud, verify_chapters=true` run. This paragraph describes the candidate check, not a successful provider result.

## Actual isolated-cloud result

PR #41 merged as `2d226f56ecf68d008d4ca3f26744dae774743b40` after CI 43634182315 passed. The manually dispatched real-provider run **43634180628 passed** against the pinned E01 candidate with `verify_chapters=true`. Its sanitized result reports `archiveProbeStage=complete`, `private_chapter_retry_and_removal_preserve_all_recording_originals`, private full/ranged playback and independent R2 hash checks, surviving Worker redeployment, both distinct decoded microphone sources and composite video, `cleanupConfirmed=true`, and `storageCleanupConfirmed=true` with `storageScope=isolated_cloud_worker_d1_private_r2`.

This closes E01's technical cloud gate. Physical/uncoached user acceptance remains owner-deferred. It does not prove long-term retention, all-account Clerk acceptance or a full staged application deployment. E02 human-entered people and relationship references is the next implementation slice.
