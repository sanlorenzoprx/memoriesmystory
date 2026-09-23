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

> Esta foto es de mi madre en San Juan. We were together after school, cerca de la casa de mi abuela, but I do not remember the exact year

Observed Muse prompt:

> ¿Cuántos años crees que tenías en esa foto?

Evidence:

- code-switching remained in the transcript
- missing exact year was not invented
- Muse asked a remembering question in Spanish
- storyteller marked time as unknown
- completion succeeded without forcing a date
- original photo/audio playback matched source bytes
- bounded family share and revocation passed

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
