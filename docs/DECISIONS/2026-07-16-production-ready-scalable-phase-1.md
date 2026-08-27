# Production-Ready, Scalable Phase 1 Campaign

**Status:** accepted
**Date:** 2026-07-16

## Context

The fresh repository has an approved Foundation, Phase 1 specification, first-screen implementation, test scaffold, secret contract, and production-ready-not-live Definition of Done. A continuous build campaign now needs an explicit scope, authority boundary, and architecture posture.

## Decision

Build the Phase 1 solo Memory Story to production-ready evidence without deploying to production or launching publicly.

The campaign includes:

- the complete first-five-minute solo Memory Story outcome;
- English and Spanish as acceptance-blocking languages;
- email, Google, and Facebook account paths by final acceptance;
- an isolated Cloudflare staging Worker, D1 database, private R2 bucket, Queue, Workers AI binding, and Turnstile protection;
- Workers AI as the initial transcription provider with a narrow fallback boundary but no speculative second provider;
- separate owner approval for production deployment, public launch, DNS changes, billing activation, or irreversible data action.

Architecture must be designed to scale. Scale means stable domain contracts, stateless request handling, immutable media, idempotent mutations, durable queues, indexed and migratable data, environment isolation, centralized configuration, measurable operations, and replaceable boundaries where a real replacement is expected.

Scale does not authorize premature microservices, duplicated data stores, a broad provider registry, Durable Objects without live coordination, Workflows without queue evidence, or abstractions that do not protect a current product invariant.

## Alternatives considered

- Build the full future product in one campaign: rejected because it would outrun the solo Memory Story proof and Foundation build order.
- Optimize only for a local demonstration: rejected because it would not prove durability, privacy, recovery, or operations.
- Split Phase 1 into multiple services immediately: rejected until load, isolation, or coordination evidence justifies the operational cost.

## Affected Product Invariants

I-01, I-02, I-04, I-06, I-07, I-08, I-11, I-12, I-14, I-15, I-16, I-18, I-20, and I-24.

## Evidence required

The evidence is defined by `../EXECUTION/DEFINITION_OF_DONE_V1.md`, `../EXECUTION/PHASE_GATES.md`, and the Phase 1 invariant release matrix.

## Consequences and follow-up

- Only the canonical `memoriesmystory` repository is build input.
- Staging may be provisioned after private credentials pass a redacted preflight.
- The email/auth implementation receives a focused provider decision before Packet 4.
- Production remains closed after Phase 1 readiness is proven.
