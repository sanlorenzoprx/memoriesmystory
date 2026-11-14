# D03 — Consent-controlled recording and separate private originals

Implementation in progress on `feat/remote-source-archive`, based on current main after PR #35. The owner's requested next slice preserves the photograph-first conversation, independent participant recording choices, immutable originals, truthful save confirmation and private access. No production deployment or remote migration is performed by validation.

## Implemented boundary

Migration 0013 adds immutable recording/consent snapshots, separate composite and participant microphone sources, durable receipts, additive own-voice claims, and persistent daily usage guards. D1 triggers reject premature complete/partial archive confirmation, changed consent, substituted identities and altered durable receipts. Participant mapping uses exact enrolled provider IDs, never a voice or name guess.

The session Durable Object coordinates both recorders, persists uncertain allocations, stop requests, bounded duration, leases, alarms and an independent capture watchdog. Browser departure does not own archival processing. Source ingestion streams into private R2 with bounded buffers and per-attempt keys, then independently reads and hashes R2 bytes before committing an authorized receipt. Interrupted/unconfirmed objects are not playable archive sources. Memory deletion stops capture, waits for coordination, then deletes registered sources and unreferenced session-scoped attempts before removing records.

The UI distinguishes preparing, recording, stopping, verifying, saved originals, partial originals and review-required outcomes. Either participant may stop; withdrawal disables local media before its server request, and publication remains blocked while capture may continue without that participant's consent. Connection status no longer makes a hardcoded unrecorded claim. English and Spanish copy covers controls, status and recovery. Own-voice identification requires listening confirmation and a separate note.

## Evidence and limits

Provider output proof: real Cloudflare generated-source run 43601378648, documented in the separate provider receipt. Local archive evidence uses native workerd Durable Objects, D1 and R2 with simulated provider HTTP responses: three-source preservation with independent actual-byte hash checks, repeat alarms without duplicate allocation, and consent withdrawal stopping both recorders with no published sources. Storage tests exercise a multipart-sized source, retry immutability, revoked consent, overflow, wrong hash and corrupted read-back. Route tests cover access/CSRF, host start, guest stop, persistent intent on coordinator failure, idempotence, non-disclosure, premature archive rejection and own-voice claim authority.

Native-runtime testing found that workerd rejects `redirect: error`; provider and download requests now use `manual` and reject non-success responses, without forwarding credentials to file downloads or following redirects.

Browser fixtures verify UI behavior only; they do not prove live media or permanent cloud storage. No claim of physical phone, distant participants, human consent acceptance, permanent deployed R2, complete V2/MVP v0.5, approved pricing or operative stewardship policy is made. Feature flag remains false by default. Required migration/deployment/real integrated staging verification must precede activation.

Verification receipts will be appended after the complete candidate checks finish.

Anti-drift: original photo/voice remain immutable; no generated testimony; no machine speaker identity claim; private default; current participant-scoped access only; no guest registration; no share incentive; derived scans and reviewed storytelling stay separate; no camera/human acceptance inferred from synthetic tests.

## Local candidate verification

Full core verification passed: typecheck, lint, 186 unit/integration tests, schema integrity/foreign keys/50 required objects, production build and Cloudflare dry run with the Durable Object binding/migration. All 47 phone-Chromium browser tests passed, including both languages and prior solo/in-person recovery. Additional partial-source runtime coverage and a bounded 12-attempt preservation retry guard were added afterward and checked separately before the PR; CI must verify the final committed candidate. The existing large client/lazy SDK chunk warning remains.

An earlier local browser run was invalidated by a concurrent rebuild; it was stopped and the complete 47-test suite rerun without rebuilding concurrently. Local Wrangler configuration/logs and downloaded browser binaries were redirected to writable temporary directories; no runtime credentials or deployment were required. Source ingestion stops automatic retries after bounded failures and remains review-required/retryable from existing provider recordings; it never silently starts replacement capture.

## Failure-path review and clean-install CI

Initial committed candidate `0d63f7c` passed clean-install CI run 43607046639 (187 tests plus the full 47-test phone suite and core gates). Final review then strengthened the deadline watchdog: admission closure, recorder cleanup and participant removal are independent attempts, so a failed recorder endpoint cannot prevent stopping participants' publication. A native-runtime test simulates simultaneous D1/recorder-list outages, verifies both participant removals and repeated recovery, and confirms no false stopped/saved D1 receipt. All five native coordinator tests and type/lint checks passed locally; the amended candidate requires its own CI run.

Ambiguous allocation cleanup also uses the independent provider cleanup path. Its stop intent is persistent, and subsequent confirmation includes every recorder in the private meeting, including a recorder whose identity could not safely be adopted. It cannot report capture stopped by checking an empty set of known IDs. If an ordinary requested stop remains unconfirmed for 15 seconds, admission closes and participants are removed while stop confirmation continues. All seven native coordinator tests now pass, covering normal/full and partial storage, withdrawal, reconciled and ambiguous allocation, D1/provider outages, and delayed stops without false stopped/saved receipts. Final typecheck and lint passed before the amended push.
