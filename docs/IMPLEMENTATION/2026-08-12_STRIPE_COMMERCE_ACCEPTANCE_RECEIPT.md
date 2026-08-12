# Stripe Commerce Three-Slice Implementation Receipt

**Date:** 2026-08-12  
**Status:** deterministic implementation complete; real Stripe sandbox acceptance pending private staging configuration  
**Production deploy:** not performed / not authorized

## Purpose

Implement the commercial path:

`offer selection → sign in → embedded Stripe Checkout → verified payment evidence → exactly-one entitlement → branded thank-you → Living Memory creation`

The implementation follows the repository-wide value-bearing rule and the customer-journey congruency contract. Stripe is a narrow payment capability; it does not own customer identity, product entitlement truth, or the Memories: My Story experience.

## Governing invariant

> A browser redirect never grants purchased access. Only verified Stripe payment evidence can create a Memories: My Story entitlement.

## Slice A — Commerce foundation

Branch: `agent/commerce-slice-a`  
Draft PR: #8 — Commerce Slice A — establish Stripe checkout foundation  
Validated head at slice completion: `66c6740a00fb8fe4aa35945d8d2ca7e829ef3513`  
GitHub Actions run: `31603623693` — PASS

Implemented:

- `migrations/0003_commerce_entitlements.sql`;
- `commerce_orders`;
- `entitlement_grants`;
- `stripe_events` replay/audit ledger;
- server-owned Chapter/Life/Family catalog;
- exact approved Stripe Price-ID mapping;
- minimal server-side Stripe Checkout Sessions client;
- `POST /api/commerce/checkout-session`;
- app-session authentication before checkout;
- browser sends only `offerId` + stable `attemptId`;
- server resolves Price ID, cents amount, currency, and entitlement;
- Stripe metadata carries `order_id`, `account_id`, and `offer_id`;
- stable order/Stripe idempotency handling;
- Embedded Checkout Session uses `ui_mode=embedded` and the matching branded return URL.

Approved non-secret Price IDs:

- Chapter: `price_1U3cMABTT872MnyPDenlV4Ae`
- Life: `price_1U3cMBBTT872MnyPnnnvXXNh`
- Family: `price_1U3cMBBTT872MnyPgcq4FgXd`

Server catalog:

| Tier | Amount | Living Memories | Voice seconds / memory | Memory Circle |
| --- | ---: | ---: | ---: | --- |
| Chapter | 24700 USD cents | 25 | 600 | no |
| Life | 74700 USD cents | 100 | 600 | yes |
| Family | 149700 USD cents | 300 | 600 | yes |

## Slice B — Money → entitlement

Branch: `agent/commerce-slice-b`  
Draft PR: #9 — Commerce Slice B — turn verified Stripe payment into entitlement  
Validated head: `3d9072ace9ad0caa3f8935749332424dd1184c54`  
GitHub Actions run: `31604206088` — PASS

Implemented:

- raw-body Stripe webhook signature verification;
- HMAC SHA-256 verification with timestamp tolerance;
- `POST /api/webhooks/stripe`;
- event ledger before processing;
- safe replay of already processed/ignored events;
- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `checkout.session.expired`;
- direct server-side Checkout Session retrieval before fulfillment;
- reconciliation of session ID, order metadata, account, offer, amount, and currency;
- payment-status check before any grant;
- exactly-one entitlement per source order;
- idempotent fulfillment callable from webhook or reconciliation;
- `GET /api/commerce/checkout-status` for lost/delayed webhook recovery using direct Stripe evidence;
- `GET /api/entitlements`;
- failed/expired checkout states do not grant access.

Deterministic integration evidence includes:

- invalid webhook signature rejected before event persistence/fulfillment;
- duplicate webhook does not create duplicate entitlement;
- completed-but-unpaid session does not grant access;
- paid server reconciliation can safely fulfill when webhook is delayed;
- asynchronous payment failure creates no entitlement.

## Slice C — Customer acceptance implementation

Branch: `agent/commerce-slice-c`  
Draft PR: #10 — Commerce Slice C — embed Stripe checkout and complete customer handoff  
Validated implementation code head before this receipt: `0bada196a23cb34880cb7df345969eee64ea8bd8`  
GitHub Actions run: `31605822368` — PASS

Implemented:

- current Stripe.js runtime loaded directly from `https://js.stripe.com/dahlia/stripe.js`;
- current Stripe `createEmbeddedCheckoutPage` API;
- Stripe script injected only when the commerce route needs real payment UI;
- route-loaded commerce CSS;
- Embedded Checkout mounted inside the existing MemoriesMyStory checkout experience;
- shared BrandShell remains the visual/navigation authority around Stripe;
- no custom card-number fields;
- card details are not stored by Memories: My Story;
- Commerce route owns its Clerk provider when Clerk is configured;
- thank-you state machine: checking / processing / completed / failed;
- arbitrary thank-you URL remains fail-closed;
- paid-success buttons appear only after server checkout status includes a real entitlement;
- `/create` reads account entitlement and changes from free-first language to purchased continuation language;
- deterministic phone E2E proves local checkout does not fake payment, arbitrary thank-you does not unlock, and a verified entitlement changes the Living Memory creation state;
- `preflight:stripe:staging` reports only redacted present/invalid-shape configuration state and makes no network request.

## Stripe API compatibility evidence

The implementation was reconciled against Stripe's current official SDK/source behavior during this slice:

- Embedded Checkout options accept either `clientSecret` or `fetchClientSecret`;
- the current method is `stripe.createEmbeddedCheckoutPage(...)`;
- the returned Embedded Checkout object supports `mount`, `unmount`, and `destroy`;
- Stripe.js must be loaded directly from `https://js.stripe.com` rather than self-hosted;
- Stripe.js v9 maps to the current `dahlia` channel.

No Stripe runtime JavaScript is vendored into the repository.

## Customer-journey congruency

The commercial flow remains one product experience:

`Landing → selected offer → Clerk sign in → matching branded checkout → embedded Stripe payment → branded thank-you → Living Memory creation → Family Archive`

The selected tier is preserved through identity and checkout. The customer is not sent back to choose the product twice.

The thank-you page is product language rather than transaction-system language, but it does not soften the security boundary: paid access is shown only after verified entitlement state exists.

## Security/configuration contract

Secrets required for real staging acceptance but intentionally absent from Git/CI:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Public, environment-specific browser configuration:

- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`

The three Stripe Price IDs are non-secret identifiers and are stored as server configuration.

No secret value was added to source, receipt, test output, or PR description.

## Deterministic CI acceptance

Slices A, B, and the implementation code head for C passed the repository CI gates, including:

- clean install;
- TypeScript app + Worker checks;
- lint;
- unit/integration tests;
- Vite production build;
- Cloudflare deployment dry-run;
- Playwright browser installation;
- phone-first end-to-end tests.

The first Slice C run stopped at TypeScript on two narrow DOM/nullability issues. Those were corrected without changing the product/payment model; the replacement run `31605822368` passed all gates.

## Real Stripe sandbox acceptance — PENDING

Deterministic mocks are not recorded as live-provider evidence.

The real sandbox acceptance requires private staging configuration and is governed by:

`docs/OPERATIONS/STRIPE_SANDBOX_ACCEPTANCE.md`

Before acceptance can be marked complete:

1. apply migration `0003` to isolated staging D1;
2. configure the Stripe sandbox secret key privately;
3. configure the exact staging webhook endpoint and its signing secret privately;
4. configure the Stripe sandbox publishable key for the staging Vite build;
5. retain the approved email/Google Clerk staging identity path;
6. run `npm run preflight:stripe:staging`;
7. deploy only to the isolated staging environment when staging deployment is explicitly authorized;
8. complete real Stripe sandbox purchases for Chapter, Life, and Family;
9. verify order, event, and entitlement rows;
10. resend a Stripe event and prove entitlement idempotency;
11. verify thank-you → `/create` uses the purchased tier;
12. record the accepted staging receipts without secret values.

Until those steps run, the correct status is:

**Commerce implementation complete; real Stripe sandbox acceptance pending.**

## Explicit exclusions

- no live-mode Stripe charge;
- no production deployment;
- no production secrets;
- no fake card form;
- no entitlement from redirect/query parameters;
- no claim that a mocked provider test equals live Stripe acceptance.

## Known unrelated debt retained

`npm ci` continues to report the previously known dependency audit findings. No blind `npm audit fix` was run as part of commerce work.
