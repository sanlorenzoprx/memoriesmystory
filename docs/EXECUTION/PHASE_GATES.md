# Living Memory Campaign Gates

Every packet inherits the root work loop, security contract, Definition of Done, Living Memory anti-drift checklist, and Foundation precedence.

Order after the release candidate follows `../DECISIONS/2026-09-30-next-phase-order-and-our-living-legacy.md`. Existing Packets 1–4 remain valid evidence for persistence, local-first capture, immutable originals, and account binding. The 2026-08-11 doctrine changes downstream product semantics without erasing those receipts.

| Packet | Outcome | Gate evidence | Scale protection |
| --- | --- | --- | --- |
| 0R | Living Memory doctrine ratified | decision record, Foundation v2, share policy v2, anti-drift checklist | one authoritative mechanism and vocabulary |
| 2R | Living Memory domain overlay | aggregate/type tests over existing MemoryStory/media/truth contracts | no risky DB rename; compatibility boundary explicit |
| 3 | First-five-minute Magic Moment | Photo → Voice → Muse → Preserved → Playback → Invite/Share E2E; activation event | idempotent activation, local recovery, phone-first UX |
| 4 | Source authenticity hardening | source/provenance/revision tests, durable receipts | immutable originals, derivative lineage |
| 5 | Transcription and restrained Muse | queue retries, English/Spanish/mixed receipts, source-grounded prompt evidence | versioned model/prompt config, bounded fallback |
| 7 | Voluntary Share Artifact + growth telemetry | privacy projection, preview, Facebook handoff, no-reward entitlement test, referral events | bounded projection, revocation where controlled, idempotent event tracking |
| RC | Release-candidate acceptance and production-ready hardening | real-phone journey, uncoached human sessions, `DEFINITION_OF_DONE_V1.md` evidence (see `../CURRENT_STATE.md`) | locked RC SHA; production deployment needs separate owner authorization |
| 8 | Archival photo capture | physical print → untouched source capture + derived corrected scan; target-phone quality evidence | source capture immutable; correction is a derivative |
| 9 | Our Living Legacy | one photograph + host + one remote family member, live conversation, original session recording, speaker attribution, replay | replaceable real-time provider adapter; per-participant consent and attribution |
| 10 | Family Archive foundation | people/relationship/Chapter contracts and access tests | ownership keys, archive boundaries, indexes |
| 11 | Family contributions | invite/contribution attribution, conflicting-recollection tests | additive history, contributor identity and scope |
| 12 | Retrieval and timeline | source-scoped search/retrieval, people/place/date navigation | privacy-filtered retrieval, provenance |
| 13 | Resurfacing | meaningful date/person/place/unfinished-memory return paths | no manipulative engagement dependency |
| 14 | Derivative storytelling | Reel/Chapter/Life Story generation with source receipts | derivatives cannot replace sources |
| 15 | Legacy and growth readiness | export/stewardship/migration tests plus Living Memory Loop metrics | portable archive, long-term continuity, evidence-driven acquisition |

## Landing-page sequencing

The existing landing surface is not the product-positioning contract. Its replacement is a dedicated Phase 1 positioning slice after doctrine/domain ratification. Do not spend design effort polishing obsolete positioning.

## Gate rule

A packet advances only after its receipt names commands, results, artifacts, failures, known limitations, affected invariants, commit, and one next packet. Mock evidence may support deterministic tests but cannot satisfy a live-provider or real-device gate.
