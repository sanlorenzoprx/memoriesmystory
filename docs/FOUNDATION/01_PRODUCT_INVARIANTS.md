# Memories: My Story — Product Invariants

**Version:** 1.0  
**Status:** Locked constitutional foundation  
**Purpose:** State what no feature, business model, prompt, or technical implementation may violate.

## Interpretation

“Must” means a release-blocking requirement. “Never” means the behavior is prohibited. When two implementation choices are possible, choose the one that better protects the storyteller, the original artifact, and future family access.

## Human-truth invariants

### I-01. The original voice is the primary artifact

Every completed Memory Story must retain the storyteller’s original recording. Text, cleaned audio, translations, and Muse-generated material never replace it.

### I-02. The photograph and voice remain bound as one Memory Story

The completed record must keep the source photograph, preserved voice, transcript, descriptive and relational metadata, ownership, and contribution context together.

### I-03. The platform never editorially corrects a memory

The system must never silently rewrite, reconcile, sanitize, or replace what a person remembers.

### I-04. The storyteller controls the truth state

Extracted details must support at least: confirmed, approximate, unknown, disputed, and AI-suggested but unconfirmed. Suggestions remain suggestions until accepted by an authorized person.

### I-05. Different recollections remain visible

When contributors disagree, the product preserves attribution and difference. AI must not collapse their contributions into a false consensus.

## Preservation invariants

### I-06. Originals are immutable

Original image and audio assets are never overwritten. Enhancements and cleaned versions are new derivatives with provenance.

### I-07. History is additive and attributable

Transcript revisions, contribution changes, sharing events, agreement versions, entitlement events, and deletion history must be attributable and recoverable according to policy.

### I-08. “Saved” means durably confirmed

A Memory Story must not be represented as permanently saved until required assets have been durably stored. Interrupted local work must recover and complete rather than disappear silently.

### I-09. Archives are portable

Owners must be able to export human-readable records and original media in durable, documented formats. Portability cannot be reserved only for a future migration project.

### I-10. Continuity outlives an individual account

The product must support designated legacy custodians and a responsible transfer path so an archive can continue across generations.

## Experience invariants

### I-11. Technology stays in the background

The user experience must focus on the photograph and storyteller. It must not require the user to understand AI models, media pipelines, or storage architecture.

### I-12. Muse listens before asking

Muse asks one warm, context-aware question at a time and allows silence, emotion, uncertainty, mixed languages, and “I don’t remember.” It does not interrogate the user with a checklist.

### I-13. Guidance is optional, accessible, and recoverable

Onboarding and Muse Help must be brief, skippable, replayable, localized, and available when a user needs it again.

### I-14. Accessibility is foundational

Large touch targets, readable typography, high contrast, spoken guidance, limited typing, reasonable timing, error recovery, lower-powered phones, unreliable networks, and hearing or vision needs are not post-launch extras.

### I-15. The product adapts to language

The original spoken language is preserved. Interface and spoken language may differ. Translation is optional and additive. Language detection uncertainty must be represented honestly.

## Ownership and trust invariants

### I-16. The family controls visibility

Private and public sharing require deliberate user action. The product does not force a family archive into public distribution.

### I-17. Contributions retain attribution

Owners control the assembled archive; contributors retain attribution for their own recorded contributions.

### I-18. Generated content is distinguishable

A Muse Legacy Description, suggested tag, translated transcript, or other generated artifact must remain separate from the original recording and transcript and must never be presented as confirmed human testimony.

### I-19. Deletion is deliberate and recoverable

Deleted content enters the configured recovery period before verified permanent deletion. The user must understand the consequence of irreversible actions.

### I-20. Agreements are versioned

Consent and participation agreements must record the applicable version, person, time, and context. Legal friction should not be scattered through ordinary remembering unless required.

## Business and growth invariants

### I-21. Growth serves preservation

Sharing, invitations, public-feed mechanics, and entitlements must encourage more memories to be preserved without exploiting emotional vulnerability.

### I-22. Limits are centrally configurable

Voice duration, earned stories, albums, circles, contributors, exports, and retention limits must not be duplicated as hardcoded business rules throughout the product.

### I-23. Monetization may limit convenience or scale, not rewrite ownership

Pricing can change access levels, but it cannot grant the company permission to alter memories or prevent people from receiving a viable export of their preserved originals.

### I-24. The first five free Memory Stories use share-to-unlock

The first Memory Story is available immediately. A deliberate qualifying share action unlocks each next free Memory Story, up to five. Sharing may be private, family-directed, social, or public according to the user's choice. This launch rule is non-negotiable and must not be silently weakened or removed.

### I-25. The completion promise is locked

After durable save confirmation, the product must display exactly: **“This memory is now part of your family's history.”** The wording must not change before production testing explicitly evaluates it.

## Release gate

Before a feature is accepted, its owner must identify the invariants it touches and provide evidence that none are weakened. A feature that violates an invariant is not “mostly complete”; it is not eligible for release.
