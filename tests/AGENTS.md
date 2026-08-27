# Verification Task Guide

These instructions apply to `tests/`.

## Read before writing acceptance evidence

1. `../docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`
2. `../docs/FOUNDATION/03_USER_EXPERIENCE.md`
3. `../docs/PRODUCT/FOUNDATION_TRACEABILITY.md`
4. `../docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`
5. The production code and packet receipt being verified.

## Evidence layers

- `unit/`: pure domain rules, configuration, copy locks, and state transitions.
- `integration/`: route, Worker, D1, R2, Queue, retry, and idempotency boundaries.
- `e2e/`: the complete phone-first first-five-minute outcome and its recovery paths.
- `fixtures/`: intentionally synthetic media and records with documented purpose.

Tests must prove user and preservation outcomes, not implementation trivia. Include failure and recovery evidence for every durable transition. Never use production family media as a fixture.
