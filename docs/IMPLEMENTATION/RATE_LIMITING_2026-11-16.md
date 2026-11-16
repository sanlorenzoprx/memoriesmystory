# Request-rate limiting (L7.3, review finding F3)

**Result:** PARTIAL — implemented and locally proven; CI and staging evidence pending.
**Base:** `main` after PR #59.
**Authority:** V1 launch handoff §2 group F (hardening), lane L7.

## Outcome

Routes that someone can reach without an account, and routes that spend model or call budget, can no longer be hammered without limit. An over-limit request gets `429` with the stable code `rate_limited`, `Retry-After: 60` and no cached body. The client already shows "Please wait a moment before trying again." in English and Spanish.

## Promises protected

- **Preservation first:** if a limiter binding is missing or fails, the request goes through. A counter outage must never stop someone from saving a memory. Truthful save is unchanged: a refused write is never shown as saved.
- **Privacy:** the client address is used only as the counter key, in memory at Cloudflare. It is never stored or logged by the app.
- **Ordinary families are not limited:** the thresholds sit far above one household's activity in a minute. Reading one's own archive is never counted.

## Change

- `worker/rate-limit.ts` sorts each request into one of three classes and enforces that class's limit:

  | Class | Routes | Limit per address |
  | --- | --- | --- |
  | `public` | share pages and their media, sign-in session, `/mcp`, `/api/v1/*` | 120 a minute |
  | `costly` | state-changing Muse, Muse speech, Muse conversation, voice replies, transcription processing, scans, shared-conversation calls | 30 a minute |
  | `writes` | every other state-changing `/resources/` request | 300 a minute |

- `worker/index.ts` applies the limit before any route runs, and `Env` gains the three optional bindings.
- `wrangler.jsonc` declares `REQUEST_LIMIT_PUBLIC` (namespace 4101), `REQUEST_LIMIT_COSTLY` (4102) and `REQUEST_LIMIT_WRITES` (4103). Periods are 60 seconds. Limits are approximate and apply per Cloudflare location.

## Evidence

| Check | Result |
| --- | --- |
| Unit `tests/unit/rate-limit.test.ts` | 5 pass: classification; 429 shape and per-class, per-address keys; fail-open on a missing or failing limiter; applied before routing; bindings declared with valid periods |
| `npm run verify:core` | Pass — 298 tests in 69 files; the deploy dry run lists all three Rate Limit bindings |
| Full phone-viewport suite locally, with the limiters live in local dev | 73 pass, none limited; 9 not run (sandbox-only `legacy-recording.spec.ts`) |
| Staging | NOT_RUN — confirm thresholds against real traffic before launch |

## Not done here

- Turnstile on unauthenticated forms. There is no public form yet; add it with the first one.
- Per-account cost ceilings (a later L7 packet).

**Reversible:** yes (remove the bindings, or raise the limits). **Migration:** none. **Production deployed:** no.
