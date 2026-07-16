# Packet 3 — Original Media Durability Receipt

**Date:** 2026-07-16

**Branch:** `packet-3/original-media-durability`

**Implementation commit verified by CI:** `6d59bd3bb773b04ca773fa02ef2c57232192e633`

**Draft pull request:** `https://github.com/sanlorenzoprx/memoriesmystory/pull/2`

**Application:** `memoriesmystory`

## User outcome delivered

A person can preserve the accepted original photograph, record up to the centrally configured voice allowance, hear the local recording, retry either interrupted upload without creating another original, and then play the independently retrieved private recording after both R2 objects and D1 receipts are confirmed.

The experience distinguishes three truths:

- the original is recoverable **on this device** before upload;
- the original is **being preserved** while confirmation is pending;
- the originals are **safely backed up** only after independent D1/R2 verification.

It does not show the locked completed-Memory-Story sentence because account ownership and finalization belong to later packets.

## Delivered

### Scoped anonymous draft ownership

- Every local draft receives a cryptographically random 256-bit draft token.
- The token stays in IndexedDB and travels only in an authorization header; it is never placed in a URL or R2 key.
- D1 stores only the SHA-256 token hash.
- Wrong-token status and playback requests fail closed.
- Same-origin mutations require the custom `X-Memories-Request` header and reject a foreign Origin.

### Immutable private originals

- Declared the `MEDIA_BUCKET` R2 binding with the canonical `memoriesmystory-media` resource name.
- Uses identity-only object keys under `drafts/{draftId}/assets/{assetId}/original.{ext}`.
- Validates supported MIME, byte limit, SHA-256, file signature, audio duration, draft scope, asset identity, and idempotency before durability confirmation.
- Uses conditional R2 creation and refuses to replace an object already bound to a different checksum or size.
- Keeps personal filenames, titles, emails, testimony, and draft secrets out of object keys and metadata.

### Recoverable D1/R2 operation

- Creates an operation receipt and pending media identity before the R2 write.
- Records checksum, byte size, type, duration, object key, R2 entity tag, correlation ID, and durable status.
- Replays a successful retry from the original receipt.
- Resumes a failed or interrupted attempt with the same asset and idempotency identity.
- Recovers an R2 object whose final D1 update was interrupted by checking deterministic key metadata.
- Marks the draft `needs_connection` on storage failure without losing the local original.

### Contextual real-voice experience

- Begins only after the photograph receipt is durable.
- Requests microphone access only after **Start recording**.
- Negotiates a supported `MediaRecorder` MIME type and enforces the centralized 30-second allowance.
- Stores original audio bytes, checksum, duration, asset ID, retry key, and state in IndexedDB before upload.
- Supports local playback and deliberate rerecording before durability.
- Keeps the photograph visually dominant during invitation, recording, review, and preservation.
- Retrieves the durable private original through the authorized Worker route for playback.

### Private playback and scale

- Owner-scoped media reads consult D1 authorization before R2.
- Responses are `private, no-store` and support byte-range delivery.
- The Worker remains stateless; retry state is held in D1/R2 and the recoverable browser draft.
- Original identities never depend on process memory, filenames, or a single device session.
- No fake authentication provider, AI processing, finalization, or sharing behavior was introduced.

## Product Invariant evidence

| Invariant | Packet 3 evidence |
| --- | --- |
| I-01 Original voice | The original `MediaRecorder` bytes are stored privately and played from the authorized preserved object. |
| I-02 Photograph + voice | Both original roles share one scoped draft and the status read requires both before `originalsDurable`. |
| I-06 Immutable originals | Stable asset IDs, conditional R2 creation, D1 immutable-identity trigger, and conflict tests prevent overwrite. |
| I-07 Additive history | Every mutation has a correlation/idempotency receipt; rerecording creates a new asset identity. |
| I-08 Saved means durable | Backed-up language appears only after R2 entity tags, D1 durable records, an independent status read, and private retrieval. |
| I-11 Technology background | User copy speaks about photograph, voice, connection, and protection—not hashes, R2, or D1. |
| I-13 Recoverable guidance | Permission denial, network interruption, reload, retry, and local playback preserve progress. |
| I-14 Accessibility | Large recording controls, focused route states, timer semantics, status announcements, and phone-first browser paths remain active. |
| I-22 Central limits | Image/audio sizes, MIME types, and the voice allowance come from `config/phase-1.ts`. |

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: passed, 9 files and 36 unit/integration tests.
- `npm run test:schema`: passed.
- `npm run build`: passed.
- `npm run deploy:dry-run`: passed; `DB` and `MEDIA_BUCKET` were recognized and no deployment occurred.
- `npx playwright test --list`: passed, 8 phone-Chromium paths discovered.
- GitHub Actions CI run `29498641211`: passed every step, including local D1 migration, local private R2, and all 8 phone-first tests.
- `git diff --check`: passed.
- Secret-pattern scan: no credential value found.

## Failure and recovery evidence

- Changed request under the same idempotency key: rejected.
- Reused asset identity with changed immutable content: rejected.
- Incorrect draft secret: rejected for upload/status/playback.
- Checksum or MIME-signature mismatch: rejected.
- Audio before durable photograph: rejected.
- Synthetic R2 interruption: local original retained; same operation safely succeeds on retry.
- Repeated successful request: same receipt returned; no second object created.
- Browser network interruption during photograph upload: same local draft resumes and reaches voice recording.
- Reload after both receipts: private original voice is retrieved and the same durable state returns.

## Deliberately deferred

- Email, Google, Facebook, session, and account ownership: Packet 4.
- Secure promotion of the scoped anonymous draft and second-device continuation: Packet 4.
- Queue, Workers AI transcription, mixed-language processing, and Muse: Packet 5.
- Completed Memory Story transaction and locked completion sentence: Packet 6.
- Private share projection and unlock: Packet 7.
- Real staging R2/D1 resource receipts and physical-device microphone/camera evidence: final acceptance gates.

## Next bounded task

Packet 4 — account binding and recovery. It must promote the exact durable draft without changing either original asset identity and prove continuation on a second authenticated device. The task queue activates Packet 4 and no later packet.

