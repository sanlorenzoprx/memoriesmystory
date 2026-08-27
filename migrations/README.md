# D1 Migrations

Use ordered, reversible-where-possible D1 migrations. Schema decisions must preserve original assets, attribution, truth states, revision history, and exportability.

`0001_phase_1_foundation.sql` establishes the Phase 1 ownership, draft, story, media, transcript, generated-artifact, fact, entitlement, sharing, agreement, idempotency-receipt, and event contracts. Original asset identity and transcript revisions are protected by database triggers in addition to application-domain rules.

Run the disposable local schema verification with:

```bash
npm run test:schema
```

The zero D1 ID in `wrangler.jsonc` is intentionally non-deployable. An authorized staging configuration must replace it with the provisioned staging database ID.
