# Secrets and Configuration Contract

**Status:** binding readiness control
**Scope:** Phase 1 production-ready, not live

## The build-secret rule

`npm ci`, typecheck, lint, unit tests, the deterministic Playwright smoke test, the Vite build, and `wrangler deploy --dry-run` require **no live credentials**. Core verification must remain runnable without paid calls or production access.

Actual credentials never belong in Git, uploaded ZIPs, prompts, receipts, screenshots, logs, or chat. Local Worker secrets go in ignored `.dev.vars`; deployed runtime secrets go in the Cloudflare environment; CI deployment credentials go in GitHub Actions encrypted secrets. `.dev.vars.example` declares names only.

## Inventory

| Name | Classification | Needed when | Storage |
| --- | --- | --- | --- |
| `SESSION_SECRET` | Runtime secret | Signed anonymous/authenticated sessions are implemented | `.dev.vars`; Cloudflare Worker secret |
| `SHARE_TOKEN_PEPPER` | Runtime secret | Private share tokens are implemented | `.dev.vars`; Cloudflare Worker secret |
| `EMAIL_PROVIDER_API_KEY` | Runtime secret, provider name pending | Email verification/sign-in integration begins | `.dev.vars`; Cloudflare Worker secret |
| `GOOGLE_CLIENT_SECRET` | Runtime secret | Google OAuth staging acceptance | `.dev.vars`; Cloudflare Worker secret |
| `FACEBOOK_APP_SECRET` | Runtime secret | Facebook Login staging acceptance | `.dev.vars`; Cloudflare Worker secret |
| `TURNSTILE_SECRET_KEY` | Conditional runtime secret | Abuse control is approved for public/auth routes | `.dev.vars`; Cloudflare Worker secret |
| `TRANSCRIPTION_FALLBACK_API_KEY` | Conditional runtime secret | A non-Cloudflare fallback provider is selected | `.dev.vars`; Cloudflare Worker secret |
| `CLOUDFLARE_API_TOKEN` | Deployment secret | Automated staging provisioning or deployment is approved | GitHub Actions secret or operator environment; never a Worker secret |

## Non-secret configuration

These values are identifiers or public configuration. They must be environment-specific but must not be mislabeled as secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- D1 database ID and name
- R2 bucket name
- Queue name
- `GOOGLE_CLIENT_ID`
- `FACEBOOK_APP_ID`
- `TURNSTILE_SITE_KEY`
- verified public origin and OAuth callback URLs
- `EMAIL_FROM`
- model IDs, prompt versions, locale defaults, size limits, retention values, and share-token lifetime

The Cloudflare runtime bindings are `DB`, `MEDIA_BUCKET`, `AI`, and `PROCESSING_QUEUE`. D1, R2, Queues, and Workers AI are accessed through bindings inside the Worker; they do not require application API keys in the Worker.

## Provisioning gate

1. Select the email delivery/auth implementation and confirm Google/Facebook app ownership.
2. Create separate local, staging, and production configuration. Secrets do not inherit between Cloudflare environments.
3. Generate distinct high-entropy `SESSION_SECRET` and `SHARE_TOKEN_PEPPER` values per environment.
4. Load values privately with the provider, Cloudflare, and GitHub secret interfaces. Do not paste them into an agent prompt.
5. Run a redacted preflight that reports only present/missing, never values.
6. Rotate any value that appears in Git history, output, logs, screenshots, or chat.

Production secrets are deliberately **not** created during Packet 0.2. Their presence before the owning runtime exists would create risk without improving build evidence.
