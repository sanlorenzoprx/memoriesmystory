# Phase 1 Production-Ready Campaign Charter

## Mission

Deliver one complete solo Memory Story that preserves a photograph and the storyteller's real voice, survives interruption, distinguishes testimony from generated help, confirms durability truthfully, and supports a deliberate private share that unlocks the next story exactly once.

## Outcome boundary

The campaign ends at **production ready, not live**. It implements Packets 1–8 from the Phase 1 specification and produces staging, security, operations, accessibility, localization, real-device, and invariant evidence.

It does not implement Memory Circles, albums beyond future-safe associations, a public feed, billing, video reels, semantic archive search, or other deferred phases.

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
