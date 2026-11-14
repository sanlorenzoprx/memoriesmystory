# D02 — Shared original recording, recovery and private replay

Base: main `bac2415ab7d93e4489bc1e638be4666f722c70fd`, after D01 PR #26 passed CI run 43509129541 and merged. Authority: V2 D02, expanded first-release R2, `../EXECUTION/MVP_V0_5.md`, and `../DECISIONS/2026-11-13-legacy-original-recording.md`. Branch: `feat/legacy-original-recording`.

## User outcome

Two named, independently consenting participant roles can remember around a preserved photograph. The host requests the microphone only when ready, pauses/resumes/stops a shared original, reviews device audio and deliberately backs it up. Original chunks, checksum, pinned source, consent snapshot and durability evidence remain separate from the solo narration and every human speaker note. The photograph remains visible by the controls. Guests replay only granted material and identify only their own sections; conflicting recollections remain separate.

A failed backup retains the same device source for retry. A killed page recovers persisted chunks as partial without reopening the microphone. A late permission grant after cancellation stops its tracks. Active-take Web Locks prevent another tab finalizing a live prefix. Storage exhaustion stops capture; available in-memory bytes remain protected while the page is open and can be backed up without claiming they survived reload. Consent loss stops capture and prevents confirmation of that old epoch, even after later re-consent.

Durable originals support private range replay. Whole-memory deletion includes pending/durable session audio, speaker notes, late upload cleanup, and local IndexedDB records/chunks in this browser. A content-free deletion receipt counts the extra objects. Other devices' downloaded/local copies and arbitrary external copies cannot be silently recalled; no global erasure guarantee is claimed.

## Implementation

Migration 0011 adds immutable original reservations, pending/durable media receipts, additive self-identified speaker sections, and deletion intent on sessions. Apply it before deploying this Worker. Existing deletion integration fixtures now apply the corresponding new migrations; no checks were skipped or weakened. No dependencies or live resources were added.

Recording request IDs deterministically recover the same reservation. The snapshot contains the two latest current consent events, not an unbounded history. Uploads enforce byte limits while reading the body, validate signatures/hash and bound the browser-reported duration; they do not claim server-decoded duration or speaker verification. R2 conditional writes and head evidence precede a transactional consent/durability update. A failed final check does not label backup complete. Revocation denies metadata, photo, recording and note access. No Jitsi or external fallback is introduced.

## Verification

Final counts and CI status are appended after the complete verification run. Evidence uses generated/synthetic media, transactional SQLite D1/R2 fixtures and Chromium's fake microphone. No real-family media or external provider is called.

The deterministic integration suite covers pre-consent denial, host-only capture, in-person scope, source/consent immutability, exact reservation retry, interrupted storage/retry, immutable bytes and receipts, byte-range replay, anonymous/guest privacy, invalid signatures/hashes/duration/body size, consent withdrawal during writes, changed-epoch refusal, separate own-attribution, invalid ranges, revocation, deletion of unconfirmed sources and a late object after deletion. Browser contracts are mocked separately from those database/storage proofs.

Phone browser evidence covers English/Spanish recording/pause/review, failed backup then reload with the same digest, correct private receipt/replay and additive original-language notes; reload during capture; consent loss; no microphone before deliberate authorized action; late permission cancellation; a second tab encountering an active take; storage exhaustion retaining the actual available original; and whole-memory deletion from another tab. Source checksums and copy/attribution boundaries are assertions, not screenshot-only claims.

## Anti-drift and remaining gates

Idea/mechanism: preserve two people's authentic voices around one photograph. Source authenticity, private default, ownership and separate attribution: YES. Interruption/retry and scoped cross-device replay: YES within the tested device/account/capability boundaries; unpersisted bytes remain an explicit limitation. AI role: N/A. Makes the memory more connected and trustworthy: YES. No sharing reward, inferred speaker certainty, generated consensus or primary-source replacement is added.

This is engineering proof, not D02's uncoached two-person acceptance or full R2/MVP v0.5 completion. No physical phone, older-person usability, full WCAG conformance, live two-network call, provider retention assurance, production migration/deployment or independent human review is claimed. Final group consent/retention/stewardship rights remain open and block public activation. Complete export must later include session originals, consent snapshots and notes. Current browser qualification, source duration metadata, pending-object repair and device copies must remain visible in the final acceptance pack.

## Local verification receipt

`XDG_CONFIG_HOME=/workspace/work/config PLAYWRIGHT_BROWSERS_PATH=/workspace/work/browsers npm run verify` passed: typecheck, lint, 138 unit/integration tests in 33 files, schema/foreign-key/integrity checks, production build, Worker dry-run and 43 phone Chromium browser tests. The last full run took about 2.3 minutes for browser checks. English/Spanish replay screenshots were visually inspected, including source-photo prominence, readable controls and additive unmodified testimony. The source photo's viewport visibility while recording is also asserted. The participant remove-access control uses the existing large secondary-action style. No independent reviewer is claimed.

The initial dry-run attempt lacked the workspace Wrangler config path and failed before any deployment; setting `XDG_CONFIG_HOME` resolved it. A new deletion test initially lacked its track-observation instrumentation; that instrumentation was corrected and the complete suite passed without weakening the assertion. Final CI status remains separate from local results. Existing client bundle warning remains (approximately 568 kB minified / 167 kB gzip); Worker dry-run was approximately 366 KiB / 86 KiB gzip. Physical devices, live provider, legal policy, production and uncoached human gates remain open.
