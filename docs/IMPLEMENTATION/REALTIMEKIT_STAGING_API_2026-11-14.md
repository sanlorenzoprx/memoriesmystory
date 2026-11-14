# RealtimeKit isolated staging API proof

Date: November 14, 2026. Active packet: D03 Our Living Legacy. Owner authorization: resume the isolated RealtimeKit staging setup using the previously supplied repository Actions secret/variable, after successful read-access run 43592575231. No additional guest account or identity provider is introduced.

## Implementation

Manual `realtimekit-staging.yml` runs a dependency-free operator script inside Actions. It discovers/reuses exactly named `memoriesmystory-staging` and `memoriesmystory-unrecorded` resources, creating only those if absent. Existing duplicate names or an unsafe existing preset cause failure; existing resources are never silently changed. Serialized dispatches avoid competing setup runs.

The preset allows ordinary group audio/video, skips the waiting room, limits visible streams to two and disables participant recording/livestream/transcription, permission changes, moderation, chat, plugins, polls and screen sharing. The synthetic meeting disables auto-recording, livestream, post-meeting transcription/summaries and persisted chat. The API proof verifies persisted flags before creating two synthetic participant identities, checks decoded token meeting/participant scope and requested 15-minute expiry, and refreshes each token. JWT decoding is a diagnostic check against a trusted provider response, not a replacement authentication mechanism.

Finally, admission is deactivated, participant records are deleted and their absence verified, and the stored meeting status is checked. Partial/uncertain participant allocations are enumerated only within this newly created synthetic meeting for cleanup. An uncertain meeting allocation is not retried or falsely marked cleaned. The fixed staging app/preset remain for later integration; the synthetic meeting is retained inactive as content-free evidence. No browser connects, media is transmitted, recording starts, deployment occurs, or billing is activated.

Only constant stages/statuses, bounded numeric provider codes and validated non-secret app/preset identifiers are emitted. Account/API credentials, participant JWTs and upstream response bodies never enter summaries/artifacts. The credentials remain inside Actions. Runtime secrets are not extracted to the assistant's terminal.

## Verification and remaining gates

Local typecheck, lint and eight targeted tests cover designated allocation/reuse, unsafe/ambiguous resources, restricted flags, short scoped grants, partial allocation cleanup, failed cleanup, ambiguous meeting creation, denied writes and redaction. These are deterministic fixtures; live workflow results must be recorded separately. Full CI is required before merging the manual workflow onto the default branch.

A successful API proof does not establish live browser joining, delivered/playing audio/video, distant-endpoint latency, guest expiry across sessions, or archival durability. PR #29 remains the separate draft application call slice. Next: exercise that UI against these isolated resources with synthetic media, then implement/verify consent-controlled composite video and separate speaker audio archival. Full MVP v0.5 and owner-deferred physical-device acceptance remain pending.

## Invariants / anti-drift

I-10, I-19, I-25 and I-30: no source assets or family testimony are used. Restricted permissions and explicit unrecorded flags keep this staging experiment separate from future recording consent. Recovery is explicit and cleanup confirmation must succeed before a passing result. This strengthens the privacy/reliability boundary for connecting family voices; it changes no Foundation rule, price, retention policy or consumer identity flow.

## Live API result

[Run 43593728473](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43593728473) passed on November 14 after PR #31 merged. It reported all five API checks passed and `cleanupConfirmed: true`. The designated app and restricted preset now exist in Cloudflare; no browser/media/recording/deployment claim follows from this API result. The browser experiment is documented separately in `REALTIMEKIT_BROWSER_PROOF_2026-11-14.md`.
