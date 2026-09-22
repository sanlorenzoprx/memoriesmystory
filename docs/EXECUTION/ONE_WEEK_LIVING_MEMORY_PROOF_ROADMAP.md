# One-Week Living Memory Product Proof Roadmap

**Date:** 2026-09-22  
**Status:** execution contract  
**Target:** one production-ready, not-yet-public release candidate in one week

## Product proof

The week exists to prove one thing beautifully:

**Choose one photograph → tell its story in your real voice → Muse helps without inventing → confirm who/what/when/where → preserve the original photograph and voice → create one completed Living Memory → hear it again → safely share it with family if you choose.**

Everything in this roadmap either closes that loop or is deferred.

## Memory principle for this sprint

A memory is the storyteller's recollection, not a courtroom finding.
The product must not force people to resolve different recollections into one official version.
If another person later remembers the same photograph differently, their recollection remains separately attributed and can coexist with the first.
Muse may help organize what was actually said and may ask for missing context, but it must never invent testimony or silently reconcile people.

For the first solo Living Memory proof, who / what / when / where are **story context fields**, not a mechanism for judging competing family accounts.
A storyteller may confirm, edit, approximate, leave unknown, or skip context. Here, **confirm** means “this is what I want attached to my story,” never “the system verified this as historical fact.”

## Week-one non-goals

Do not build albums, Memory Circle, public feed, broad social publishing, billing, reels, books, legacy inheritance, family archive expansion, broad landing redesign, database renames, or architecture rewrites.
Facebook authentication is not a release dependency. Email + Google account recovery is sufficient for this proof.
Sharing is voluntary. No share-to-unlock behavior may return.

## Execution model

Use one integration lane plus five bounded parallel agents. Parallelism is allowed only behind frozen contracts.
The integration agent alone owns shared migrations, canonical domain types, global state-machine changes, release branch merge order, and final acceptance.
Every agent works in its own branch/worktree, produces a small receipt, and merges through the integration lane.
No agent may silently widen scope to solve a future phase.

### Agent A0 — Integration / Release Captain

Owns contract freeze, task graph, shared migrations/types, merge sequencing, activation semantics, final release candidate, and blocker decisions.
Keeps one active integration branch based on current origin/main.
Rejects broad refactors unless required by the product proof.

### Agent A1 — Transcription Pipeline

Owns Queue + Workers AI transcription, retries/idempotency, transcript persistence, language handling, and provider-failure behavior.
Must preserve the original audio regardless of AI success.
Delivers English plus Spanish/mixed-language staging evidence.
### Agent A2 — Muse + Story Context

Owns one warm source-grounded Muse question, suggested who/what/when/where context, provenance, confirmation/edit/approximate/unknown UI contracts, and invention defenses.
Muse may suggest only from authorized source material or clearly ask the storyteller.
Muse never decides between different people's recollections and never rewrites a person's memory into an authoritative family version.

### Agent A3 — Review / Completion / Playback

Owns unified review, finalization transaction, first_living_memory_completed, completed Living Memory presentation, archive reopen, and original-audio playback.
Completion must be idempotent and durable.
The emotional proof is hearing the preserved voice again beside the photograph.

### Agent A4 — Safe Family Sharing

Owns bounded Share Artifact projection, preview, private-family handoff/link/native share, revocation/expiry policy for the proof, and privacy-leak tests.
Only explicitly selected content may cross the archive boundary.
No social OAuth or automated posting is required this week.

### Agent A5 — Staging / Reliability / Acceptance

Owns staging bindings, synthetic fixtures, logs/metrics, deploy/rollback rehearsal, focused browser/device evidence, and final clean-install verification.
Does not create a second architecture or parallel test framework.

## Frozen week-one contracts

Freeze these by the end of the first build block:

1. LivingMemory remains the customer-facing aggregate over existing compatible persistence.
2. A completed Living Memory requires durable original photo + durable original voice + authorized owner + finalization receipt.
3. Transcript, Muse output, extracted context, translation, and summaries are derivatives; none replaces original testimony.
4. Who / what / when / where belong to the storyteller's memory context and may be confirmed, approximate, unknown, or skipped.
5. Different people's recollections are not automatically reconciled; future contributions remain separately attributed.
6. Muse asks at most one context-aware question in the first proof loop.
7. AI failure cannot destroy, invalidate, or hide durable source media.
8. The user may complete with unknown context rather than fabricate an answer.
9. first_living_memory_completed fires once at the durable completion boundary.
10. New Living Memories begin private.
11. External sharing uses a bounded Share Artifact and is always deliberate.

## Minimal first-five-minute UX

1. Choose or photograph one image.
2. See lightweight quality guidance; continue anyway is allowed.
3. Record the story in the storyteller's real voice.
4. Originals begin durable sync immediately.
5. Transcription runs after durable audio is available.
6. Muse listens to the authorized story and asks one warm grounded follow-up when useful.
7. Show who / what / when / where as editable story context, with approximate / unknown / skip available.
8. Person confirms or edits only their own memory context.
9. Review photograph + original voice + transcript/context distinction.
10. Finalize one Living Memory.
11. Show the completion moment: **“This memory is now part of your family's history.”**
12. Replay the original voice with the photograph visible.
13. Offer: Keep Private / Share with Family.
14. Sharing opens a preview of exactly what leaves the private archive.
## Failure behavior

Photo or audio upload interruption resumes from local recovery.
Transcription failure shows preserved-source truth and permits retry; it never says the memory is lost.
Muse failure falls back to manual who/what/when/where context.
An unanswered context field becomes unknown or omitted, not guessed.
Duplicate queue delivery, duplicate finalize request, refresh, and re-login must not duplicate a Living Memory or activation event.
Share failure leaves the Living Memory private and intact.

## Instrumentation required

Capture only the events needed to understand the loop:
capture_started, photo_durable, voice_durable, transcript_ready, muse_prompt_shown, muse_prompt_answered, context_confirmed, living_memory_completed, playback_started, share_previewed, share_created.
Do not build an analytics platform this week.

## Daily execution

### Day 1 — Reconcile, freeze, unblock

A0 rebases the execution branch on current origin/main, freezes interfaces, and maps existing Packet 1–4 code to the proof loop.
A5 provisions/verifies isolated staging D1, R2, AI, and Queue bindings and documents missing secrets/configuration.
A1 builds the queue/STT adapter behind the frozen transcript contract.
A2 builds Muse/story-context logic against fixtures and source references.
A3 builds the review/finalization UI shell against contract-valid derivative fixtures.
A4 builds the Share Artifact projection contract and privacy allowlist.

**Day-1 exit:** all agents compile against the same frozen contracts; no unresolved schema ownership; staging prerequisites are known.

### Day 2 — Make voice become grounded text

A1 completes queue delivery, idempotency, transcription persistence, retry/error states, and language metadata.
A2 consumes transcript/source references, implements one Muse question, structured context suggestions, and confirm/edit/approximate/unknown behavior.
A3 wires transcript/context review states without final activation yet.
A5 runs the first real English and Spanish/mixed staging transcription receipts.

**Day-2 exit:** a durable recording can become a persisted transcript and grounded story context without modifying the original voice.

### Day 3 — Complete the Living Memory

A0/A3 wire the durable completion transaction and one-time activation event.
A3 completes review, final confirmation, completion screen, archive reopen, and original-audio playback.
A2 closes provenance display and manual correction paths.
A1 proves provider failure/retry never corrupts source media.

**Day-3 exit:** Photo → Voice → Muse/context → Finalize → Reopen → Playback works end to end locally/in integration.

### Day 4 — Safe voluntary family sharing

A4 wires Share Artifact preview, selected projection, safe token/handoff, revocation or bounded expiry appropriate to the existing architecture, and copy/native share.
A0 ensures sharing is downstream of completion and has no entitlement reward.
A5 adds redacted share logging and validates private metadata exclusion.

**Day-4 exit:** a completed Living Memory can remain private or deliberately create a bounded family share with no archive leakage.
### Day 5 — Recovery and convergence

Merge all accepted lanes into the integration branch.
Exercise offline/interrupted upload, re-login/cross-device recovery, duplicate queue delivery, duplicate finalization, AI failure, and failed share.
Fix only defects that block the product proof or its invariants.
Run clean-install build and focused integration suite.

**Day-5 exit:** one coherent release candidate exists; no feature branch behavior is required for the main journey.

### Day 6 — Staging + real-device proof

Deploy the release candidate to isolated staging.
Run one English journey and one Spanish/mixed-language journey using synthetic/non-family media.
Run current iPhone Safari and Android Chrome journey evidence, plus one unreliable-network pass.
Verify observability, redaction, authorized playback, share boundary, and rollback.

**Day-6 exit:** the product proof works on staging and real mobile browsers with dated evidence.

### Day 7 — Human proof and release-candidate lock

Give the experience to at least three uncoached people. Do not explain the flow.
Observe whether each person can create, replay, and optionally share one Living Memory and whether they understand what came from the storyteller versus Muse.
Fix only severe comprehension, trust, accessibility, or completion defects.
Run the final crucial gates, tag the exact release-candidate SHA, update receipts/runbook, and stop.

**Day-7 exit:** production-ready evidence exists for the exact product proof. Public launch remains a separate decision.

## Crucial-only test strategy

Do **not** run the entire test universe after every edit. Use three levels.

### Level 1 — Agent-local fast checks

Run targeted unit/type checks for the files/contracts an agent changed.
Examples: transcript parser/idempotency, Muse no-invention rules, finalization reducer, Share Artifact allowlist.
These should be fast enough to run repeatedly.

### Level 2 — Merge gates

Run only when a lane is ready to merge:
- typecheck + lint for changed package/surface;
- targeted integration tests for the lane;
- build/dry-run if runtime bindings or Worker routes changed.

### Level 3 — Six product gates

**G0 Baseline:** clean install, typecheck, build, existing critical tests before sprint integration.

**G1 Source Preservation:** photo + voice durability, interrupted upload recovery, immutable originals, no false “saved” state.

**G2 Grounded AI:** real English + Spanish/mixed transcription; invention traps; missing context remains unknown; Muse output is traceable to authorized source material.

**G3 Durable Completion:** duplicate finalize is idempotent; completed object reopens; original audio plays; first_living_memory_completed emits once.

**G4 Privacy Boundary:** Share Artifact is allowlist-only; hidden transcript/context/relationships cannot leak; failed/revoked share leaves archive private.

**G5 Full Journey RC:** staging Photo → Voice → Muse → Confirm → Preserve → Playback → optional Share on Android Chrome and iPhone Safari, followed by rollback proof.

A defect that violates an invariant blocks the gate. Cosmetic imperfections that do not damage trust, comprehension, accessibility, or the core emotional moment go to backlog.
## Merge discipline

Each agent uses agent/lm-week-<lane> from the same integration base.
No long-lived merges directly to main.
A0 merges in dependency order and resolves shared files before the next lane rebases.
Every merged lane adds a short receipt: changed behavior, tests run, evidence, known limitations, and exact SHA.
At least twice per day, all active lanes synchronize with the current integration contract to prevent end-of-week collision.

## Automation rules for agents

Before coding, read Product Invariants, Definition of Done, this roadmap, and only the implementation files relevant to the assigned lane.
Do not infer that a schema table means the feature exists.
Do not use legacy repos as architecture authority; they are reference material only.
Do not commit secrets, production identifiers, or real family media.
If a provider blocks progress, preserve the contract, implement the fail-safe path, record the blocker, and continue another non-dependent task.
If the same failure repeats twice, stop blind retrying and narrow/escalate.

## Hard scope-kill list

If schedule pressure appears, cut these before cutting authenticity or recovery:
- fancy transcript editing;
- multiple Muse questions;
- automatic narrative rewriting;
- translation UI beyond what is needed to prove EN/ES behavior;
- social-platform API publishing;
- elaborate share templates;
- album placement;
- people graph;
- search/timeline;
- notifications;
- commerce;
- landing-page polish;
- public discovery work.

Never cut original-media durability, provenance, manual unknown/edit paths, idempotent completion, playback, privacy boundary, or recovery.

## Operational budgets

The first session should remain understandable without instruction.
Target ordinary Photo → completed Living Memory in under five minutes.
AI work should never hold the user hostage indefinitely: after a bounded wait, show truthful preserved status and allow retry/continue where safe.
Avoid provider abstraction work beyond one replaceable interface; the doctrine is portable, the provider is not the product.
Use synthetic fixtures for automation and one small licensed/non-sensitive media set for staging.
## What else is required beyond coding

1. **Scope freeze:** no new feature enters the week unless it is necessary to complete or trust the loop.
2. **One integration owner:** parallel agents cannot independently change the canonical state machine.
3. **Staging on Day 1:** Queue/AI/D1/R2 must not wait until the last day.
4. **Synthetic acceptance media:** stable English and Spanish/mixed fixtures with known and deliberately missing context.
5. **No-invention traps:** fixtures with ambiguous or absent names/dates so Muse must ask, leave unknown, or stay silent rather than manufacture detail.
6. **Release receipts:** every gate produces dated evidence, not “looks good.”
7. **Human comprehension test:** at least three uncoached users before RC lock.
8. **Rollback:** prove we can undo the staging release before declaring production-ready.
9. **Cost/latency telemetry:** record AI request count, failures, retries, and rough processing latency; optimize later unless it breaks the five-minute promise.
10. **Stop rule:** once the product proof passes, stop adding features and lock the release candidate.

## Final acceptance sentence

At the end of the week we should be able to say, with evidence:

> An ordinary person can choose one photograph, tell its story in their real voice, receive source-grounded Muse help without fabricated details, confirm or leave story context unknown, durably create one private Living Memory, reopen it and hear the original voice, and deliberately share only a bounded copy with family.

Anything short of that is not the week-one product proof. Anything beyond that is backlog.
