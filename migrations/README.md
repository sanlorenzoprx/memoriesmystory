# D1 Migrations

Use ordered, reversible-where-possible D1 migrations. Schema decisions must preserve original assets, attribution, truth states, revision history, exportability, ownership, and paid-entitlement auditability.

- `0001_phase_1_foundation.sql` establishes the Phase 1 ownership, draft, story, media, transcript, generated-artifact, fact, entitlement, sharing, agreement, idempotency-receipt, and event contracts. Original asset identity and transcript revisions are protected by database triggers in addition to application-domain rules.
- `0002_account_binding_recovery.sql` establishes Clerk/account binding, recoverable ownership claims, billing-customer linkage, and account-session recovery contracts.
- `0003_commerce_entitlements.sql` establishes Stripe-backed commerce orders, exactly-one paid entitlement grants per source order, and the Stripe event replay/audit ledger. Browser redirects never write grants directly.

Run the disposable local schema verification with:

```bash
npm run test:schema
```

The zero D1 ID in `wrangler.jsonc` is intentionally non-deployable. An authorized staging configuration must replace it with the provisioned staging database ID before applying migrations outside the local test environment.
