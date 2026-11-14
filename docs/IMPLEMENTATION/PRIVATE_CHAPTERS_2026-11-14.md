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
