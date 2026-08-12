# Stripe Sandbox Acceptance

**Status:** required live-provider acceptance gate
**Scope:** Chapter / Life / Family one-time purchases
**Production:** not authorized by this runbook

This runbook proves the complete customer and fulfillment path against Stripe sandbox infrastructure. Deterministic CI mocks Stripe at the server boundary; those tests do **not** substitute for this acceptance run.

## Governing invariant

> A browser redirect never grants purchased access. Only verified Stripe payment evidence can create a Memories: My Story entitlement.

## Private prerequisites

Configure these outside Git and outside chat:

- `STRIPE_SECRET_KEY` — Stripe sandbox secret key (`sk_test_...`)
- `STRIPE_WEBHOOK_SECRET` — signing secret for the exact staging webhook endpoint (`whsec_...`)
- `VITE_STRIPE_PUBLISHABLE_KEY` — Stripe sandbox publishable key (`pk_test_...`)
- `SESSION_SECRET`
- `VITE_CLERK_PUBLISHABLE_KEY`
- the existing Clerk server-side staging configuration
- `MEMORIES_STAGING_ORIGIN` — isolated HTTPS staging origin

The approved non-secret Stripe Price IDs are:

- Chapter: `price_1U3cMABTT872MnyPDenlV4Ae`
- Life: `price_1U3cMBBTT872MnyPnnnvXXNh`
- Family: `price_1U3cMBBTT872MnyPgcq4FgXd`

Run the redacted check before any live-provider acceptance:

```powershell
npm run preflight:stripe:staging
```

The command reports only present/invalid-shape state. It makes no network request and prints no secret values.

## Staging infrastructure

Before checkout acceptance:

1. Apply D1 migration `0003_commerce_entitlements.sql` to the isolated staging database.
2. Deploy the exact accepted branch to the isolated HTTPS staging Worker/application only after staging deployment is explicitly authorized.
3. Configure the Worker secrets privately.
4. Build the browser application with the staging Clerk and Stripe publishable keys.
5. In Stripe sandbox, register this exact endpoint:

   `/api/webhooks/stripe`

6. Subscribe to at least:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
7. Store the signing secret for that endpoint as the staging `STRIPE_WEBHOOK_SECRET`.

## Primary Chapter acceptance

Use a clean staging customer/account and perform the same path a real customer sees:

1. Open the Memories: My Story landing page.
2. Select **Chapter — $247**.
3. Sign in through the approved staging identity path.
4. Confirm the browser returns to `/checkout/chapter` without asking the customer to select Chapter again.
5. Confirm the page retains the Memories: My Story header, logo, typography, spacing, offer summary, and trust language.
6. Confirm Stripe Embedded Checkout appears inside the branded checkout page.
7. Confirm the visible total is **$247 one-time**.
8. Complete a Stripe sandbox payment using Stripe's current documented test-payment data.
9. Confirm the customer returns to `/thank-you/chapter?session_id=...`.
10. Confirm the thank-you page does not rely on the URL alone and reaches the **completed** state only after `/api/commerce/checkout-status` confirms fulfillment.
11. Confirm the page says **Chapter is ready** and offers **Create a Living Memory** and **Open My Family Archive**.
12. Select **Create a Living Memory**.
13. Confirm `/create` says **Your Chapter is ready** and **Start the next Living Memory.**
14. Confirm capture/import remains functional and visually congruent with the rest of the journey.

## Server evidence

For the accepted Chapter purchase, verify in the isolated staging D1 database:

### `commerce_orders`

Exactly one matching order exists and has:

- `offer_id = 'chapter'`
- `amount_total = 24700`
- `currency = 'usd'`
- non-null `stripe_checkout_session_id`
- non-null Stripe payment/customer references where Stripe supplied them
- `status = 'fulfilled'`
- non-null `paid_at`
- non-null `fulfilled_at`

### `entitlement_grants`

Exactly one grant exists for the source order:

- `offer_id = 'chapter'`
- `living_memory_limit = 25`
- `voice_seconds_per_memory = 600`
- `memory_circle_enabled = 0`
- `family_archive_level = 'chapter'`
- `revoked_at IS NULL`

### `stripe_events`

The corresponding payment event is present with:

- the exact Stripe event ID
- expected event type
- `processing_status = 'processed'`
- non-null `processed_at`
- no processing error

## Idempotency acceptance

Use Stripe sandbox's event resend capability to redeliver the accepted payment event.

Acceptance requires:

- HTTP success from the webhook endpoint;
- no second `commerce_orders` row;
- no second `entitlement_grants` row for the source order;
- the existing entitlement remains unchanged;
- the customer still sees one effective Chapter entitlement.

## Fail-closed acceptance

Also prove at least these cases:

1. Open `/thank-you/chapter` without a valid Checkout Session: no paid access is granted.
2. Use an expired or failed sandbox Checkout Session: no entitlement is granted.
3. Attempt to send an arbitrary browser amount or Price ID to the checkout endpoint: the Worker still uses the server-owned Chapter catalog.
4. Send a webhook with an invalid signature in a controlled staging test: the event is rejected before fulfillment.
5. Retry the same checkout attempt after an interrupted client request: the existing order/Checkout Session is resumed rather than creating a duplicate purchase.

## Life and Family acceptance

After Chapter passes, run one successful sandbox purchase for each tier and verify the tier-specific entitlement:

| Tier | Amount | Living Memories | Voice seconds / memory | Memory Circle |
| --- | ---: | ---: | ---: | --- |
| Life | $747 | 100 | 600 | enabled |
| Family | $1,497 | 300 | 600 | enabled |

The checkout page, thank-you page, and `/create` must display the selected tier consistently throughout the journey.

## Completion record

Do not mark Stripe commerce as live-provider accepted until the implementation receipt records:

- accepted commit SHA;
- staging origin;
- Stripe mode = sandbox/test;
- D1 migration applied;
- Chapter/Life/Family acceptance results;
- webhook event IDs or redacted references sufficient for audit without exposing secrets;
- idempotency replay result;
- customer-journey screenshots/receipts if stored privately;
- confirmation that no production deployment or live-mode charge occurred.
