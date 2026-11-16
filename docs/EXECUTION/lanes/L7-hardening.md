# L7 — Hardening and trust

**Scope:** Security headers and CSP; rate limiting and Turnstile; error fallback, dead-letter queue, invitation secret; dependency audit in CI; legal pages with placeholder text and versioned acceptance; threat model and observability; route splitting and accessibility.
**Migration numbers:** 0034–0035
**Owns:** worker/index.ts structure, worker/rate-limit.ts, public/_headers, app/features/legal/, docs/SECURITY/, app/localization/catalog/hardening.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. L7.1 (security headers, share-link headers) and L7.2 (Worker error fallback) implemented by the coordinator, CI pending.

## Merged

None yet.

## Evidence level reached

L7.1–L7.2: INTEGRATION_PROVEN locally (receipt `docs/IMPLEMENTATION/SECURITY_HEADERS_AND_FALLBACK_2026-11-16.md`). The report-only CSP needs staging evidence before it is enforced.

## Next

L7.3 rate limiting (needs a Workers Rate Limiting binding added to `wrangler.jsonc` by the coordinator), then L7.4 dependency advisories and the CI audit step.

## Waiting on the owner

—
