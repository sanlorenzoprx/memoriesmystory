# Remote Our Living Legacy staging setup

D02 shared original recording/recovery/replay is merged in PR #27 (`942d9808e51de24ccdd5978a8d5be4d830274ace`), with 138 unit/integration tests, 43 phone browser tests and CI run 43539395845 passing. Migration 0011 has not been deployed by this work. D03 owns the next remote-media/provider experiment; this document is a concrete configuration handoff, not a working-video claim.

## Actual missing access

The current managed environment has no attached Cloudflare/Clerk staging credentials and no `.env.staging.local`. Both the identity and remote-video redacted preflights are blocked. GitHub access does not grant Cloudflare or Clerk access; the repository's CI deliberately uses no live deployment secrets. Historical staging proof does not restore those credentials on this machine.

Attach these bootstrap items privately through environment/secret configuration:

| Name | Purpose | Classification |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Identify the isolated staging account | Identifier |
| `CLOUDFLARE_API_TOKEN` | Authorized staging Worker/D1/R2/Queue and Realtime app work, scoped appropriately | Secret |
| `CLERK_SECRET_KEY` | The project's separate Clerk test/staging instance | Secret; test key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Matching Clerk test browser instance | Public environment-specific key |

Do not paste secret values into chat, commit them, upload them, or put them in command arguments/logs. Existing ignored environment/secret mechanisms are described in `../SECURITY/SECRETS_AND_CONFIGURATION.md`. If the project already has these credentials stored privately, restore that configuration rather than creating a new identity provider or using production keys.

After access is restored, routine session secrets can be generated privately, staging resource identifiers/origins filled in, and an isolated Realtime SFU app created or reused within the authorized staging scope. The owner does not need to invent those values or manually implement this setup. Runtime provider configuration uses `REALTIME_SFU_APP_ID` and backend-only `REALTIME_SFU_APP_SECRET`. A Cloudflare API token is not an SFU App Secret. The latter authorizes the Connection API and must never enter a `VITE_` variable or browser bundle.

## Redacted checks

Run from the repository root with privately configured environment variables, or the ignored `.env.staging.local` file:

```sh
npm run preflight:identity:staging
npm run preflight:legacy:staging
```

The new command makes no network request, creates no resource and captures no media. It reports only constant names, purpose and present/missing/invalid status. `blocked_credentials` means bootstrap access is missing; `blocked_configuration` means access has a valid shape but derived provider/runtime configuration remains; `shape_ready_live_proof_pending` is deliberately not an authentication, isolation, call-quality or cost claim. Live Clerk keys are rejected for this isolated prototype. The existing identity/resource preflight still owns full deployment readiness.

Core typecheck/lint/tests/build/dry-run continue to require no live credentials. Do not weaken or skip these checks to proceed past this gate.

## Next authorized experiment

1. Verify the supplied account and test identity scope without printing credentials; restore/provision isolated staging resources. Preserve previous synthetic acceptance records unless a deliberate cleanup is requested.
2. Create/reuse an isolated Cloudflare Realtime SFU app. Keep its secret server-side. Use `https://rtc.live.cloudflare.com/v1/apps/{appId}` behind the session/participant authorization boundary. Log only bounded diagnostic status/correlation data.
3. Compare this hosted proof against a minimal test-only peer baseline as required by V2 D03. The approved Cloudflare stack is the initial hosted candidate; SureDose supplies interaction observations, not inherited code or a new provider choice. No custom production signaling or second vendor is justified by missing credentials.
4. Serialize mutations on each provider session, validate top-level/per-track results, retain successful allocations, and do not blindly retry uncertain session creation. A diagnostic `correlationId` is not an idempotency key. An active provider track is not proof of delivered/playing media.
5. Measure endpoint connection/delivery statistics, reconnect, microphone/camera controls, individual consent and revoke/withdrawal behavior. Define clearly what original tracks are recorded, their integrity/durability and what was missing during interruption. Keep the photo large and participants in smaller tiles.
6. Preserve an honest, scoped replay and separate human attribution. Retry/leave remains in-app; no Jitsi/public-room/external backup fallback. Synthetic tests are not a production fallback or live evidence.

Official API reference inspected at Cloudflare docs commit `d27dee90f792d56ddc6550a3a77157ceb76f33fc`, `src/content/docs/realtime/sfu/api/index.mdx`. Provider capability, retention and current cost must be verified for the actual staging app; no winner or production plan is selected from a configuration preflight.

Physical two-phone/two-network and uncoached family acceptance remain scheduled for the owner's MVP v0.5 milestone. Final recording/retention/contributor rights, production, live billing and real-family media through any unapproved provider remain separate gates. The campaign's required-credential stop rule is the reason D03 live work waits for actual access; it is not another routine engineering approval request.

## Verification receipt — 2026-11-13

Base: main `942d9808e51de24ccdd5978a8d5be4d830274ace`. Branch `chore/legacy-remote-staging-preflight` adds only the redacted operator command, constant-name examples, its tests and evidence/status documentation; it does not implement a provider fallback or enable a call.

`XDG_CONFIG_HOME=/workspace/work/config PLAYWRIGHT_BROWSERS_PATH=/workspace/work/browsers npm run verify` passed locally: typecheck, lint, 141 unit/integration tests (34 files), schema checks, production build, Worker dry-run and all 43 phone Chromium tests. Three new tests prove missing-access handling, rejection of live identity keys/unsafe origins, no provider calls, and exclusion of every supplied synthetic value from CLI output. The existing bundle-size warning remains. CI status is separate from this local receipt.

The actual `npm run preflight:legacy:staging` exited 1 with `blocked_credentials`; all eight configuration items were missing. The existing identity staging preflight also reported missing access/configuration. These are expected evidence of the present gate, not failing core verification or a reason to skip tests. No credential values, provider request, resource creation, media capture, deployment, production access or charges were involved.
