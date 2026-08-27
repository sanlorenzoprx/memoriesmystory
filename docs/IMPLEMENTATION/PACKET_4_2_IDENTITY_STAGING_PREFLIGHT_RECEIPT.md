# Packet 4.2 — Identity Staging Preflight Receipt

**Date:** 2026-07-16  
**Branch:** `packet-4/account-binding-recovery`  
**Implementation commit verified by CI:** `c3fce54165d1b87495b5b36b1a8e91aff4603947`  
**Background-sync hardening commit verified by CI:** `128aeccf05376ad0d970f1f9770357099bfcc66f`
**CI run:** `29506865443`  
**Hardening CI run:** `29523952562`
**Draft pull request:** `https://github.com/sanlorenzoprx/memoriesmystory/pull/3`  
**Application:** `memoriesmystory`  
**Status:** blocked before live staging, as designed

## Outcome

The repository now has one deterministic, redacted gate before any Clerk or Cloudflare staging action. It validates the shape and isolation of required configuration, prints only `present`, `missing`, `invalid`, `deferred`, or `optional`, and makes no network request.

The preflight does not pretend that configuration declarations are live-provider proof. Email, Google, Facebook, callback behavior, second-device continuation, staging D1 migration, and private R2 recovery still require real isolated-staging evidence.

## Required private inputs

| Input | Purpose |
| --- | --- |
| `SESSION_SECRET` | Pepper opaque application-session hashes. |
| `CLERK_SECRET_KEY` | Verify Clerk identity server-side. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Initialize the Clerk browser UI. |
| `CLERK_AUTHORIZED_PARTIES` | Restrict tokens to exact HTTPS application origins. |
| `MEMORIES_STAGING_ORIGIN` | Name the isolated HTTPS acceptance origin. |
| `CLOUDFLARE_ACCOUNT_ID` | Select the authorized staging account. |
| `CLOUDFLARE_API_TOKEN` | Permit bounded automated staging provisioning/deployment. |
| `MEMORIES_STAGING_D1_DATABASE_ID` | Select a real non-production D1 database. |
| `MEMORIES_STAGING_R2_BUCKET_NAME` | Select the private staging originals bucket. |
| `MEMORIES_STAGING_WORKER_NAME` | Select the isolated staging Worker. |
| `CLERK_EMAIL_ENABLED` | Operator readiness declaration for email verification. |
| `CLERK_GOOGLE_ENABLED` | Operator readiness declaration for Google. |
| `CLERK_FACEBOOK_ENABLED` | Operator readiness declaration for Facebook; explicit `false` is an interim deferral, never acceptance. |

`CLERK_JWT_KEY` is optional and supports networkless Clerk JWT verification. No actual value belongs in Git, receipts, screenshots, logs, prompts, or chat.

## Verification

- TypeScript client and Worker type checks: passed.
- ESLint: passed.
- Vitest: passed, 12 files and 48 tests in the hardening run.
- Preflight success fixture: passed without printing any sentinel value.
- Insecure HTTP origin: rejected.
- Non-deployable zero D1 ID: rejected.
- Empty operator environment: rejected with 13 items reported missing.
- Live provider calls: none.
- Cloudflare resource calls or deployment: none.
- GitHub Actions CI run `29506865443`: passed typecheck, lint, 46 tests, build, Cloudflare dry run, and all 8 phone-first browser paths.
- GitHub Actions hardening run `29523952562`: passed typecheck, lint, 48 tests, build, Cloudflare dry run, and all 8 unchanged phone-first browser paths.

## Background-sync race hardening

The documentation-only follow-up exposed a real pre-existing timing race in the offline photograph path. A background photograph upload could settle after voice recording and write an older draft snapshot, erasing the newly accepted audio state from IndexedDB.

The client now merges only the settling asset's upload fields into the latest local draft. A response for an asset replaced while its request was in flight is ignored, as is a stale response after that asset is already durable. Two focused regression tests cover both the photo/voice interleaving and replacement cases. The existing offline phone-browser scenario was not weakened or rewritten and passed in hardening run `29523952562`.

## Initial blocker (superseded by operator configuration)

The real operator environment contains none of the 13 required Packet 4 staging items available to this workspace. The preflight exited nonzero and therefore no Clerk, D1, R2, Worker, callback, or second-device live check was attempted.

This is the required stop condition in `docs/EXECUTION/AUTHORITY_AND_STOP_RULES.md`: a required credential is missing in the packet that owns it. Packet 5 remains pending.

## Resume instruction

1. Copy `.env.staging.example` to ignored `.env.staging.local` on the trusted operator machine.
2. Create or select isolated Clerk and Cloudflare staging resources.
3. Load real values privately; do not send them through chat.
4. Run `npm run preflight:identity:staging`.
5. Return only the redacted output or confirm that every line is `present` and the preflight is green.

The next authorized action is the bounded live Packet 4 staging acceptance run. Production remains untouched.

## 2026-07-16 Facebook staging deferral

The isolated Clerk application enabled email, Google, and Facebook with shared development credentials. Email and Google were exercised successfully. The Facebook path returned an upstream “App not active” response. Preparing custom Meta credentials then exposed business verification, app review, privacy-policy, and user-data-deletion prerequisites that the owner explicitly deferred.

The preflight now permits `CLERK_FACEBOOK_ENABLED=false` as the status `deferred`, while still failing for a missing or unrecognized value. This permits a bounded email-and-Google staging run without making a false Facebook claim. Facebook remains required by the accepted Phase 1 decision, Packet 4 phase gate, and final Definition of Done; Packet 4 cannot be marked complete while it is deferred.
