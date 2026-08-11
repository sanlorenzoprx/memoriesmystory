# Memories: My Story — Product Invariants

**Version:** 2.0  
**Status:** Locked constitutional foundation  
**Purpose:** State what no feature, business model, prompt, growth loop, or technical implementation may violate.

## Interpretation

“Must” means a release-blocking requirement. “Never” means the behavior is prohibited. When two implementation choices are possible, choose the one that better protects the storyteller, authentic source artifacts, family control, and future access.

## Living Memory invariants

### I-01. Living Memory is the canonical product object

The customer-facing unit of value is a **Living Memory**. Existing `MemoryStory` database and code names may remain temporarily as compatibility infrastructure, but they must map beneath the Living Memory aggregate and must not redefine the product.

### I-02. The original voice is a primary artifact

Every completed Living Memory that includes narration must retain the storyteller's original recording. Text, cleaned audio, translations, summaries, reels, and generated material never replace it.

### I-03. Source photograph and voice remain bound

A completed Living Memory must keep its source photograph, preserved voice, transcript lineage, descriptive and relational context, ownership, and contribution provenance connected as one recoverable record.

### I-04. Original human sources outrank generated derivatives

The precedence is: original source → attributed human correction/contribution → structured extraction → generated summary/narrative/presentation. The system must never invert this hierarchy.

### I-05. The platform never editorially corrects a memory

The system must never silently rewrite, reconcile, sanitize, or replace what a person remembers.

### I-06. Truth state remains explicit

Extracted details must support at least confirmed, approximate, unknown, disputed, and AI-suggested-but-unconfirmed. Suggestions remain suggestions until accepted by an authorized person.

### I-07. Different recollections remain visible

When contributors disagree, the product preserves attribution and difference. AI must not collapse their contributions into a false consensus.

## Preservation invariants

### I-08. Originals are immutable

Original image and audio assets are never overwritten. Enhancements and cleaned versions are new derivatives with provenance.

### I-09. History is additive and attributable

Transcript revisions, contribution changes, sharing events, agreement versions, entitlement events, stewardship changes, and deletion history must be attributable and recoverable according to policy.

### I-10. “Saved” means durably confirmed

A Living Memory must not be represented as permanently preserved until required source assets have been durably stored. Interrupted local work must recover and complete rather than disappear silently.

### I-11. Archives are portable

Owners must be able to export human-readable records and original media in durable, documented formats. Portability cannot be reserved only for a future migration project.

### I-12. Continuity outlives an individual account

The product must support a responsible legacy-steward path so a Family Archive can continue across generations.

## Experience invariants

### I-13. The first-five-minute promise is transformation

The first successful session must be designed around **Photo → Voice → Muse → Preserved → Playback → Invite/Share**, with the goal that an ordinary photograph feels materially more valuable after becoming a Living Memory.

### I-14. The activation event is canonical

The product-level activation event is `first_living_memory_completed`. Lower-level upload, registration, or transcription events may support analytics but do not replace this activation definition.

### I-15. Technology stays in the background

The experience focuses on the photograph, storyteller, and family. It must not require the user to understand AI models, media pipelines, metadata, or storage architecture.

### I-16. Muse listens before asking

Muse asks one warm, context-aware question at a time and allows silence, emotion, uncertainty, mixed languages, and “I don't remember.” It does not interrogate with a checklist.

### I-17. Accessibility is foundational

Large touch targets, readable typography, high contrast, spoken guidance, limited typing, error recovery, lower-powered phones, unreliable networks, and hearing or vision needs are not post-launch extras.

### I-18. The product adapts to language

The original spoken language is preserved. Interface and spoken language may differ. Translation is optional and additive. Language-detection uncertainty must be represented honestly.

## Ownership, privacy, and sharing invariants

### I-19. Privacy-first is the default state

A new Living Memory begins private. Public exposure requires deliberate creator action.

### I-20. Privacy-first is not private-only

The creator may deliberately share a bounded copy with family, friends, social platforms, or the public. The product must support this human behavior rather than treating all external sharing as product drift.

### I-21. External sharing uses a bounded Share Artifact

A social or external share must include only the content the creator selected for that share. Private archive metadata, unrelated family relationships, hidden transcript context, private comments, and other non-selected material must not travel by default.

### I-22. Voluntary sharing is never purchased with free-memory rewards

A user must never be required or bribed to share a Living Memory in exchange for another free Living Memory. Growth must come from the value of the memory and the recipient's desire to preserve one of their own.

### I-23. Sharing can carry tasteful product attribution

With clear preview and user control, a Share Artifact may include restrained Memories: My Story attribution and a discovery call to action such as creating one's own Living Memory.

### I-24. Facebook is the first public social target

For initial product sequencing, Facebook is the primary public social-sharing target and WhatsApp is the next direct-family priority. Platform order may evolve from evidence without weakening creator control or privacy.

### I-25. Contributions retain attribution

Owners control the assembled archive; contributors retain attribution for their recorded contributions. The archive must preserve who said what.

### I-26. Generated content is distinguishable

A Muse description, suggested tag, translated transcript, reel, or generated narrative remains separate from original testimony and must never be presented as confirmed human testimony.

## Business and architecture invariants

### I-27. Growth serves preservation

Sharing, invitations, discovery, and attribution must create more preserved memories without exploiting grief, vulnerability, or social pressure.

### I-28. Product value is not expressed primarily as storage units

Gigabytes, transcription minutes, model calls, and internal quotas may constrain operations but must not become the primary value story. The durable value ladder is **Moment → Chapter → Life → Family**.

### I-29. Limits are centrally configurable

Voice duration, free trials, albums, circles, contributors, exports, retention, and paid entitlements must not be duplicated as hardcoded business rules throughout the product.

### I-30. Technology is replaceable; the doctrine is durable

Cloud vendors, frameworks, AI models, transcription systems, databases, codecs, and devices may change. No technology choice may redefine Living Memory, source authenticity, privacy, family control, portability, or long-term continuity.

## Release gate

Before a feature is accepted, its owner must complete the Living Memory anti-drift checklist and provide evidence that relevant invariants are preserved. A feature that violates an invariant is not eligible for release.
