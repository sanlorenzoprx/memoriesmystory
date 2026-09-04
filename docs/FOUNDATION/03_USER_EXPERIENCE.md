# User Experience

**Version:** 1.1  
**Status:** Approved experience baseline and first implementation contract  
**Goal:** Define how Memories: My Story should feel, beginning with a first five-minute path that moves a mobile user from emotional understanding to one durably preserved Memory Story without making them learn the system.

## Experience promise

The product should feel like a patient family companion making room for a story—not a scanner, database, media manager, or AI demonstration.

Three experiences share this promise:

1. **Capture Your Memories** — one person and one photograph.
2. **Preserve Together** — family or friends remembering in person.
3. **Remember Together** — family or friends remembering at a distance.

The solo path is built first. Shared paths extend the same emotional and preservation rules.

## The first five minutes

The first five minutes are not an account tour. They are a complete emotional arc:

**A photograph matters → my voice matters → I can do this → the memory is safe → my family can receive it.**

The time ranges below are design targets, not a countdown imposed on the storyteller. The product must never rush grief, laughter, silence, uncertainty, accessibility needs, or a person who simply needs more time.

## Before the clock starts

The user may arrive from the home page, a family invitation, or a shared Memory Story. The primary route must always make the next meaningful action obvious.

Primary action: **Capture a Memory**

The user should not face a general permission wall, profile questionnaire, or account tour before understanding the value of the experience. Camera and microphone access are requested only when the related action begins, with one plain-language explanation of why each permission is needed.

When identity is required for durable ownership, recovery, or sharing, ask at the latest safe moment and preserve all completed local progress. Supported account paths are email, Google, and Facebook. Declining or interrupting sign-in must not destroy the photograph or recording.

## 0:00-0:30 — Create loving urgency

Show one clear idea:

> Old photographs fade. The voices behind them should not.

Supporting thought:

> You do not have to organize a lifetime. Start with one photograph, tell the story it brings back, and keep your real voice with it—so the people you love can receive more than an image.

Secondary landing-page thesis:

> A photograph preserves what they looked like. Their voice preserves who they were in the moment.

Supporting invitation:

> You do not have to preserve a lifetime today. Preserve one story before it becomes only a photograph.

The headline and first action remain primary. The secondary thesis may sit immediately below the hero rather than competing with the first 30-second decision.

Do not lead with AI, features, pricing tiers, storage, or setup.

## 0:30-1:30 — Capture the photograph

The user photographs a physical picture or imports a digital image.

Guidance is visual and spoken, brief and specific: position, glare, shadow, focus, edges, and stability. Automatic capture may occur when quality thresholds are met.

The original image is preserved immediately. Any enhanced archival copy is a separate derivative.

Muse guidance may say:

> Place the photograph on a flat surface. I'll help you capture it clearly.

The phone may be handheld or propped vertically for stability. The product guides the user toward the best result without requiring camera knowledge.

The user may override automatic capture and accept a usable image after seeing an honest quality warning. Guidance helps; it does not hold a family photograph hostage to an ideal score.

## 1:30-2:30 — Hear the invitation to remember

Keep the photograph as the dominant visual. Ask:

> Would you like help remembering?

Whether the answer is yes or no, begin with space, not interrogation.

> Take your time. Tell the story you remember when you look at this picture.

For the free first story, the initial voice allowance is up to 30 seconds unless the entitlement configuration changes. A clear, gentle countdown must not interrupt the emotional moment.

## 2:30-3:30 — Let Muse listen

Muse listens first. If the storyteller pauses and time or entitlement permits, it asks one warm, relevant question:

- “What do you remember most about this day?”
- “Who is beside you?”
- “What made this moment special?”

Muse accepts silence, emotion, uncertainty, code-switching, interruptions, and “I don't remember.” It does not ask who, what, when, and where as a rapid checklist.

## 3:30-4:30 — Show what was preserved

Present the completed Memory Story as one understandable object:

- photograph;
- playable original voice;
- transcript;
- Muse Legacy Description;
- suggested people, place, date, and tags;
- truth-state controls for uncertain details.

The user may correct the transcript or metadata. The original voice remains unchanged. Muse-generated material is visibly separate from human testimony.

Transcription, enhancement, or Muse processing may continue after the original photograph and voice are safe. Those derived processes must display a truthful **Processing** or **Needs attention** state and must never prevent preservation of the originals.

## 4:30-5:00 — Confirm safety and invite legacy

Only after durable cloud confirmation, display the locked completion sentence:

**This memory is now part of your family's history.**

Offer two calm next actions:

1. **Share this Memory Story**
2. **View my Memory Story**

Explain the free growth promise positively:

> Share a memory. Preserve another.

A deliberate qualifying share action unlocks the next free Memory Story under the Good Karma Share Policy V1. The first five Memory Stories follow this sequence. Sharing may be private, family-directed, social, or public; public sharing is never assumed.

When the user deliberately chooses a social or native-share destination, the product may offer this editable default caption:

> A photograph keeps the image. A voice keeps the person in the moment.

And this optional brand tag:

> #MemoriesMyStory

The caption and tag are never required for the unlock, may be edited or removed entirely, and must not automatically insert names, family facts, story excerpts, Muse-generated text, or other private content.

Sharing is invited after preservation, never used as a condition for keeping the Memory Story that was just created. A user may leave and return to the share decision later.

## First-use success criteria

The first experience succeeds only if the user can:

- understand why the action matters;
- capture or import a usable photograph;
- speak naturally without configuring technology;
- hear the original recording play back;
- distinguish their story from Muse-generated material;
- trust that the required assets are durably saved;
- understand how to share or return later;
- complete the path on a phone with minimal typing.

## Failure and recovery

- Camera or upload failure preserves progress and offers one clear retry.
- Interrupted audio remains recoverable until upload completes.
- Poor transcription never discards the original recording.
- Cloud-save failure says “Still saving” or “Needs connection,” never “Saved.”
- Every guided step is skippable and replayable through **Muse Help**.

## First-few-use guidance

The **Capture Your Memories** guidance repeats during the first few uses so a person does not have to remember the process after seeing it once. Guidance becomes lighter as confidence grows, remains skippable, and can always be replayed through **Muse Help**. The product should adapt from observed completion—not assume age, ability, or technical confidence.

## First-five-minute acceptance contract

The first implementation is not complete until all of the following are demonstrated on a representative phone-sized viewport:

1. A new user understands the purpose without reading a feature tour.
2. Camera and microphone permissions are requested in context, not in a batch.
3. A physical photograph can be captured with glare, focus, edge, shadow, and stability guidance, or a digital photograph can be imported.
4. The immutable original photograph is retained separately from every enhancement.
5. The storyteller can record up to the current free allowance, hear the original voice play back, and recover from an interrupted upload.
6. Muse listens first and offers no more than one warm, relevant question at a time.
7. Human testimony, corrected transcript, metadata, and Muse-generated material remain visibly distinguishable.
8. **This memory is now part of your family's history.** appears only after the required original assets and ownership metadata are durably confirmed.
9. The user can open the completed Memory Story, leave safely, and return later.
10. A deliberate qualifying private, family-directed, social, or public share unlocks the next free Memory Story, without assuming public consent.
11. The path remains usable with minimal typing, assistive technology, mixed English and Spanish, and unreliable connectivity.

Internal screens, API responses, test counts, or successful AI calls do not satisfy this contract unless the user outcome above works end to end.

## What must not appear in the first five minutes

- model names or AI configuration;
- multi-page profile setup;
- a feature tour unrelated to the first story;
- forced public sharing;
- dense metadata forms;
- an unearned “saved” confirmation;
- pressure that turns loving urgency into fear.

## Shared-experience extension

In-person and remote Memory Circles keep the selected photograph fixed as the primary visual focus while people remember together. Participants remain visible in remote sessions. Contributions are attributed, disagreements remain intact, and the completed Memory Story is delivered to each participant's account after minimal signup.
