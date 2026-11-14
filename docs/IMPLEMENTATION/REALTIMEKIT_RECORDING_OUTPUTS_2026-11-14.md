# D03 — Managed recording output verification

Base: current `origin/main` at `008d938dd5d58da981b29e3f00bef9a2cbe470b0`. Owner authorized continuing the full V2 requirements, starting with consent-controlled remote recording/separate audio/private archive. This first bounded gate verifies the provider outputs before application capture/archival code depends on them.

The manual recording workflow uses only generated sine-wave audio and synthetic video in a dedicated low-level SDK page. It is deliberately separate from the consumer call UI, which still correctly says unrecorded. Both test sources are explicitly synthetic; the fixture is not human consent or an implemented consumer recording feature. The existing restricted participant preset remains unable to record or livestream; only the trusted server-side operator initiates the synthetic provider recordings.

Start separate-track recording, then composite recording with documented `allow_multiple_recordings: true` and a 60-second composite hard cap; stop after a short synthetic sample. Poll both lifecycle states, require uploaded outputs, map every audio file to exactly one known enrolled participant rather than inferring speakers, download through bounded HTTPS/approved-provider origins without forwarding the API token, hash actual bytes and inspect streams/duration with ffprobe. Reject unconfirmed/missing speaker outputs. All temporary sources/downloads are removed and never exported as artifacts. Signed URLs, credentials, JWTs and provider bodies stay out of logs.

Cleanup reconciles uncertain recording allocation and attempts stops before closing admission/deleting test peers. Failed recording cleanup must not prevent the meeting/participant cleanup attempt, and no failed cleanup becomes a passing receipt. This bounded run uses ordinary calling/recording minutes, creates no recurring plan or production deployment, and sends no family content.

The public docs currently describe track recording as audio-only and managed-bucket downloads as temporary. Separate video tracks are not assumed supported; raw RTP is not substituted for playable recordings. Public docs and SDK differ on selective-track beta wording, so this controlled two-identity fixture records all of its generated sources and verifies the complete mapping. Production selection/authorization remains to be implemented and verified.

Local focused verification: typecheck, lint, 14 targeted tests across the staging lifecycle and output parser/download checks. Full CI and the real workflow outcome must be recorded separately. No recording availability, simultaneous-output support, exact billing mapping or private R2 archival durability is claimed until actually verified. This step computes hashes of downloaded provider outputs; it is **not** the family's durable archive.

Next within D03: implement the consumer recording consent/state/recovery boundary and private immutable R2 ingestion/receipts/replay once actual output behavior is established. The uploaded handoff cross-reference is `V2_HANDOFF_RECONCILIATION_2026-11-14.md`; the one execution queue remains unchanged in authority.

## First live attempt — runner dependency, not provider evidence

Run 43597324010 stopped at the media-inspection precondition because the hosted Ubuntu runner did not include ffprobe. The credential-bearing recording step was skipped, so recording/media API availability was NOT_RUN. The workflow now installs the official Ubuntu ffmpeg package when absent before injecting provider credentials. This is a scoped runner fix; no application behavior or API contract is relaxed.
