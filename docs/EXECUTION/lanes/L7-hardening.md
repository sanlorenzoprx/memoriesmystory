# L7 — Hardening and trust

**Scope:** Security headers and CSP; rate limiting and Turnstile; error fallback, dead-letter queue, invitation secret; dependency audit in CI; legal pages with placeholder text and versioned acceptance; threat model and observability; route splitting and accessibility.
**Migration numbers:** 0034–0035
**Owns:** worker/index.ts structure, worker/rate-limit.ts, public/_headers, app/features/legal/, docs/SECURITY/, app/localization/catalog/hardening.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. L7.1–L7.3 merged; L7.4 merged (PR #62, `cd865a0`).

## Merged

- L7.1 security headers and share-link headers, and L7.2 Worker error fallback — PR #57, `9211e22`.
- L7.3 rate limiting — PR #60, `94518a2`.

## Evidence level reached

L7.1–L7.2: INTEGRATION_PROVEN locally (receipt `docs/IMPLEMENTATION/SECURITY_HEADERS_AND_FALLBACK_2026-11-16.md`). The report-only CSP needs staging evidence before it is enforced.
L7.3: INTEGRATION_PROVEN (receipt `docs/IMPLEMENTATION/RATE_LIMITING_2026-11-16.md`). Thresholds need staging evidence.
L7.4: CI-gated (`npm audit --omit=dev --audit-level=high`); record in `docs/SECURITY/DEPENDENCY_ADVISORIES.md`.

## Next

Per-account cost ceilings, then the threat model. The dead-letter queue waits on L8 provisioning (see the L8 lane file).

## Waiting on the owner

—
