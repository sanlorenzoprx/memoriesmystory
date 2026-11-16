# L7.1–L7.2 — Security headers, bearer-link headers and a Worker error fallback

**Result:** implemented and locally proven; CI and staging pending.
**Base:** `main` `38031c57511ba12a2167183685023f02d5f3f881` (PR #56).
**Lane:** L7 hardening. Review findings F2 and F9 (`REPO_AND_HANDOFF_REVIEW_2026-11-15.md`).

## Change

- **`public/_headers` (F2).** The application shell and every static file now carry `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, a `Permissions-Policy` that allows only camera and microphone from this site, `Cross-Origin-Opener-Policy: same-origin-allow-popups` (Clerk sign-in pop-ups), and a **report-only** Content-Security-Policy. The policy stays report-only until staging shows every Clerk, Turnstile and RealtimeKit origin it must allow; enforcing it now could break sign-in or calls.
- **Share links (F2).** The public share page, its photograph and voice, and the "link unavailable" page now send `X-Robots-Tag: noindex, nofollow, noarchive` and `Referrer-Policy: no-referrer`, because a share address is a bearer secret.
- **Error fallback (F9).** `worker/index.ts` wraps the whole route chain. An unexpected throw returns `503` with `{ "error": { "code": "unavailable" } }`, `Cache-Control: private, no-store` and nothing else — no message or stack. The code maps to the existing "Something went wrong. Please try again." copy through the hardening catalog.

## Evidence

| Check | Result |
| --- | --- |
| Local Worker (`wrangler dev`) | Headers present on `/`, `/archive` (app shell for a deep link) and `/favicon.svg`; Worker responses (`/health`, `/resources/…`) keep their own headers |
| Unit tests | `security-headers.test.ts`: required lines present, CSP still report-only, unexpected throw gives the stable 503 with no private text |
| Worker test | Share page, share voice and the unavailable page carry `noindex` and `no-referrer` |
| `npm run verify:core` | Pass — typecheck, lint, 286 tests in 67 files, 117 schema objects, build, deploy dry run |
| Phone-viewport suite locally | 69 pass; 9 not run (the `legacy-recording.spec.ts` checks cannot launch in this sandbox) |
| Staging | NOT_RUN — real browsers on the deployed site must confirm no CSP report blocks sign-in, capture or calls before the policy is enforced |

## Not done in this slice (still lane L7)

Rate limiting (F3), dependency advisories (F7), dead-letter queue (F10), invitation secret (F11), legal pages, threat model, observability, route splitting and accessibility review.

**Reversible:** yes. No migration. **Production deployed:** no.
