# One-Week Living Memory Agent Runbook

**Purpose:** dispatch multiple implementation agents in parallel without losing product coherence.

## Branch model

Integration branch: `integration/lm-week-one`  
Agent branches:
- `agent/lm-week-a1-transcription`
- `agent/lm-week-a2-muse`
- `agent/lm-week-a3-completion`
- `agent/lm-week-a4-sharing`
- `agent/lm-week-a5-acceptance`

All branches start from the same frozen integration SHA.
Only A0 merges shared contracts, migrations, global state-machine files, or release metadata.
Agents synchronize with integration at least twice per day or immediately after a shared-contract change.

## Required pre-read for every agent

1. `docs/FOUNDATION/01_PRODUCT_INVARIANTS.md`
2. `docs/FOUNDATION/06_AI_BEHAVIOR_GUIDE.md`
3. `docs/PRODUCT/STORYTELLER_SOVEREIGNTY.md`
4. `docs/EXECUTION/ONE_WEEK_LIVING_MEMORY_PROOF_ROADMAP.md`
5. `docs/EXECUTION/ONE_WEEK_LIVING_MEMORY_TASK_GRAPH.json`
6. only the implementation receipts/code relevant to the assigned lane

Historical receipts/specs are evidence of prior work, not permission to restore superseded product behavior.

## Universal agent instruction

Build the smallest complete slice assigned to you.
Do not broaden scope.
Do not invent missing product rules.
Do not treat a storyteller's recollection as a claim for the system to verify.
“Confirm” means the storyteller says the attached context reflects what they want preserved.
Use synthetic media only.
Run targeted tests during development and the lane's merge gate before handoff.
Return: commit SHA, changed files, behavior achieved, tests run, evidence, known limitations, and any integration dependency.
## A0 — Integration / Release Captain

**Owns:** shared domain contracts, migrations, integration branch, merge order, activation event, release-candidate lock.

**Day 1:** freeze interfaces for transcription result, Muse prompt/result, storyteller context, Living Memory completion, Share Artifact, and failure states.
Prefer additive compatibility over destructive renames.
Legacy truth-state storage may remain but must not leak into user-facing judgment semantics.

**Day 3:** integrate durable finalization and emit `first_living_memory_completed` exactly once.

**Day 5:** convergence pass. Fix only cross-lane defects blocking preservation, Muse behavior, completion, playback, privacy, or recovery.

**Day 7:** lock exact RC SHA after human proof and G5.

**Must not:** redesign landing page, revive share-to-unlock, merge commerce, or allow agents to create competing schemas.

## A1 — Transcription Pipeline

**Owns:** queue dispatch/consumer, STT provider adapter, transcript persistence, retry/idempotency, language metadata, provider failure.

**Input:** durable original audio reference.

**Output:** derivative transcript with source/provenance pointer and processing status.

**Must prove:** duplicate queue delivery does not duplicate transcript state; provider failure leaves original voice safe; English and Spanish/mixed audio work in staging.

**Must not:** summarize the story, infer truth, rewrite the speaker, or make Muse decisions.
## A2 — Muse / Remembering Companion

**Owns:** one useful follow-up question and optional who/what/when/where story context.

**Goal:** help more of the person's own memory surface.

**Allowed:** ask from the person's words or visible photograph context; let the person state, edit, approximate, omit, skip, or say “I don't remember.”

**Forbidden:** fact-checking, credibility scoring, historical correction, truth/dispute labels, invented missing detail, reconciling two people's recollections, or ranking versions.

**Output:** one prompt at a time plus optional storyteller-owned context with provenance.

**Must prove:** ambiguous/missing fixtures cause a question, omission, or unknown—not fabricated content.

## A3 — Review / Completion / Playback

**Owns:** final review, durable completion transaction, completion moment, archive reopen, original voice playback.

**Review must distinguish:** original photo, original audio, transcript derivative, Muse help, and storyteller-owned context without making the interface technical.

**Completion requirement:** durable photo + durable voice + authorized owner + idempotent finalization receipt.

**Emotional acceptance:** after completion, the user sees the photograph and can hear the original storyteller's voice again immediately.

**Must not:** require Muse success to preserve the Living Memory when safe manual context is possible.

## A4 — Safe Family Sharing

**Owns:** bounded Share Artifact, preview, private-family link or native share handoff, revocation/expiry behavior already compatible with architecture.

**Rule:** nothing leaves the private archive unless visible in the preview/allowlist.

**Must prove:** hidden transcript text, unrelated metadata, family relationships, internal IDs, and private comments are absent by default.

**Must not:** implement Facebook OAuth, auto-posting, growth rewards, or share-to-unlock this week.
## A5 — Staging / Reliability / Acceptance

**Owns:** isolated staging readiness, synthetic fixtures, live-provider receipts, device/browser evidence, rollback proof, final human comprehension session.

**Day 1:** verify D1, R2, AI, Queue, ElevenLabs transcription secret/configuration, auth, staging origin, and redacted logging. Report blockers immediately.

**Day 2:** capture English + Spanish/mixed transcription/Muse receipts using non-sensitive fixtures.

**Day 6:** run full journey on current Android Chrome and iPhone Safari plus one unreliable-network pass.

**Day 7:** observe at least three uncoached people. Do not teach the flow. Record where they hesitate or misunderstand Muse versus their own story.

**Must not:** build a new testing framework or turn acceptance into exhaustive regression work.

## Merge sequence

1. A0 contract freeze.
2. A1 transcription foundation.
3. A2 Muse contract/runtime.
4. A3 completion/playback.
5. A4 sharing.
6. A5 staging evidence and defects.
7. A0 convergence and RC lock.

A lane can begin in parallel before earlier lanes finish when it works against frozen fixtures/contracts, but it cannot merge until its declared dependencies are satisfied.

## Test economy

During coding: targeted tests only.
At lane handoff: type/lint + targeted integration + build/dry-run only if touched.
At convergence: G1–G4.
At release-candidate proof: G5 and clean-install verification.

Do not rerun expensive unrelated suites because a copy string or isolated component changed.
Do rerun the gate whenever a change touches durability, authorization, completion idempotency, Muse no-invention behavior, or the share boundary.
