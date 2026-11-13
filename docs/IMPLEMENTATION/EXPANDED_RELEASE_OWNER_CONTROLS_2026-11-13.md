# Expanded first-release scope and owner controls

**Date:** 2026-11-13  
**Base:** `origin/main` at `0d4452eb9ffb78ad22758d00ab32df0fdead0367`  
**Branch:** `feat/expanded-release-owner-controls`  
**Head:** the commit containing this receipt (resolved in the PR; no self-referential hash)  
**Status:** implementation and local verification; awaiting GitHub Verify and review. Not merged, not staged live, not release-accepted.

## Scope decision and implementation

The owner explicitly moved all six requested capability groups into the first-release boundary. `DECISIONS/2026-11-13-expanded-first-release.md` records that direction; the expanded release matrix, Definition of Done, campaign controls and task queue now agree. Required but unimplemented outcomes remain pending. The existing source-media pipeline is the foundation, not proof of the broader release.

This first code slice closes owner-facing share management and two recovery defects:

- Authenticated paginated `GET /resources/living-memories/:id/shares` exposes only safe selection/status metadata, with owner-scoped cursors. It does not expose bearer URLs, tokens, hashes, private transcript/context or account details.
- On returning to a completed memory, the owner can inspect and revoke active links, confirm/cancel the action, refresh status, and load older records. Revocation remains idempotent. Public page/photo/voice endpoints return 404 afterward.
- UI explains anyone possessing a link can open it without signing in, previous addresses are not recovered by inventory, and external downloaded copies cannot be recalled. “Keep private” navigation no longer implies withdrawal of already-created links.
- Muse speech can be stopped during loading/playback and replayed. Pending requests are aborted; late responses cannot start audio after cleanup; object URLs are released on rejection, completion, stop, text change and unmount. Text remains available when speech fails.
- Transcription polling restarts after a failed job is retried; rapid duplicate retries are guarded.

No schema migration, original-media mutation, entitlement change, provider change, live deployment or real-family data was used.

## Verification

- Focused sharing integration: 5 tests passed, including owner/stranger isolation, safe inventory, idempotent revocation, all three public paths, and pagination with matching timestamps.
- Final canonical verification: PASS. Typecheck, lint, 26 unit/integration files / 85 tests, schema integrity (29 required objects), production build, Cloudflare deployment dry run and 14 phone-Chromium browser tests passed. Browser run duration: 1.4 minutes. No check was skipped.
- Browser additions exercise return/reload/revoke confirmation, transcript failure→retry→conversation, speech stop/replay and rejected playback with URL cleanup.
- An existing voice-reply browser locator was scoped to the attributed reply bubble: the previous broad text match could select both the persisted reply and an outgoing textarea during a transition. The assertion still requires the storyteller's returned content, next Muse question, original voice player and exactly one conversation POST.
- The first browser run found that locator race and a new assertion that included the decorative speaker icon. Both assertions were corrected; no outcome checks were removed.

The default environment's npm/Wrangler/browser cache directories are not writable. Dependencies and verification use workspace-local cache/config/browser paths. `XDG_CONFIG_HOME=/workspace/work/config PLAYWRIGHT_BROWSERS_PATH=/workspace/work/browsers npm run verify` runs the canonical repository checks without deployment.

## Anti-drift review

- **Idea/mechanism/customer value:** a person can withdraw future access to a family memory after leaving and returning; failed transcription and optional speech cannot strand the existing solo journey.
- **Source authenticity:** YES. Original photo/audio, transcript and context are unchanged; no model output becomes testimony.
- **Privacy and ownership:** YES. Owner-scoped inventory and cursor validation; revocation closes the same bounded artifact, with no URL/hash disclosure.
- **Offline/recovery:** YES for the changed transitions. Failed requests show retry/status; revocation requires a durable backend response. Existing local-original recovery remains intact.
- **Cross-device continuity:** backend inventory persists in D1; reload tested. Actual second physical-device acceptance remains pending.
- **AI role:** unchanged. Speech is assistance, with text retained; original human voice stays separate.
- **Growth:** voluntary sharing only, no free-capacity reward or automatic external publication.
- **Architecture:** existing Workers/D1/R2 and API/UI boundaries; no new provider/framework or migration.
- **Affected invariants:** I-08–I-10, I-15–I-17, I-19–I-23, I-26, I-29–I-30; expanded scope additionally maps all relevant invariants in its decision/matrix.

## Evidence limits and next work

Local synthetic tests are not fresh live Cloudflare/Clerk/ElevenLabs proof, physical Android/iPhone proof, legal approval, or uncoached human acceptance. The execution environment has no staging/provider secret bindings. Final paid offers/terms and legally operative stewardship/contributor policies remain open; no values or approvals were invented.

Editable review, voluntary Muse finish, full bilingual UI and the six expanded capability groups are not marked implemented by this receipt. Continue the single active `solo-trust-controls` task, then the expanded matrix in dependency order. No production action is authorized by a green check.
