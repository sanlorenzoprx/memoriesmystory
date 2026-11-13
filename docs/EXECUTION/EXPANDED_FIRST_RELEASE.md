# Expanded first release

**Scope authority:** [owner decision, 2026-11-13](../DECISIONS/2026-11-13-expanded-first-release.md).  
**Implementation baseline:** `0d4452eb9ffb78ad22758d00ab32df0fdead0367`.  
**State:** in development; no release candidate is accepted and no production deployment is authorized.

All rows below are required for the same first release. Solo capture remains the uncomplicated entry path. Implementation may be staged, but later rows are not deferred to a separate release. Use `TASK_QUEUE.json` as the one task ledger; this matrix describes acceptance, not a second source of task status.

## Required customer outcomes

| ID / task | Included behavior | Acceptance evidence |
| --- | --- | --- |
| R0 / solo-trust-controls | Return after reload to manage/revoke links; edit transcript/context with attributable revisions; stop/finish Muse naturally; recover retries and audio interruptions; full English/Spanish use | Owner/stranger isolation; revoked page/photo/voice 404; corrections leave original bytes unchanged and do not silently expand existing shared captions; completion idempotent; microphone/playback denial and outage recovery; Spanish route tests |
| R1 / archival-photo-capture | Native still capture with file fallback; practical quality guidance and manual override; perspective correction with manual corners; separate corrected scans | Physical angled print on Android/iPhone; dimensions/orientation recorded; source SHA unchanged; separate scan provenance and deletion; no generative restoration |
| R2 / our-living-legacy | In-person and remote two-person sessions; participants, scoped invitation/join, explicit versioned consent before recording, attributed originals, reconnect, review and private replay | Two physical phones/networks; consent denial/withdrawal; no unauthorized join/replay; partial recordings labeled; attribution uncertain until confirmed; recordings survive interruption |
| R3 / family-archive | Chapters/albums, people and human-entered relationships, family roles and invitations; independent attributed voice/text contributions | A memory appears in multiple Chapters without duplicate sources; unrelated family cannot enumerate/access; contributor cannot overwrite another testimony; differing accounts remain distinct; invitation expiry/revocation |
| R4 / retrieval-timeline | Owner/role-scoped search over approved title/person/place/date/Chapter; approximate/unknown dates; optional resurfacing with easy opt-out | Cross-family search isolation; access changes/deletion remove results; approximate dates stay approximate; reminders require opt-in and stop after opt-out |
| R5 / legacy-infrastructure | Complete authorized export of original media, approved text, revision history, relationships, session/contribution attribution, consent and derivative lineage; hash manifest and readable index; integrity maintenance; policy-backed stewardship | Export round-trip/hash validation; no bearer tokens/secrets; interrupted export never marked complete; fixity/restore rehearsal; revoked/unauthorized material excluded; approved successor designation/revocation/recovery and audit tests |
| R6 / derivative-storytelling | Source-grounded keepsake/Chapter/video derivative with selected inputs, attribution, preview, human review and explicit audience choice | Immutable sources, valid authorized source manifest, review required before distribution; no invented testimony or replacement of original voice |
| R7 / growth-engine | Bounded Facebook/WhatsApp/native handoff, clear external-copy boundary and privacy-safe referral measurement | Preview matches selection; no private context leakage; creator controls final handoff; revocation closes local link; no share reward or automatic public posting |
| R8 / paid-plans | Approved offers, server-owned checkout, verified replay-safe fulfillment, paid entitlements, cancellation/refund handling and cost controls | Provider sandbox scenarios including duplicate/out-of-order events, wrong amount/currency/account, pending payments and refunds; paid/free capacity separated; approved prices/terms before live activation |
| R9 / release-candidate-hardening | Security, abuse/rate/cost protection, consent/legal terms, accessibility, bilingual physical-device/human acceptance, observability, restore/rollback, release SHA | All Definition of Done evidence, three uncoached sessions including Spanish/mixed speech; physical Android/iPhone and second-device recovery; dated security/backup/incident receipts |

## Implementation evidence

Owner link controls and speech/retry repairs are on draft PR #21. Editable review, caption pinning and voluntary source-confirmed finish are on its dependent `feat/storyteller-review-finish` branch; see `../IMPLEMENTATION/STORYTELLER_REVIEW_FINISH_2026-11-13.md`. Neither branch status establishes live/device/human acceptance. The task queue remains the single task-status ledger.

## Dependency sequence

R0 → R1 → R2 → R3 → R4 → R6. R5 can begin with the existing solo sources and extend as R2/R3 add source types. R7 builds on R0 and validated share artifacts. R8 depends on approved offers and measured costs, not a share action. R9 evaluates the integrated result after every required capability is proven.

There is an internal **solo foundation checkpoint** before group/family changes reach integration. It validates the simple path and recovery; it is not the expanded release-candidate lock. Do not introduce a cycle that requires the final expanded RC before implementing its required features.

## Decisions and execution prerequisites

- Paid prices, regions/currency, tax/refund/chargeback terms and live billing authorization are open. Build and test a concrete sandbox implementation once the provider/account configuration is supplied; do not invent prices or grant capacity from a success page.
- Stewardship and contributor export/withdrawal/retention rules need explicit product/legal approval. Prepare concrete policy options and test cases before requesting a decision; never activate inheritance based only on an email claim.
- Remote transport needs an evaluated provider and staging credentials with scoped join/recording support. Existing Cloudflare-first boundaries stay; no custom video platform or speculative service scaffold.
- Current environment has GitHub access but no Cloudflare, Clerk, ElevenLabs or billing secret bindings. This blocks fresh authenticated live-provider/staging evidence, not local implementation or synthetic tests. Configure secrets through environment/provider settings, never chat or commits.
- Physical-phone and human sessions require actual observed devices/participants. Chromium emulation is useful evidence but cannot certify them.
- Production deployment, live customer charges and public publishing of family media remain separately authorized operations.

## Evidence and rollback

Track code, unit/integration, local-browser, live-staging, physical-device and uncoached-human evidence separately. Every slice must preserve existing solo capture/playback/delete behavior and update a redacted implementation receipt. Use additive migrations; preserve originals; prove scoped authorization and failure recovery. Test rollback/recovery against synthetic staging data. No real-family content in tests, logs, tickets or screenshots.
