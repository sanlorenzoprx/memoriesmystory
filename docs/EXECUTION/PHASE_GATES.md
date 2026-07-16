# Phase 1 Campaign Gates

Every packet inherits the root work loop, security contract, Definition of Done, and Foundation precedence.

| Packet | Outcome | Gate evidence | Scale protection |
| --- | --- | --- | --- |
| 1 | Domain, configuration, and persistence contracts | migrations, schema/immutability/idempotency/entitlement tests | ownership keys, indexes, versioned migrations, centralized limits |
| 2 | Local-first photograph capture and recovery | phone capture/import, reload recovery, denied-camera fallback, accessibility | client state machine independent of process memory |
| 3 | Immutable photo and voice durability | interrupted upload recovery, D1/R2 receipts, retrieval | private object policy, hashes, idempotent upload, no overwrite |
| 4 | Account binding and recovery | email/Google/Facebook staging paths, CSRF, double-claim/resume tests, second-device continuation | provider boundary, server-verified sessions, account isolation |
| 5 | Transcription and restrained Muse | queue retries, English and Spanish/mixed live receipts, partial failure | idempotent consumer, versioned model/prompt config, bounded fallback |
| 6 | Review and durable completion | truth-state separation, one completion transaction, reopen proof | transaction boundary, additive revisions, durable receipt |
| 7 | Private share-to-unlock | revocation, safe projection, concurrent duplicate share tests | opaque tokens, hashed lookup, idempotent entitlement event |
| 8 | Full Phase 1 acceptance | complete E2E, real devices, accessibility, security, staging and rollback receipts | observability, cost signals, runbooks, known-limit ledger |

## Gate rule

A packet advances only after its receipt names commands, results, artifacts, failures, known limitations, affected invariants, commit, and one next packet. Mock evidence may support deterministic tests but cannot satisfy a live-provider or real-device gate.
