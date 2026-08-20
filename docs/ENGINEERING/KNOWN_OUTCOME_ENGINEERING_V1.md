# Memories: My Story Known-Outcome Engineering v1

Status: repository engineering method for future implementation and verification work.

## Relationship to product authority

This source governs **how engineering work is resolved and tested**. It does not override Foundation documents, Product Invariants, the first-five-minute experience, privacy rules, preservation rules, or implementation specifications.

No code, architecture, or product behavior is inherited from another repository. This method adopts a general engineering discipline: resolve new work against verified building blocks before inventing new ones, then adapt that discipline to Memories: My Story's own product and technical contracts.

Permanent rule:

> Reuse the known. Verify the adaptation. Isolate the novelty. Measure the outcome. Preserve what works.

## Known-Outcome Resolution Ladder

Before significant new code is created, resolve the requested outcome in this order:

1. Verified capability already present in Memories: My Story.
2. Proven implementation already present in this repository, including recovery paths, migrations, Worker handlers, domain logic, fixtures, and receipts.
3. Platform-native or vendor-native mechanism compatible with the current architecture.
4. Proven open-source or official reference implementation compatible with the stack.
5. Applicable standard or protocol.
6. Adapt or compose known mechanisms.
7. Declare the exact unresolved surface.
8. Build only that unresolved surface.
9. Verify against the real behavior owner wherever practical.
10. Preserve the verified result as a reusable capability, fixture, receipt, or documented decision.

`UNKNOWN_REQUIRES_EVIDENCE` is valid. Failure to search is not evidence that new architecture is required.

## Novelty Budget

Every material implementation slice must classify the work:

- `REUSE`
- `ADAPT`
- `COMPOSE`
- `ADAPTER`
- `NOVEL`
- `WORKAROUND`
- `TEST_FAULT`

Default to `REUSE`, `ADAPT`, `COMPOSE`, or `ADAPTER`.

`NOVEL`, `WORKAROUND`, and `TEST_FAULT` require evidence that internal capabilities, existing repository implementations, platform/vendor-native mechanisms, official/open-source references, standards, and composition options were checked first.

## Missing Layer Declaration

Before Builder work starts on a material change, record:

- required user/system outcome;
- governing Foundation/Product/Implementation sources;
- verified internal capabilities inspected;
- existing repository implementations inspected;
- platform/vendor mechanisms inspected;
- official/open-source/standard mechanisms inspected when material;
- candidate composition;
- exact unresolved surface;
- novelty classification;
- chosen test layer;
- measurable stop condition;
- preservation/recovery implications.

The unresolved surface is the maximum scope Builder may invent without a new product/architecture decision.

## Canonical scenario identity

Related records in normal tests derive from one canonical scenario. Do not mix owner IDs, draft IDs, memory IDs, photo keys, voice keys, or preservation receipts from unrelated fixtures unless the test is explicitly adversarial.

Typical lineage:

`anonymous_draft_id -> capture_session_id -> owner_id -> memory_id -> original_photo_asset_id -> original_voice_asset_id -> preservation_receipt -> share/recovery identity`

Original human media remains canonical and immutable throughout the scenario.

## Test building blocks

Choose the lowest layer that can prove the outcome without recreating behavior owned by another runtime or service.

### A. Pure deterministic

Use for domain rules, product invariants, entitlement math, state transitions, truth labels, configuration, serialization independent of platform behavior, and copy locks.

### B. Platform-native local runtime

For Cloudflare-owned semantics, prefer the supported local Workers runtime and real local bindings over handwritten D1/R2/KV/Queue emulators. Real migrations should create test schema state. A fake platform is not the default proof of the platform.

### C. Production Worker/application integration

Exercise production Worker handlers, route boundaries, durable transitions, upload/commit paths, retry/idempotency behavior, and cross-device ownership/recovery through production entrypoints with deterministic local inputs.

### D. External-provider contract

Clerk, Stripe, AI/transcription providers, email, and other external services remain isolated at their boundary in ordinary CI. Use deterministic fixtures/contracts unless a live acceptance gate is explicitly authorized.

### E. End-to-end phone-first acceptance

Use Playwright and the built application/Worker path to prove the first-five-minute outcome, accessibility, local-first recovery, cross-device continuation, and truthful saved/preserved states. Resource-heavy browser suites may run separately instead of weakening assertions.

### F. Live acceptance

Real production/staging identity, billing, email, provider billing, or customer-data mutations require explicit authorization and receipts. Passing unit/integration tests does not replace a required live acceptance gate.

## Preservation-specific verification rules

Every durable transition must prove both success and recovery:

- photo selected/captured;
- voice recorded;
- local draft established;
- upload started/retried;
- durable object committed;
- canonical record linked to the correct owner;
- original media remains unchanged;
- recovery after interruption returns to the same human memory rather than creating a second identity;
- UI says "saved" or "preserved" only after the durability condition defined by product sources is true.

AI-generated material must remain distinguishable from human testimony.

## Finite resumable missions

Large corrections use a bounded mission:

`freeze exact parent -> verify governing sources -> classify tests/capabilities -> introduce known building block -> migrate highest-risk user path first -> verify -> checkpoint -> repeat -> full validation -> product/commercial stop`

Every stage ends in exactly one of:

- `PASS`
- `KNOWN_REPAIR`
- `BLOCKED_UNKNOWN`
- `EXTERNAL_ACCEPTANCE_REQUIRED`

Known repairs may continue automatically only when the repair recipe is deterministic and bounded. Unknown conditions stop fail-closed with evidence.

## Memories test-runtime migration sequence

When authorized, use this bounded order rather than rewriting the test suite:

1. Freeze exact parent commit and verify Foundation/Product/Implementation sources.
2. Classify existing tests as pure, Cloudflare runtime, production integration, external-provider contract, browser acceptance, or deliberate failure injection.
3. Add Workers-native local runtime testing alongside existing tests.
4. Apply the repository's real D1 migrations in runtime tests.
5. Migrate the highest-risk preservation/ownership path first: anonymous draft -> account binding -> memory ownership -> durable persistence/recovery.
6. Migrate R2 original-photo/original-voice persistence semantics.
7. Migrate KV/Queue semantics only where they are actually used by production code.
8. Exercise the production Worker build/entrypoints rather than test-only wrappers.
9. Keep Clerk/Stripe/AI/email behavior at deterministic provider-contract boundaries.
10. Add a CI guard against new handwritten Cloudflare platform emulators except explicit failure injection.
11. Retain old tests only when they still prove unique business/recovery behavior.
12. Run typecheck, lint, unit, schema, build, Worker dry-run, and phone-first E2E validation.
13. Stop infrastructure work when the first-five-minute and recovery paths are trustworthy.
14. Move to explicitly authorized staging/customer acceptance rather than another architecture phase.

## Product stop rule

Infrastructure is subordinate to the Living Memory outcome.

Once a real user can reliably:

1. capture/import a photograph;
2. tell the memory in their authentic voice;
3. survive interruption/offline conditions;
4. bind/recover ownership across devices;
5. receive truthful preservation confirmation;
6. revisit the same preserved memory;

stop infrastructure expansion and return to real-user experience, preservation quality, sharing/retelling, retention, and willingness-to-pay evidence.

Do not continue architecture merely because more abstraction is possible.

## Required receipts

Material slices preserve:

- parent commit/source identity;
- governing source versions;
- canonical scenario identity;
- novelty classification;
- test layer;
- tests executed;
- durable object/record IDs or hashes where appropriate without exposing private family data;
- failure/recovery evidence;
- checkpoint commit;
- stop reason.

Never use real family media as a test fixture.

## Future-agent startup rule

For material engineering work, read this source after `AGENTS.md`, `README.md`, and `docs/00_START_HERE.md`, plus the task-specific Foundation/Product/Implementation sources. Then inspect the current code/tests/receipt and resolve the work through the Known-Outcome Resolution Ladder before creating new architecture.
