# Cloudflare Runtime Task Guide

These instructions apply to `worker/`. Isolated consumers or coordination code under `workers/` follows the same rules.

## Read before changing runtime behavior

1. `../docs/FOUNDATION/04_TECHNICAL_PRINCIPLES.md`
2. `../docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`
3. `../docs/ARCHITECTURE/FOUNDATION_STACK.md`
4. `../docs/ARCHITECTURE/APP_IDENTITY.md`
5. `../docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`
6. `../wrangler.jsonc` and the related integration tests.

## Runtime boundaries

- React Router loaders, actions, and resource routes own Phase 1 request coordination.
- D1 holds records and state; private R2 holds original media; Queue handles derived processing.
- Client state is never sufficient proof of durable completion.
- Every mutating transition is idempotent and recoverable.
- Originals remain private and immutable; generated derivatives are separate and attributable.
- Add Durable Objects, Workflows, Vectorize, or new framework layers only when current evidence requires them and a decision records why.

## Verification

Validate binding names, local types, idempotency, failure states, private media behavior, and dry-run deployment configuration. Never deploy as an incidental validation step.
