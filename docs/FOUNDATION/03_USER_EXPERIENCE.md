# User Experience

**Version:** 2.0  
**Status:** Approved experience baseline and first implementation contract  
**Goal:** Move a mobile user from emotional understanding to one durably preserved **Living Memory** without making them learn the system.

## Experience promise

The product should feel like a patient family companion making room for a story—not a scanner, database, media manager, social network, or AI demonstration.

The visual and interaction north star is:

**Apple Photos warmth + Airbnb trust + Calm pacing + Pinterest photo-first discovery.**

Three experiences share this promise:

1. **Capture Your Memories** — one person and one photograph.
2. **Preserve Together** — family or friends remembering in person.
3. **Remember Together** — family or friends remembering at a distance.

The solo path is built first. Shared paths extend the same authenticity, privacy, and preservation rules.

## The first five minutes

The first five minutes are not an account tour. They demonstrate a transformation:

**Photo → Voice → Muse → Preserved → Playback → Invite/Share**

The user should feel that an ordinary photograph is now materially more valuable to their family because its authentic story and voice remain with it.

The time ranges below are design targets, not a countdown imposed on the storyteller. The product never rushes grief, laughter, silence, uncertainty, accessibility needs, or a person who simply needs more time.

## Before the clock starts

The user may arrive from the future landing page, a family invitation, or a shared Living Memory. The next meaningful action must be obvious.

Primary intent: **Give a photograph its story.**

The user should not face a general permission wall, profile questionnaire, AI explanation, or account tour before understanding the value. Camera and microphone access are requested only when the related action begins.

When identity is required for durable ownership, recovery, or sharing, ask at the latest safe moment and preserve completed local progress. Supported account paths currently include email and Google; Facebook identity remains a separate staging acceptance item. Social **sharing to Facebook** does not depend on Facebook being the account identity provider.

## 0:00–0:30 — Demonstrate the idea

The experience communicates one belief:

> **A photograph can outlive the story that gives it meaning.**

A future production surface should demonstrate, not merely explain, the difference between an unexplained photograph and the same photograph accompanied by the person's real voice.

Do not lead with AI, features, pricing tiers, storage, or setup.

## 0:30–1:30 — Choose the photograph

Offer the simplest useful actions:

- **Capture a photo**
- **Choose a photo**

The photograph becomes the dominant visual surface.

For physical-photo capture, guidance is visual and spoken, brief and specific: position, glare, shadow, focus, edges, and stability. The original image is preserved. Any enhanced archival copy remains a separate derivative.

The user may accept a usable photograph after an honest quality warning. Guidance helps; it does not hold a family photograph hostage to an ideal score.

## 1:30–2:30 — Tell what you remember

Keep the photograph dominant and invite natural speech:

> **Tell us what you remember.**

The authentic voice is the source artifact. The current free voice allowance is centrally configured and may change without changing this experience contract.

The UI may offer:

> Would you like help remembering?

Help is optional.

## 2:30–3:30 — Let Muse listen

Muse listens first. If useful, it asks one warm, context-aware question such as:

- “Who is standing beside you?”
- “Do you remember where this was?”
- “About what year was this?”
- “What happened just before this?”
- “Who else would remember this?”

Muse accepts silence, emotion, uncertainty, code-switching, interruption, and “I don't remember.” It never runs a who/what/when/where interrogation and never invents a missing memory.

## 3:30–4:30 — Preserve invisibly, reveal truthfully

Behind the experience, the system can preserve and structure:

- original photograph;
- original voice;
- transcript lineage;
- narrator attribution;
- people and relationships;
- place;
- date or approximate date;
- story context;
- truth states;
- provenance and receipts.

The user should not have to understand this machinery.

Derived transcription, enhancement, extraction, translation, or Muse processing may continue after originals are safe. Incomplete derivatives show truthful **Processing** or **Needs attention** states; they do not block preservation of the originals.

## 4:30–5:00 — The Living Memory Magic Moment

Only after durable confirmation, display:

**This memory is now part of your family's history.**

Then reveal the completed object as a **Living Memory**:

- photograph prominent;
- authentic voice playable immediately;
- transcript available but secondary;
- source-grounded context visible as helpful detail;
- generated material visibly derivative.

The user should be able to feel the before/after difference.

Instrument the first successful completion as:

`first_living_memory_completed`

Then ask the natural continuation:

> **Who else remembers this?**

Offer calm choices such as:

- **Invite family**
- **Share this Living Memory**
- **Keep private**
- **Preserve another** when the person's entitlement permits it

Sharing is optional and never purchases another free Living Memory.

## Sharing experience

**Privacy-first means private by default and creator-controlled, not private-only.**

Before external sharing, show that the canonical Living Memory remains in the private Family Archive and that the person is preparing a copy to share outside it.

The user previews the bounded **Share Artifact**. A first production artifact should be able to contain:

- selected photograph;
- selected authentic voice segment;
- captions when enabled;
- selected narrator attribution;
- selected story caption;
- restrained Memories: My Story attribution;
- a discovery action such as **Create your own Living Memory**.

Private archive metadata does not leave by default.

Initial destination priorities are:

1. Facebook — public/social discovery.
2. WhatsApp — family-to-family sharing.
3. Native share/link/SMS/email.
4. Instagram as later visual expansion.

Once a copy is shared outside the private Family Archive, the product must truthfully explain that it cannot guarantee recall of every external copy.

## First-use success criteria

The first experience succeeds only if the user can:

- understand why the action matters without a feature tour;
- capture or import a usable photograph;
- speak naturally without configuring technology;
- receive at most one useful Muse prompt at a time;
- hear the authentic recording play back;
- distinguish human source from generated material;
- trust that required originals are durably preserved;
- recognize the result as a Living Memory;
- understand that it remains private unless they deliberately share;
- invite, share, keep private, or return later without pressure;
- complete the path on a phone with minimal typing.

## Failure and recovery

- Camera or upload failure preserves progress and offers one clear retry.
- Interrupted audio remains recoverable until upload completes.
- Poor transcription never discards the original recording.
- Cloud-save failure says “Still saving” or “Needs connection,” never “Saved.”
- Network loss never prevents a person from continuing with locally recoverable photo/voice capture when the device can safely do so.
- Every guided step is skippable and replayable through **Muse Help**.

## First-few-use guidance

Capture guidance can repeat during the first few uses, become lighter as confidence grows, remain skippable, and stay replayable through Muse Help. The product adapts from observed completion rather than assuming age, ability, or technical confidence.

## First-five-minute acceptance contract

The first implementation is not complete until all of the following are demonstrated on a representative phone-sized viewport:

1. A new user understands the preservation idea without reading a feature tour.
2. Camera and microphone permissions are requested in context, not in a batch.
3. A physical photograph can be captured with practical quality guidance, or a digital photograph can be imported.
4. The immutable original photograph is retained separately from every enhancement.
5. The storyteller can record under the current entitlement, hear the authentic voice play back, and recover from interrupted upload.
6. Muse listens first and offers no more than one warm, relevant question at a time.
7. Human testimony, corrected transcript, structured context, and generated artifacts remain distinguishable.
8. **This memory is now part of your family's history.** appears only after required originals and ownership are durably confirmed.
9. The completed object is presented as a Living Memory and the first valid completion emits `first_living_memory_completed` exactly once for activation semantics.
10. The user can leave safely, return later, and continue across identity/device boundaries supported by the current phase.
11. A new Living Memory is private by default.
12. Sharing is deliberate, uses a previewable bounded Share Artifact, exports no private archive metadata by default, and grants no free-memory entitlement reward.
13. The path remains usable with minimal typing, assistive technology, mixed English and Spanish, and unreliable connectivity.

Internal screens, API responses, test counts, or successful AI calls do not satisfy this contract unless the user outcome above works end to end.

## What must not appear in the first five minutes

- model names or AI configuration;
- multi-page profile setup;
- a feature tour unrelated to the first Living Memory;
- forced or rewarded public sharing;
- dense metadata forms;
- an unearned “saved” confirmation;
- pressure that turns loving urgency into fear.

## Shared-experience extension

In-person and remote Memory Circles keep the selected photograph fixed as the primary visual focus while people remember together. Participants remain visible in remote sessions. Contributions are attributed, disagreements remain intact, and the Living Memory is enriched additively rather than rewritten into a synthetic consensus.
