# Expanded First-Release Campaign Charter

## Mission

Deliver the complete expanded release in `EXPANDED_FIRST_RELEASE.md`, beginning with a simple private Living Memory that preserves a photograph and authentic voice, recovers interruptions, distinguishes testimony from Muse and supports deliberate revocable sharing. Sharing never unlocks capacity.

## Outcome boundary

The campaign ends at **production ready, not live**. The 2026-11-13 owner decision includes archival scans, Our Living Legacy, family organization/contributions, retrieval/resurfacing, export/integrity/stewardship, reviewed derivatives/distribution and paid plans, with staging, security, operations, accessibility, localization, physical-device and human evidence.

A broad public social feed remains outside scope. Production deployment, live charging, unapproved new data processors and legally operative stewardship policies require separate decisions. A larger first-release scope is not permission to invent those decisions.

## Architecture that scales

- Keep request execution stateless; never depend on one Worker process retaining memory.
- Keep the first deployable unit a modular application with explicit domain/service boundaries.
- Store structured state and durable receipts in D1 with migrations, indexes, ownership constraints, and idempotency keys.
- Store originals privately and immutably in R2; derivatives use separate keys and provenance.
- Use Queues for retryable derived processing with bounded retries, idempotent consumers, and inspectable terminal failure.
- Centralize entitlements, limits, locales, retention, model IDs, prompt versions, and feature availability.
- Version public/internal contracts before multiple consumers depend on them.
- Instrument latency, failures, queue age, storage growth, AI usage, entitlement events, and false-save prevention.
- Add Durable Objects, Workflows, Vectorize, new services, or provider frameworks only when current evidence requires their coordination or isolation properties.

## Campaign loop

For exactly one active packet: route → inspect → trace → implement → verify → receipt → learn → commit → continue. A later packet cannot hide a failed earlier gate.

## Completion authority

`DEFINITION_OF_DONE_V1.md` decides completion. Passing tests without the user outcome, real-provider staging evidence, recovery evidence, and operational handoff is insufficient.
