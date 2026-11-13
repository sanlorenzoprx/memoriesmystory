# D01 — Private two-person session, invitation and consent

Authority and design: `../DECISIONS/2026-11-13-private-legacy-session-boundary.md`, `../EXECUTION/MVP_V0_5.md`, expanded release R2 and the owner-requested V2 handoff. Base: main `3c50c49fbb23994dd25d9024e04286c0cff29e62` (archival scan PR #25 merged with CI proof).

## Delivered boundary

- Owner starts a session from a completed Living Memory, names themselves and selects in-person/remote mode. The photo is pinned; source bytes and ownership stay unchanged.
- One expiring invitation uses a fragment token (not a URL query), stores only a hash and consumes once. Exact request retry recovers the same session/invitation/access. Host can reopen a still-unused invitation after reload and find existing conversations again from the same Living Memory.
- Guest receives only session metadata and its selected photo via a scoped HttpOnly/Secure/SameSite cookie. Guest membership does not expose the host's archive or solo voice. Logged-in guests may bind their own account. Names are supplied by people, not inferred identities.
- Each participant chooses their own versioned consent. Two active, joined and consenting roles are required for readiness. Consent history is immutable; mismatched session/scope or revoked participants cannot append an event. Withdrawal removes readiness. Host removal immediately denies subsequent guest pixels/metadata.
- Phone UI supports English/Spanish, explicit opt-in, withdrawal, access removal, private invitation recovery, and removal of the photo when polling detects lost access. No media permission is requested in this slice.
- Whole-memory deletion cascades session membership/consent and removes its original media, preserving existing owner deletion behavior.

## Verification

Focused integration: 5 tests pass using synthetic owned/durable records, all migrations including 0010, transactional SQLite D1 and private R2 fixtures. Covers idempotency/conflicts, source pinning, anonymous access denial, one-use invitation and lost-response retry, expiry, foreign source denial, independent consent, immutable history, host-only revocation, consent withdrawal and deletion cleanup.

Focused phone Chromium: 2 tests pass (English and Puerto Rico Spanish), covering guest join, opt-in disabled until checked, own consent, withdrawal, host controls absent, no horizontal overflow and photo removal on revocation. Browser contracts are mocked; the integration suite proves database/storage authorization. No real family data or external video/push services were used.

Full verification: typecheck, lint, 131 unit/integration tests (32 files), D1 schema checks, production build and Worker deployment dry-run passed. All 34 phone Chromium regression tests passed. After adding owner session-list recovery, typecheck/lint/131 tests/build/dry-run passed again; the list is also covered in the session integration suite. English/Spanish screenshots were visually inspected. Existing bundle-size warning remains. CI/review status is separate from these local results. No independent reviewer, physical-device/human acceptance, live provider call, production migration or deployment is claimed.

## Anti-drift

Idea/mechanism: connect two people's memories around an authentic preserved photograph. Customer value: deliberately bounded conversation access and individual recording choice. Source authenticity, privacy and ownership: YES. Offline/recovery: YES for session request retry/reopen, not offline media capture (next slice). Cross-device continuity: YES for the owner/account-bound guest; anonymous guest access is device-scoped and expires. AI role: N/A. Improves connection and trust: YES. No publication reward, inferred testimony or external archive projection is added. Existing solo preservation remains canonical.

## Remaining work and gates

This is the session/consent boundary, not completion of R2 or MVP v0.5. In-person original recording, interrupted-capture recovery, durability/retry/replay, separate attribution, remote media adapter and two-device evidence remain. Final consent/retention/access policy, live provider configuration and physical/human acceptance remain open. Previously accepted recordings cannot be given invented legal deletion/retention semantics. Export must later include session sources and consent provenance before complete-archive acceptance.

The user removed Jitsi fallback. SureDose PR #4 merged as `56e7a7c86e21d18610a047e9d0c793485771c6cf`, all five CI jobs passed; 390 local tests/typecheck/build and focused dev/built phone/desktop retry/back checks passed. It retains configured-provider video and in-app retry/Family exit. Memories has no Jitsi integration.
