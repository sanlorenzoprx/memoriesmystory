# L5 — Commerce

**Scope:** Cost metering; plans and entitlement ledger; Stripe sandbox checkout with verified webhook; guards. Checkout stays off until owner decision D1.
**Migration numbers:** 0030–0033
**Owns:** worker/billing/, app/features/plans/, app/domain/entitlement.ts, app/localization/catalog/commerce.ts

The lane updates this file in each pull request. The coordinator folds it into `docs/CURRENT_STATE.md`, `docs/EXECUTION/TASK_QUEUE.json` and `CHANGELOG.md` at merge. Lanes do not edit those three files.

## Status

In progress. L5.1 cost metering report implemented by the coordinator, CI pending.

## Merged

None yet.

## Evidence level reached

L5.1: INTEGRATION_PROVEN locally against fixtures (receipt `docs/IMPLEMENTATION/COST_METERING_2026-11-16.md`); rates not set.

## Next

L5.2 plans and entitlement ledger (D1 default: one free Living Memory, no price shown); L5.4 per-account guards. L5.3 Stripe sandbox needs O5 keys.

## Waiting on the owner

- Unit rates in `config/cost-rates.json` from current provider prices.
- D1 prices and plans; O5 Stripe sandbox keys.
