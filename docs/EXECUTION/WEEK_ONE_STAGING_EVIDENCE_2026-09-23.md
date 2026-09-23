# Week-One Living Memory Staging Evidence

**Date:** 2026-09-23
**Branch:** `integration/lm-week-one`
**Environment:** isolated MemoriesMyStory staging
**Media:** synthetic/non-family only

## Result

The automated product proof is live through the complete core loop:

**Photo → real voice → durable originals → transcription → Muse remembering prompt → storyteller-owned context → completion → reopen → original playback → bounded family share → revoke.**

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
## Crucial regression gate

Focused convergence suite:

- transcription provider boundary
- account binding / recovery
- media durability
- queued transcription and provider failure
- Muse storyteller sovereignty
- durable completion / activation
- bounded sharing

**Result: 7 test files / 19 tests passed.**

D1 verifier:

**26 required objects verified**, including integrity, foreign keys, immutable-original triggers, and fail-closed completion.

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

Operational caveats:

- the custom Cloudflare automation API token still fails D1 access; the refreshed Wrangler OAuth session works. Correct the token permissions before unattended deployment depends on it.
- keep the D1 trigger-migration workaround documented until Cloudflare's remote migration parser accepts these files through the normal path.

## Release interpretation

Automated evidence is sufficient to move to the Day-7 human gate.

It is **not** evidence that the product is publicly launch-ready. The stop rule remains: human proof first, then lock the exact RC SHA and stop feature work.
