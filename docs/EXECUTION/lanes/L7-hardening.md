# L7 — Hardening and trust

**Scope:** Security headers and CSP; rate limiting and Turnstile; error fallback, dead-letter queue, invitation secret; dependency audit in CI; legal pages with placeholder text and versioned acceptance; threat model and observability; route splitting and accessibility.
**Migration numbers:** 0034–0035
**Owns:** worker/index.ts structure, worker/rate-limit.ts, public/_headers, app/features/legal/, docs/SECURITY/, app/localization/catalog/hardening.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. L7.1–L7.3 merged.

## Merged

- L7.1 security headers and share-link headers, and L7.2 Worker error fallback — PR #57, `9211e22`.
- L7.3 rate limiting — PR #60, `94518a2`.

## Evidence level reached

L7.1–L7.2: INTEGRATION_PROVEN locally (receipt `docs/IMPLEMENTATION/SECURITY_HEADERS_AND_FALLBACK_2026-11-16.md`). The report-only CSP needs staging evidence before it is enforced.
L7.3: INTEGRATION_PROVEN (receipt `docs/IMPLEMENTATION/RATE_LIMITING_2026-11-16.md`). Thresholds need staging evidence.

## Next

L7.4 dependency advisories and the CI audit step; then the dead-letter queue and per-account cost ceilings.

## Waiting on the owner

—
