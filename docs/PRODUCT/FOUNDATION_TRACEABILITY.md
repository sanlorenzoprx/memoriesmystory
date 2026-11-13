# Foundation Traceability

Use this map to prevent implementation from becoming disconnected from the Living Memory doctrine. The expanded first-release scope and evidence mapping are recorded in `../DECISIONS/2026-11-13-expanded-first-release.md` and `../EXECUTION/EXPANDED_FIRST_RELEASE.md`; no Product Invariant is weakened.

| Product outcome | Foundation reason | Primary invariants | First evidence |
| --- | --- | --- | --- |
| Capture/import photograph | The photograph is the doorway to the remembered moment. | I-03, I-08, I-13, I-15 | Original survives enhancement, reload, and interrupted upload. |
| Record authentic voice | Voice carries the person and remains a primary source. | I-02, I-04, I-08 | Original playback is available after durable preservation. |
| Assemble Living Memory | Photo, voice, context, truth, and provenance must remain connected. | I-01, I-03, I-04, I-09 | `LivingMemory` aggregate validates durable originals and common source binding. |
| Transcribe and extract context | Search and discovery help families understand without replacing testimony. | I-04, I-05, I-06, I-26 | Generated/structured material stays separate and uncertainty is visible. |
| Storyteller review and voluntary finish | Optional elicitation cannot block preserving authentic sources; corrections remain additive. | I-03–I-10, I-16, I-19–I-21 | Source-confirmed completion without anchors/Muse/transcription; original transcript retained; stale edits rejected; shared captions pinned to the selected revision. See November 13 review/finish decision and receipt. |
| Muse follow-up | One thoughtful question can help a memory emerge. | I-16, I-26 | Muse listens first; one relevant question follows; silence is allowed. |
| Durable preservation | Families must be able to trust “saved.” | I-08, I-09, I-10 | Completion copy appears only after required originals confirm. |
| First-five-minute Magic Moment | The first experience must prove transformation, not explain features. | I-13, I-14, I-15 | `first_living_memory_completed` occurs only after a valid durable completion path. |
| Family Archive / Chapters | Moments accumulate into chapters, lives, and family history. | I-09, I-11, I-12, I-28 | Living Memory remains complete through organization and export. |
| Voluntary sharing | Human memories naturally move among family and friends. | I-19, I-20, I-21, I-22, I-23, I-24, I-27 | Share preview is deliberate, no private metadata leaks, and no entitlement reward is granted. |
| Our Living Legacy | Families remember together and differently. | I-07, I-25 | Contributions remain attributed and disagreement survives. |
| Export and legacy stewardship | Legacy must outlive the product and account. | I-11, I-12, I-30 | Human-readable export and stewardship path are tested. |
| Multilingual access | Families should not adapt themselves to technology. | I-17, I-18 | EN/ES controls and public views; language switches retain source bytes/testimony and unsaved edits; new Muse requests use UI language. Automated evidence and human/device limits: `../IMPLEMENTATION/ENGLISH_SPANISH_INTERFACE_2026-11-13.md`. |
| Offline/cross-device continuation | A memory should not be lost because a device or network changes. | I-10, I-12, I-17 | Progress survives interruption, reload, sign-in, and second-device continuation. |
| Retrieval and resurfacing | Preserved memories should remain findable and meaningful over time. | I-28, I-30 | Retrieval respects privacy/source scope and resurfacing is attributable to known archive context. |

## Growth trace

The bootstrap growth loop is product value, not a reward scheme:

**Living Memory completed → voluntary share → recipient experiences the memory → recipient recognizes their own preservation need → another Living Memory begins.**

Instrument the loop with the canonical product events in `app/domain/product-events.ts`.

Native-still acquisition and honest fallback evidence are recorded in `../IMPLEMENTATION/ARCHIVAL_STILL_CAPTURE_2026-11-13.md` (I-03, I-08–I-10, I-15, I-17–I-18). Full archival-scan and physical-device acceptance remain pending.
