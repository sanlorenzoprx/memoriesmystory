# Secrets and Configuration Contract

**Status:** binding readiness control
**Scope:** Phase 1 production-ready, not live

## The build-secret rule

`npm ci`, typecheck, lint, unit tests, the deterministic Playwright smoke test, the Vite build, and `wrangler deploy --dry-run` require **no live credentials**. Core verification must remain runnable without paid calls or production access.

Actual credentials never belong in Git, uploaded ZIPs, prompts, receipts, screenshots, logs, or chat. Local Worker secrets go in ignored `.dev.vars`; public Vite keys go in ignored `.env.local`; deployed runtime secrets go in the Cloudflare environment; CI deployment credentials go in GitHub Actions encrypted secrets. `.dev.vars.example` and `.env.example` declare names only.

## Inventory

| Name | Classification | Needed when | Storage |
| --- | --- | --- | --- |
| `SESSION_SECRET` | Runtime secret | Peppering opaque app-session hashes; required by Packet 4.1 | `.dev.vars`; Cloudflare Worker secret |
| `CLERK_SECRET_KEY` | Runtime secret | Clerk token verification and staging identity acceptance | `.dev.vars`; Cloudflare Worker secret |
| `STRIPE_SECRET_KEY` | Runtime secret | Creating/retrieving Stripe Checkout Sessions and server-side payment reconciliation | `.dev.vars`; Cloudflare Worker secret |
| `STRIPE_WEBHOOK_SECRET` | Runtime secret | Verifying the raw Stripe webhook payload before fulfillment | `.dev.vars`; Cloudflare Worker secret |
| `SHARE_TOKEN_PEPPER` | Runtime secret | Private share tokens are implemented | `.dev.vars`; Cloudflare Worker secret |
| `TURNSTILE_SECRET_KEY` | Runtime secret | Public/auth endpoint staging acceptance | `.dev.vars`; Cloudflare Worker secret |
| `TRANSCRIPTION_FALLBACK_API_KEY` | Conditional runtime secret | A non-Cloudflare fallback provider is selected | `.dev.vars`; Cloudflare Worker secret |
| `CLOUDFLARE_API_TOKEN` | Deployment secret | Automated staging provisioning or deployment is approved | GitHub Actions secret or operator environment; never a Worker secret |

## Non-secret configuration

These values are identifiers or public configuration. They must be environment-specific but must not be mislabeled as secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_CHAPTER_PRICE_ID`
- `STRIPE_LIFE_PRICE_ID`
- `STRIPE_FAMILY_PRICE_ID`
- `MEMORIES_PUBLIC_ORIGIN` when an explicit public origin is configured
- `CLERK_JWT_KEY` (public PEM verification key; environment-specific)
- `CLERK_AUTHORIZED_PARTIES` (comma-separated exact application origins)
- D1 database ID and name
- R2 bucket name
- Queue name
- `TURNSTILE_SITE_KEY`
- verified public origin and OAuth callback URLs
- `EMAIL_FROM`
- model IDs, prompt versions, locale defaults, size limits, retention values, and share-token lifetime

The Cloudflare runtime bindings are `DB`, `MEDIA_BUCKET`, `AI`, and `PROCESSING_QUEUE`. D1, R2, Queues, and Workers AI are accessed through bindings inside the Worker; they do not require application API keys in the Worker.

## Stripe commerce boundary

- Stripe Price IDs and the Stripe publishable key are public identifiers. They may be configured in the application environment, but the Worker remains authoritative for which Price ID, amount, currency, and entitlement correspond to `chapter`, `life`, or `family`.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are never exposed to browser code.
- A browser sends only an approved offer identifier plus a retry-safe checkout attempt identifier. It cannot choose the trusted amount or Price ID.
- Embedded Checkout loads Stripe.js directly from `https://js.stripe.com`; payment-card fields are not built or stored by Memories: My Story.
- A return/thank-you URL is navigation only. It never creates purchased access.
- Entitlement grants require Stripe payment evidence verified by the Worker, either through a valid signed webhook or direct server-side Checkout Session reconciliation.
- Webhook signature verification uses the raw request body before JSON parsing.
- Stripe events and order fulfillment are idempotent. Replays must not create duplicate entitlements.

## Provisioning gate

1. Create separate Clerk development/staging and production instances. Enable email verification and Google for the currently approved staging path; Facebook remains explicitly deferred until its product/Meta boundary is resumed.
2. Create separate Stripe sandbox/staging and production configuration. Never reuse live-mode Stripe secrets in local or staging acceptance.
3. Create separate local, staging, and production Cloudflare configuration. Secrets do not inherit between Cloudflare environments.
4. Generate distinct high-entropy `SESSION_SECRET` and `SHARE_TOKEN_PEPPER` values per environment.
5. Load Clerk and Stripe values privately with the provider, Cloudflare, and GitHub secret interfaces. Do not paste them into an agent prompt.
6. Register the staging Stripe webhook endpoint at `/api/webhooks/stripe` and store its signing secret only in the matching Cloudflare staging environment.
7. Configure the staging `VITE_STRIPE_PUBLISHABLE_KEY` at build time and the three approved Stripe Price IDs in Worker configuration.
8. Run a redacted preflight that reports only present/missing, never values.
9. Execute one real Stripe sandbox checkout from selected offer through webhook/reconciliation, entitlement, thank-you, and Living Memory creation before claiming staging acceptance.
10. Rotate any secret value that appears in Git history, output, logs, screenshots, or chat.

Production secrets are deliberately **not** created merely because the code boundary exists. Their presence before production authorization would create risk without improving build evidence.

Packet 4 identity staging uses `npm run preflight:identity:staging`. The command validates only configuration shape, prints no values, makes no network request, and exits nonzero until the Clerk paths, isolated Cloudflare resource identifiers, exact HTTPS origins, and required secrets are present in the operator environment. An explicit `CLERK_FACEBOOK_ENABLED=false` may report `deferred` for an owner-approved email-and-Google staging run, but it remains a Packet 4 and final-acceptance blocker. Passing this preflight authorizes no production action and is not live-provider evidence.

## Approved direction

- Clerk is the approved identity provider. Email and Google are the active staging paths; Facebook remains deferred by explicit product decision.
- Clerk proves identity; the D1 `users.id` owns Living Memories and survives provider or billing changes.
- Stripe Embedded Checkout is the approved payment UI. Stripe owns payment-card collection; Memories: My Story owns offer selection, account linkage, fulfillment, and entitlement state.
- Turnstile protects authentication, draft-creation, and sharing boundaries.
- Workers AI is the first transcription provider; the fallback interface remains narrow and no second provider is selected without evidence.
- English and Spanish are both acceptance-blocking.
- Staging credentials and resources are isolated from production.
