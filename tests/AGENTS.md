# Verification Task Guide

These instructions apply to `tests/`.

## Read before writing acceptance evidence

1. `../docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`
2. `../docs/FOUNDATION/03_USER_EXPERIENCE.md`
3. `../docs/PRODUCT/FOUNDATION_TRACEABILITY.md`
4. `../docs/IMPLEMENTATION/PHASE_1_SOLO_MEMORY_STORY_BUILD_SPEC.md`
5. `../docs/ENGINEERING/KNOWN_OUTCOME_ENGINEERING_V1.md`
6. `../config/known-outcome-engineering.v1.json`
7. The production code and packet receipt being verified.

## Evidence layers

- `unit/`: pure domain rules, configuration, copy locks, and state transitions.
- `integration/`: route, Worker, D1, R2, Queue, retry, idempotency, ownership, and recovery boundaries. Prefer platform-native local runtime semantics over handwritten Cloudflare emulators.
- `e2e/`: the complete phone-first first-five-minute outcome and its recovery paths.
- `fixtures/`: intentionally synthetic media and records with documented purpose.

External providers such as Clerk, Stripe, AI/transcription, and email are deterministic contract boundaries in ordinary CI unless a live acceptance gate is explicitly authorized.

## Known-outcome test rule

Before creating a new mock, wrapper, emulator, helper runtime, or fixture system:

1. inspect existing verified test capabilities;
2. identify who owns the behavior being tested;
3. use the real local runtime/tool when practical;
4. isolate only the genuinely external boundary;
5. classify any remaining new test mechanism under the Novelty Budget.

`NOVEL`, `WORKAROUND`, and `TEST_FAULT` require evidence. A handwritten platform emulator is not the default proof of platform semantics.

Normal integration fixtures must derive owner, draft, memory, photo, voice, and preservation identities from one canonical scenario. Mix identities only in explicitly adversarial tests.

Tests must prove user and preservation outcomes, not implementation trivia. Include failure and recovery evidence for every durable transition. Never use production family media as a fixture.

Resource-heavy browser/runtime suites may run in isolated or sequential lanes. Do not weaken preservation, accessibility, ownership, or recovery assertions merely to fit a parallel test pool.
