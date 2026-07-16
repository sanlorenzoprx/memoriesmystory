# Packet 4.1 — Clerk Identity, Anonymous-Draft Ownership and Cross-Device Recovery

**Date:** 2026-07-16  
**Branch:** `packet-4/account-binding-recovery`  
**Application:** `memoriesmystory`  
**Status:** local implementation complete; live-provider staging evidence pending

## User outcome delivered

Only after a photograph and its real voice are durably preserved, a person can sign in and protect that exact pair in a private account archive. An interrupted or abandoned sign-in leaves the recoverable local draft untouched. After a successful claim, the same Clerk identity can open a new session on another phone, tablet, or computer and recover the original photograph and voice without changing either asset identity.

The experience remains honest: it does not call the draft a completed Memory Story, does not show the locked Packet 6 completion sentence, and does not claim that live email, Google, or Facebook sign-in has passed until staging evidence exists.

## Delivered

### Provider-independent ownership

- Clerk verifies the external person; D1 `users.id` remains the stable data owner.
- `auth_principals` maps the Clerk issuer and subject to the internal user ID.
- Email, Google, and Facebook remain centrally declared supported methods and are configured in Clerk, not embedded as separate Worker integrations.
- `billing_customer_links` reserves a provider-neutral Stripe customer mapping without activating billing or adding Stripe runtime code.

### Server-verified application sessions

- A Clerk session JWT is exchanged at the Worker boundary after server verification.
- The browser receives a high-entropy opaque, `HttpOnly`, `Secure`, `SameSite=Lax` app-session cookie.
- D1 stores only a `SESSION_SECRET`-peppered SHA-256 token hash.
- Protected archive and media requests resolve and verify the app session server-side.
- Sign-out revokes the D1 session and expires the cookie.
- Exact authorized origins can be restricted through `CLERK_AUTHORIZED_PARTIES`.

### Transactional anonymous-draft promotion

- Claim requires the signed-in app session, anonymous draft token, same-origin/custom-header CSRF evidence, current agreement version, and two independently durable original roles.
- One D1 batch binds the draft, revokes the anonymous hash, attributes the existing assets, inserts an immutable ownership receipt, records the versioned ownership agreement, and creates the free entitlement row.
- The photo and voice asset IDs, hashes, R2 keys, and objects are unchanged.
- Repeating the same claim returns the original outcome; a different account receives a conflict.
- The database trigger refuses an ownership receipt unless the draft owner already matches, preventing partial or fabricated promotion evidence.

### Cross-device archive recovery

- Account-scoped archive routes list and open only drafts owned by the current internal user.
- Existing private media routes accept either the pre-claim anonymous credential or the matching signed-in account session, never an unrelated session.
- The archive UI retrieves the preserved photograph and voice from their existing private Worker media URLs.
- The durable capture screen offers one next action: **Protect this Memory Story**.
- If Clerk is not configured in a local build, the UI does not create a fake identity or make a false recovery claim.

## Secret and configuration handoff

No secret value is committed. Names and placement are declared in `.dev.vars.example`, `.env.example`, and the binding security contract.

| Name | Kind | Required for |
| --- | --- | --- |
| `SESSION_SECRET` | Worker secret, 32+ random characters | Opaque app sessions |
| `CLERK_SECRET_KEY` | Worker secret | Clerk JWT verification in staging/runtime |
| `CLERK_JWT_KEY` | Optional environment-specific public PEM | Networkless Clerk JWT verification |
| `CLERK_AUTHORIZED_PARTIES` | Non-secret exact-origin list | Token origin restriction |
| `VITE_CLERK_PUBLISHABLE_KEY` | Public Vite configuration | Rendering the Clerk sign-in UI |

Later-packet secrets such as `SHARE_TOKEN_PEPPER`, Turnstile, and transcription fallback remain declared but are not pulled into Packet 4.1. Cloudflare D1 and R2 continue to use bindings rather than application API keys.

## Product Invariant evidence

| Invariant | Packet 4.1 evidence |
| --- | --- |
| I-06 Immutable originals | Promotion changes ownership references only; original identities and storage keys are unchanged. |
| I-07 Additive history | Immutable claim and versioned agreement receipts preserve attribution. |
| I-08 Saved means durable | The claim endpoint rejects any draft without durable photo and audio evidence. |
| I-13 Recoverable guidance | Sign-in begins after durability; local IndexedDB state survives interruption or provider failure. |
| I-16 Privacy | Archive reads, status, and private media are checked against the server-side account session. |
| I-20 Versioned agreements | Promotion records the centrally configured account-ownership agreement version. |
| I-23 Ownership integrity | Clerk and future Stripe references attach to a stable internal owner rather than becoming ownership themselves. |

## Deterministic verification

- TypeScript client and Worker type checks: passed.
- ESLint: passed.
- Vitest: passed, 11 files and 43 tests.
- D1 schema verification: passed, including the account-principal, immutable-claim, and billing-link objects.
- Vite/Worker build: passed without live credentials.
- Wrangler deployment dry run: passed and recognized `DB`, private `MEDIA_BUCKET`, and static assets; no Cloudflare resource was contacted or deployed.
- Playwright discovery: passed, 8 existing phone-Chromium paths found.
- Full local browser startup in this sandbox remains subject to the already recorded Wrangler/proxy non-termination behavior; GitHub CI remains the authoritative connected-browser gate.

## Acceptance still required in authorized staging

- Configure an isolated Clerk staging instance and exact staging origin.
- Enable and exercise email verification, Google, and Facebook on separate test identities.
- Verify callback/redirect URLs, account linking behavior, sign-out/revocation, CSRF rejection, interrupted sign-in resume, and a physical second-device continuation.
- Run a redacted configuration preflight that reports only present/missing.
- Apply migrations to staging D1 and verify private staging R2 reads.

These live steps are not replaced by mocked verifier tests. Production remains neither configured nor deployed.

## Next bounded task

Packet 4.2 is the authorized staging acceptance slice when credentials and staging resources are supplied privately. Until then, the scalable local implementation is ready for review and CI publication; Packet 5 must not infer that live-provider acceptance passed.
