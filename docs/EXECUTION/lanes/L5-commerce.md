# L5 — Commerce

**Scope:** Cost metering; plans and entitlement ledger; Stripe sandbox checkout with verified webhook; guards. Checkout stays off until owner decision D1.
**Migration numbers:** 0030–0033
**Owns:** worker/billing/, app/features/plans/, app/domain/entitlement.ts, app/localization/catalog/commerce.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. L5.1 merged; L5.2 plans and entitlement ledger implemented by the coordinator, CI pending.

## Merged

- L5.1 cost metering report — PR #68, `920727e`.

## Evidence level reached

L5.1: INTEGRATION_PROVEN against fixtures (receipt `docs/IMPLEMENTATION/COST_METERING_2026-11-16.md`); rates not set.
L5.2: INTEGRATION_PROVEN locally (receipt `docs/IMPLEMENTATION/ENTITLEMENT_LEDGER_2026-11-16.md`); migration 0030.

## Next

L5.4 per-account and per-operation ceilings. L5.3 Stripe sandbox needs O5 keys.

## Waiting on the owner

- Unit rates in `config/cost-rates.json` from current provider prices.
- D1 prices and plans, including the deletion policy (does deleting a completed memory return its capacity?); O5 Stripe sandbox keys.
