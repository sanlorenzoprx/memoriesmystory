# Packet 4.2 — Identity Staging Preflight Receipt

**Date:** 2026-07-16  
**Branch:** `packet-4/account-binding-recovery`  
**Application:** `memoriesmystory`  
**Status:** blocked before live staging, as designed

## Outcome

The repository now has one deterministic, redacted gate before any Clerk or Cloudflare staging action. It validates the shape and isolation of required configuration, prints only `present`, `missing`, `invalid`, or `optional`, and makes no network request.

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
| `CLERK_FACEBOOK_ENABLED` | Operator readiness declaration for Facebook. |

`CLERK_JWT_KEY` is optional and supports networkless Clerk JWT verification. No actual value belongs in Git, receipts, screenshots, logs, prompts, or chat.

## Verification

- TypeScript client and Worker type checks: passed.
- ESLint: passed.
- Vitest: passed, 12 files and 46 tests.
- Preflight success fixture: passed without printing any sentinel value.
- Insecure HTTP origin: rejected.
- Non-deployable zero D1 ID: rejected.
- Empty operator environment: rejected with 13 items reported missing.
- Live provider calls: none.
- Cloudflare resource calls or deployment: none.

## Current blocker

The real operator environment contains none of the 13 required Packet 4 staging items available to this workspace. The preflight exited nonzero and therefore no Clerk, D1, R2, Worker, callback, or second-device live check was attempted.

This is the required stop condition in `docs/EXECUTION/AUTHORITY_AND_STOP_RULES.md`: a required credential is missing in the packet that owns it. Packet 5 remains pending.

## Resume instruction

1. Copy `.env.staging.example` to ignored `.env.staging.local` on the trusted operator machine.
2. Create or select isolated Clerk and Cloudflare staging resources.
3. Load real values privately; do not send them through chat.
4. Run `npm run preflight:identity:staging`.
5. Return only the redacted output or confirm that every line is `present` and the preflight is green.

The next authorized action is the bounded live Packet 4 staging acceptance run. Production remains untouched.
