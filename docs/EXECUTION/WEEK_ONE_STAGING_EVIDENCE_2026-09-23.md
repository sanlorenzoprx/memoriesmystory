# Week-One Living Memory Staging Evidence

**Date:** 2026-09-23
**Branch:** `integration/lm-week-one`
**Environment:** isolated MemoriesMyStory staging
**Media:** synthetic/non-family only

## Result

The automated product proof is live through the complete core loop:

**Photo → real voice → durable originals → transcription → conversational Muse → optional spoken storyteller replies → storyteller-owned context → completion → reopen → original playback → bounded family share → revoke.**

The release candidate is **not human-locked yet**. Three uncoached human sessions and current real-device iPhone Safari / Android Chrome evidence remain explicit release evidence.

## Live staging infrastructure

Verified live and isolated:

- staging Worker
- staging D1
- staging R2 originals bucket
- Workers AI binding
- staging processing Queue with producer + consumer
- Clerk email + Google configuration
- ElevenLabs Scribe v2 runtime secret
- family-share token pepper
- custom Cloudflare automation token verified for D1, Queues and R2

## Live English journey

Synthetic English source audio was preserved and processed through the deployed Worker and Queue.

Observed transcript:

> This photograph was taken at my grandmother house when I was a child. I remember the red dress and the mango tree, but I do not remember the exact year

Observed Muse prompt:

> What was the first thing that came to your mind when you saw the red dress in this old photograph?

Evidence:

- original photograph durable in R2
- original audio durable in R2
- queued transcription reached ready
- ambiguous year remained ambiguous
- Muse asked from storyteller material rather than filling the missing year
- storyteller context saved
- completion replay was idempotent
- completed Living Memory reopened
- downloaded photo matched the original bytes
- downloaded audio matched the original bytes
- bounded share preview passed
- public share exposed selected artifact only
- voice played from the share
- revocation returned the share to 404
## Live Spanish / mixed-language journey

Synthetic mixed Spanish/English source audio was preserved and processed through the same deployed path.

Observed transcript:

> Esta foto es de mi madre en San Juan. We were together after school, cerca de la casa de mi abuela, but I do not remember the exact year.

Observed Muse prompt:

> ¿Qué te recuerda de tu madre en ese momento, que te hace sentir como si estuvieras allí con ella?

Evidence:

- code-switching remained in the transcript
- missing exact year was not invented
- Muse asked a remembering question in Spanish
- storyteller marked time as unknown
- completion succeeded without forcing a date
- original photo/audio playback matched source bytes
- bounded family share and revocation passed

Acceptance-data note: the mixed-language proof reused the synthetic English acceptance account after its normal free-story capacity had already been consumed. That synthetic staging entitlement was increased only to permit another full acceptance journey. The product configuration remains one free Living Memory for normal accounts.

## Live phone-browser evidence

Live staging was exercised with the repository's Pixel-7 Chromium project, serially to avoid false timing failures on the older Windows machine.

**Result: 8 / 8 passed.**

Coverage includes:

- approved first screen
- camera and import entry paths
- imported-photo reload recovery
- contextual camera permission and denial fallback
- synthetic camera capture
- offline photo upload while voice remains usable
- ordered recovery after reconnection
- original voice preserve / retrieve / reload
- keyboard reachability
- no horizontal overflow at phone width
## Real-phone product-owner evidence

A real-phone product-owner run was performed after the automated phone-browser pass.

What worked on the real phone:

- photograph capture/import
- photograph upload/preservation
- microphone recording
- original voice playback

What the real phone exposed:

- the journey stopped at durable originals before the Living Memory continuation
- Muse was therefore not encountered
- Who / Where / When / What context was therefore not encountered
- account/save continuation was not obvious; the newest phone-created durable drafts remained anonymous in D1
- family sharing was unreachable from that stopped journey
- no in-product text-size control existed
- no delete control existed

These are release-blocking first-five-minute defects even though the underlying Muse/context/share APIs had already passed synthetic live acceptance.

Repair first deployed in Worker version `d99bf7d7-3657-41fd-b55e-5a2ccf992c39` and finalized in Worker version `822f501d-2064-4e2b-9a90-c4adf3fc9e0c`:

- visible **Save to my account & continue** handoff
- background Clerk-to-application session alignment for already signed-in users
- unfinished archive items continue into the Living Memory flow
- visible Muse listening/question representation
- explicit Who / Where / When / What section
- persistent A / A+ / A++ text-size control
- explicit draft/Living Memory deletion with private R2 + connected D1 cleanup
- existing bounded family-share UI remains downstream of successful completion

The repair is deployed and compiled/tested. A fresh authenticated synthetic staging draft then proved the repaired phone-width continuation end to end through the missing UI surfaces:

- Muse visible: PASS
- Who visible: PASS
- Where visible: PASS
- When visible: PASS
- What visible: PASS
- My account visible: PASS
- Delete this memory visible: PASS
- text-size control visible: PASS
- A++ changed root text size from 16px to 20px: PASS
- live deletion removed the disposable staging memory: PASS
- reopening the deleted memory returned HTTP 404: PASS
- live repair smoke result: `UI_REPAIR_SMOKE=PASS`
- live account page fallback absent after final deployment: PASS
- Clerk email sign-in control rendered: PASS
- Clerk Google sign-in control rendered: PASS
- completed Living Memory still exposed Share with family, Delete this memory, My account, and text-size controls after final deployment: PASS
- Muse timing refinement deployed in Worker version `e0c83c4f-1362-474d-b002-f0c8417efd53`: after photo acceptance Muse is visibly present before recording and offers the optional non-inventive cue “What comes back to you first when you look at this photograph?”
- before the first recording, microphone request count remained `0`; it became `1` only after the person chose to record: PASS
- choosing Record again returns to Muse before reopening the microphone, with the reset cue “What detail do you most want to make sure your family hears this time?”
- before rerecord, microphone request count remained `1`; it became `2` only after the person chose Record again: PASS
- dedicated live phone-Chromium regression `Muse cues before recording and returns before a rerecord`: PASS in 7.0s

A transient redeploy rebuilt Vite without `.env.staging.local`, which removed the compile-time Clerk publishable key and reproduced the fallback account screen. The deployment was corrected by rebuilding Vite with the staging env before Wrangler deploy. Future staging client builds must preserve this rule; a successful Worker deploy alone is not evidence that Clerk is present in the browser bundle.

The same real physical phone journey must still be rerun because the original defect was found on a real device, not in emulation.

## Voice-first conversational Muse evidence

The fixed Who / Where / When / What questionnaire has been replaced by a durable conversational Muse architecture. Person, place, time and event remain internal preservation anchors, but they are no longer presented as four form cards. Muse asks one natural question at a time from the storyteller's original transcript plus prior conversation turns.

Current staging Worker version for this proof:

`5e6a70d2-81cf-41a8-ade6-9f4af598ec80`

Current Git checkpoint:

`86c82591b5bcca56b0a6ccdd2724211614416007`

Verified implementation:

- Muse conversation turns are durable and attributed separately to Muse or storyteller.
- Muse may ask richer questions about detail, sequence, people, place, time, feeling, sensory memory or meaning.
- AI inference alone cannot resolve a preservation anchor.
- an anchor is resolved only by storyteller-stated, approximate, unknown or omitted input.
- Muse questions can be spoken through the replaceable ElevenLabs TTS provider.
- storyteller replies may be typed or recorded in their real voice.
- a spoken reply is preserved immutably in private R2 before transcription is trusted.
- transcription failure is retryable from the same preserved reply without rerecording.
- the original machine transcript is retained separately from storyteller-confirmed wording.
- Muse reads the storyteller-confirmed wording, while the original audio and machine transcript remain unchanged.
- the storyteller conversation turn retains provenance to both the exact Muse question and the exact preserved voice asset.
- preserved conversational voice remains privately playable after reload.
- deleting the Living Memory deletes conversational voice objects and their asset-scoped operation receipts.

Focused backend result:

- dynamic Muse sovereignty
- spoken-reply durability / provider failure / retry
- exact playback
- deletion cleanup
- transcription provider boundary

**Result: 4 test files / 5 tests passed.**

Focused Pixel-7 Chromium interaction:

**Muse asks → Answer with voice → record → listen → preserve → transcribe → review/correct derivative text → send → next Muse question → replay preserved storyteller voice: PASS.**

Live deployed synthetic staging proof using the existing English acceptance memory:

- active Muse question available: PASS
- deployed Muse TTS returned HTTP 200: PASS
- synthetic storyteller reply uploaded through the real Worker: HTTP 201
- voice reply durable before conversation continuation: PASS
- ElevenLabs transcription from the preserved R2 object: ready
- storyteller-confirmed text required before Muse continuation: PASS
- confirmed storyteller turn attached to the exact preserved voice asset: PASS
- private voice-reply playback returned HTTP 200
- playback SHA-256 matched the uploaded recording exactly: PASS
- `LIVE_CONFIRMED_VOICE_CONVERSATION=PASS`

ElevenLabs permission status:

- `text_to_speech`: working in local permission probe and through the deployed staging Worker
- `voices_read`: still unavailable on the current local key
- this does not block the current staging proof because a known working voice ID is configured behind the provider boundary
- once `voices_read` is enabled, Muse voice selection can be refined without changing the conversation architecture

Staging convergence after deployment:

- `/health` = HTTP 200
- D1 migrations: **No migrations to apply**
- required Worker secrets present by name only
- D1 + R2 + AI + Queue bindings present
- Queue producer + consumer present

## Crucial regression gate

Focused convergence suite:

- transcription provider boundary
- account binding / recovery
- media durability
- queued transcription and provider failure
- Muse storyteller sovereignty
- durable completion / activation
- bounded sharing

**Result: 8 test files / 20 tests passed.**

The additional focused test covers owner-requested deletion of private R2 media and connected D1 Living Memory records while retaining only a minimal deletion receipt.

D1 verifier:

**29 required objects verified**, including integrity, foreign keys, immutable-original triggers, fail-closed completion, deletion receipts, durable Muse conversation, and conversational voice-reply storage.

## Recovery / rollback evidence

A prior staging Worker version was deployed to 100% traffic using Cloudflare rollback.

- rolled-back Worker health: pass
- bound D1/R2 resources remained intact
- current local build redeployed after rollback
- restored Worker health: pass

This proves the Worker rollback path without pretending that D1/R2 data roll back with code.

## Important defects found and resolved

1. Cloudflare D1's normal remote migration path rejected the trigger-heavy migration batch with `incomplete input`.
   The exact SQL succeeded through `d1 execute --file`; all four migrations were applied and the D1 migration ledger was recorded. Wrangler then reported no pending migrations.

2. The deployed Worker initially reported an ElevenLabs transport failure.
   The provider boundary was corrected so the default transport calls global `fetch` through a wrapper instead of retaining an unbound function reference. The same failed operation then recovered from the already-preserved source audio and produced a real transcript.

3. Live phone automation initially produced false negatives under two parallel video-recording Playwright workers on the older Windows machine.
   Serial execution passed. The synthetic microphone fixture was also made deterministic by resuming its AudioContext and allowing enough time for MediaRecorder chunks.

## Failure / recovery proof

The live English staging journey produced a real provider failure before the final transport correction.

Verified after recovery:

- the original photograph and original audio remained `durable` throughout the provider failure
- the English story has exactly one `original_audio` asset
- the recovered transcript points to that same original-audio asset
- the preserved audio SHA-256 remained unchanged
- no replacement recording or second original-audio upload was required
- queued transcription subsequently reached `ready`
- duplicate completion replay returned the existing completed Living Memory rather than consuming completion twice
- duplicate share creation with the same idempotency key replayed the existing share rather than creating another share
- the focused provider-failure test still proves a failed provider attempt leaves durable originals intact and marks processing retryable

This is the required recovery behavior: provider failure may delay a derivative transcript, but it must not endanger or replace the storyteller's original testimony.

## Privacy / storyteller-sovereignty audit

Live D1 state and focused tests were checked together.

Verified:

- both acceptance Living Memories are `complete` and `private`
- every live context row is `source_type = storyteller`
- the mixed-language story stores `time` as `unknown` with a null value; no date was manufactured
- English approximate time remains `approximate`, not promoted to a verified fact
- neither live acceptance story has any row in legacy `memory_story_facts`; Muse output was not asserted as story fact
- both Muse artifacts are `muse_prompt` derivatives sourced from transcript references
- observed Muse prompts contain no truth-checking or judgment language
- original photo/audio assets remain `durable` with their source hashes
- the D1 immutable-original trigger passed the regression gate
- byte-for-byte live playback checks passed for both original photographs and both original audio files
- live share artifacts included only the selected photo/voice projection; captions were off and private context was not selected
- focused sharing tests verify unselected transcript, private context, account email, user IDs, story IDs, and media IDs do not leak through the public share surface
- every live acceptance share used for the gate was revoked, and the public URL returned 404 after revocation
- the staging R2 bucket has public `r2.dev` access disabled and has no custom domains

Storyteller sovereignty therefore remains the product rule: Muse may help a person remember, but it does not judge, verify, reconcile, or silently convert its own output into the person's memory.

## Known limitations / remaining gate

Do not mark Week One fully released until these are done:

- three uncoached people complete the experience without coaching
- current real Android Chrome smoke
- current real iPhone Safari smoke
- human confirmation that people understand their own story versus Muse assistance
- severe trust/comprehension/accessibility defects, if found, are fixed and rerun

Operational caveat:

- keep the D1 trigger-migration workaround documented for the original trigger-heavy migrations until Cloudflare's remote migration parser accepts those files through the normal path. The later `0005_memory_deletion.sql` migration applied normally through Wrangler.

## Release interpretation

Automated evidence remains green, but the first real-phone run found user-journey defects. The repair is deployed and the real-phone acceptance run must be repeated before moving past the real-device gate.

It is **not** evidence that the product is publicly launch-ready. The stop rule remains: real-device repair acceptance, then human proof, then lock the exact RC SHA and stop feature work.
