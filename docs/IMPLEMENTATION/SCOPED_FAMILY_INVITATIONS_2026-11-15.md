# E03 — Scoped family invitations and private original playback

Base: main `a0c4500e3223e755e574332e511922f362c057a0`, after PR #42. Implements the approved V2.1 family access slice; conversation guest calls remain account-free and separate from archive membership.

## Outcome

An owner can deliberately invite a verified email account as viewer or contributor, defaulting to one selected Living Memory. Chapter scope covers its current references; archive scope covers memories referenced in that archive's Chapters, never all personal memories. The bilingual owner screen explains scope expansion when new memories are added. Invitations expire after centrally configured 72 hours, have pending/accepted/revoked state, and can be reviewed or revoked. Copyable links provide manual delivery through the owner's usual messaging application. No outbound email delivery is claimed.

Recipients can preview only bounded invitation role/scope/expiry, sign in and return through a whitelisted local family path, then accept with the invited verified account. The server fetches the current matching Clerk principal's profile and verifies the target address; user-table/JWT email claims alone never grant access. Wrong-account attempts do not consume the invitation. Acceptance binds the internal account, not possession of a bearer URL. An accepted member can reopen selected original photographs and original voice through cookie-authenticated private routes. Missing objects do not create playback promises.

## Permission and preservation boundaries

Migration 0016 adds archive-owned scope-bound grants, immutable identity fields, final revocation and attributed invitation/acceptance/revocation events. Invitation tokens are private, hashed with the session secret and never stored in plaintext receipts or list responses. Creation is user/key-scoped and replay-safe; changed retries conflict. A used, revoked, expired or incompatible-token retry cannot claim a fresh invitation is ready. Version checks protect acceptance/revocation races. Provider errors fail closed and are reduced to stable messages.

Every member read verifies accepted account membership, original owner and current memory scope. Media is restricted to the selected memory's durable primary original photo/audio; callers cannot substitute unrelated assets or acquire owner draft routes. Full/ranged source responses are private/no-store; permissions are checked again after storage awaits. Revocation or removing a Chapter reference denies subsequent requests using an earlier media URL. Receiving bytes does not imply that already received media can be remotely recalled.

Current member views deliberately expose selected original photo/voice and scoped titles. They do not implicitly expose private people/history/context, participant session recordings, raw R2 URLs, external publication or export rights. Contributor authorization is the boundary for E04; this slice does not claim that separately attributed contributions are already delivered. No source bytes, completion events, entitlements or sharing rewards are changed. No new provider/platform is introduced.

## Verification

The local core suite passed 226 tests in 52 files, typecheck/lint, 77 required schema objects with integrity/foreign keys, build and Cloudflare dry run. The complete 53-test phone-Chromium suite passed, including English/Spanish invitation recovery, retained retry key and default scope, explicit account mismatch, acceptance, original-media view, revocation and no horizontal overflow. These are emulated phone browsers, not physical device or live Clerk acceptance.

Route tests prove wrong-account non-consumption, replay-safe acceptance/creation, changed retry conflicts, expiry/provider failure, scoped viewer/contributor permission, owner-only enumeration/revocation/CSRF, denial of other original assets, current Chapter/archive membership and stale URL denial. Fresh-profile tests deny unverified addresses and mismatching principal IDs. The native workerd/D1/R2 test exercises actual grant creation/acceptance, source playback and byte-range equivalence, revocation and subsequent media denial while retaining all 120 original memories/object keys/ETags. The native identity verifier is a controlled fixture adapter and is not presented as live Clerk evidence.

Final review found that returning an asynchronous inactive-invitation replay without awaiting it bypassed the route's error boundary. Both replay paths now await inside the boundary, and a revoked creation retry returns a stable 409; its focused route suite passed. The final core rerun passed all 226 tests and required checks after this fix. Clean-install CI remains pending against the committed candidate. Existing large-bundle warning remains. Apply migration 0016 before deploying matching code; no full staging or production deployment was performed.

## Remaining acceptance and next slice

Real hosted Clerk recipient acceptance and integrated application deployment/rollback remain open, alongside owner-deferred physical/human checks. Legal wording, operative stewardship and live billing remain separate gates. This slice does not complete V2.1. Next is E04 independent attributed family voice/text/photo contributions, each author's transcript review, and owner-controlled assembly that preserves different recollections.

Anti-drift: explicit scope/default privacy and fresh identity protect I-19/I-21/I-25; immutable sources protect I-02–I-09; canonical acknowledgements and retry/version handling protect I-10; account-bound scope checks support source-grounded retrieval and eventual export without granting unrelated material; optional bilingual controls and manual delivery support I-15/I-17/I-18; no rewards or forced publication.

## Merged result

PR #43 merged as `9d184044153ab65d504053f81809acb63f2b0ca6` after clean-install CI 43689344069 passed 226 unit/integration and 53 phone-browser tests. Candidate head: `24d9873fbfa5a9e432e10bcd3bc4d5d3514e32d2`. Hosted real Clerk and deferred device/human gates remain open. E04 implementation advances on current main without treating these pending acceptance gates as complete.
