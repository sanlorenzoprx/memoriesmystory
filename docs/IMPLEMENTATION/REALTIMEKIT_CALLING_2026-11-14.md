# D03 — RealtimeKit unrecorded calling

Date: November 14, 2026. Branch: `feat/realtimekit-legacy`, based on freshly fetched `origin/main` at `7abbebdde029a9b9d52b2e6f29e84dc89bb79e83`.

## Outcome and scope

Implemented a managed Cloudflare call path inside the existing photo-led Our Living Legacy session. The host opens the meeting; the invited guest joins using the existing private invitation/cookie, without a new account or recording agreement. Microphone/camera start off and activate only through explicit controls. Both people can leave/rejoin; the SDK handles reconnection, the UI shows interruption states, and poor-connection events disable outgoing video while retaining audio. Audible playback has a user-triggered recovery control. English/Spanish copy is included.

This is an **unrecorded** call slice. Existing D02 in-person originals/recovery/replay remain intact. Remote composite/per-speaker recording, voice reference enrollment, transcript attribution and archive ingestion are not implemented or claimed by this receipt. A live call or provider upload will not be treated as durable archival proof.

## Architecture and preservation

- Narrow server REST adapter and lazy-loaded browser Core SDK 2.0.4. No SDK/provider fields enter domain state; no vendor UI replaces the photograph-led interface.
- Migration 0012 adds provider meeting/participant mappings. One atomic D1 claim serializes host allocation, two participant identities map to the existing session, and retries refresh the actor's token. Tokens are not persisted in DB, URLs or browser storage. Initial and refreshed grants have centrally configured 15-minute validity, bounded by guest-access expiry for delivered guest grants.
- Newer participant validity fields are documented in Cloudflare's current [participant guide](https://developers.cloudflare.com/realtime/realtimekit/concepts/participant/) even though absent from inspected REST SDK 7.3.0 types. Refresh does not revoke previous grants; participant deletion revokes all grants and removes the active participant.
- Auto-recording, livestreaming, post-meeting transcription/summaries and chat persistence explicitly disabled. The server verifies the configured preset cannot record, livestream, escalate permissions, kick participants or transcribe, and is not a recorder. Consent remains a separate per-person application choice.
- Ambiguous allocations are retained for reconciliation rather than blindly repeated. The content-free session ID is in the provider meeting title. No family photo, original media, private archive record or display name is sent by this server call boundary; people explicitly publish microphone/camera media through the SDK when activated.
- Removal/deletion deactivates provider admission and deletes mapped participant identities before claiming provider cleanup. Failure retains mapping and denies new grants. Deletion closes the parent first; a schema trigger rejects late allocations. No new binding or Durable Object is necessary for this bounded slice.
- The calling preflight requires RealtimeKit configuration and existing session/origin configuration, not Clerk guest accounts or raw SFU credentials. Deployment/host identity checks remain separate.

## Verification

- `npm run verify:core` passed: typecheck, lint, **152 tests in 35 files**, schema integrity/foreign-key/immutability checks, production build and Worker deployment dry-run.
- `XDG_CONFIG_HOME=/workspace/work/config PLAYWRIGHT_BROWSERS_PATH=/workspace/work/browsers npm run test:e2e`: **45 phone Chromium tests passed**, including both new English/Spanish unrecorded-guest/outage/retry paths. A later media-status/late-permission cleanup refinement was typechecked and its affected browser paths rerun before publication.
- Eleven new integration tests cover unauthorized/CSRF denial, guest joining without account or consent, stable mappings/retries, serialized creation, unsafe preset rejection, short token grants, redacted ambiguous failures, provider access removal, cleanup retry, deletion ordering and rejected late allocations.
- Preflight was run and exited 1 with `blocked_credentials`: seven named settings missing, including the isolated RealtimeKit app/token/preset. No values were printed. No provider requests, resources, media capture, deployment or charges were incurred by preflight.
- Production build retains a size warning: main JS ~575 kB, separately/lazily loaded SDK chunk ~662 kB before gzip (~157 kB gzip). SDK download starts only after Join. Lower-powered-phone loading remains a live gate.

## Anti-drift assessment

- Idea/mechanism/customer value: family members can talk around one private photograph with fewer joining barriers.
- Source authenticity, privacy, ownership: YES; no source/derivative rewrites, scoped existing invitations, backend-only API credentials, individual opt-in media controls.
- Offline/recovery accounted for: YES for this unrecorded slice; interruption/leave/retry and fail-closed allocation states. Offline calling is unavailable and never implies preservation. Remote recording recovery remains unimplemented.
- Cross-device continuity accounted for: YES for reopening the existing host/guest session; per-identity multi-tab behavior and physical devices require live evidence.
- AI role source-grounded: N/A; provider AI/transcription disabled.
- Makes memory more connected: YES, with automated UI/API evidence; no claim of live connectivity yet.
- Invariants protected: I-10, I-15, I-17–I-19, I-25, I-30. Scope follows the owner-authorized [decision](../DECISIONS/2026-11-14-realtimekit-managed-calling.md).

## Remaining gates

No isolated runtime credentials are attached, so hosted media/token/removal semantics are **not verified**. Keep this as a reviewable development slice; no MVP, deployment, latency, reliable-save or physical-device completion claim. Follow the current section of [the staging runbook](../OPERATIONS/REMOTE_VIDEO_STAGING_SETUP.md).

Next required slice: validate the hosted call, then integrate consent-controlled composite video and separate speaker audio with confirmed output/billing behavior, private immutable R2 ingestion, checksums, partial/interrupted recovery, private replay/export and truthful archival receipts. Voice recognition remains a separate optional consented application feature. Full expanded-release scope remains active in `../EXECUTION/TASK_QUEUE.json`.

## Follow-up verification — November 14

GitHub CI [run 43585811285](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43585811285) passed for implementation head `d47dc237ff8f2a9cc9356d2d43287ebefb00cb84`. [PR #29](https://github.com/sanlorenzoprx/memoriesmystory/pull/29) remains a draft; no merge/deployment is claimed.

A fresh redacted calling preflight still reports all seven configuration fields missing. Managed environment status also reports no attached secrets. There is no callable shared-browser inspection tool in this turn, so an existing Cloudflare browser session could not be inspected. No user device or unrelated secret store was searched.

The active D03 hosted gate requires private Cloudflare staging access. Per `../EXECUTION/AUTHORITY_AND_STOP_RULES.md` ("a required credential is missing at the packet that owns it"), pause hosted validation here rather than claiming mock-only readiness or starting another active packet. Restore authorized staging account/API access privately; routine app/preset/session configuration can then be prepared without adding guest registration or a new identity system. Do not paste secrets into chat.

## Superseding hosted evidence — November 14

The earlier missing-access/hosted-unverified statements describe the initial build and are superseded for the tested synthetic scope. The owner supplied repository Actions credentials; read check 43592575231 and [staging API proof 43593728473](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43593728473) passed. [Live browser proof 43594590337](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43594590337) then passed against this exact application candidate at `d90afd5`: both clients received decoded video and nonzero audio with SDK playback running, audio continued with camera off, guest rejoin restored media, and active guest deletion removed them/released devices. The synthetic meeting was closed and participant records removed.

The staging app/preset are configured. API credentials remain inside Actions, not this workspace. Synthetic app-session/photo/token routes do not establish hosted application authorization or deployment; two Chromium contexts on one runner do not establish physical-phone or distant-network quality. See `REALTIMEKIT_BROWSER_PROOF_2026-11-14.md` for the precise boundary. Remote recording/attribution/private archive ingestion and the full MVP v0.5 remain pending. No production or application staging deployment is claimed.
