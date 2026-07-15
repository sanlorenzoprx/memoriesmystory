# Decision: First Five-Minute Experience Baseline

**Status:** Accepted  
**Date:** 2026-07-15  
**Foundation package:** Version 1.1

## Context

Memories: My Story needs one emotionally complete first experience before the Cloudflare-native implementation expands into albums, shared Memory Circles, public discovery, or broad business automation. The Foundation already established that the photograph is the doorway, the real voice is the primary artifact, Muse remains invisible unless useful, originals are immutable, and the first five Memory Stories use the Good Karma share-to-unlock sequence.

## Decision

`docs/FOUNDATION/03_USER_EXPERIENCE.md` is accepted as the binding first implementation contract.

The experience must move a person through one complete arc:

**A photograph matters → my voice matters → I can do this → the memory is safe → my family can receive it.**

The first implementation must provide guided photograph capture or import, contextual permissions, up to the configured free voice allowance, original playback, restrained Muse assistance, visible separation of human and generated material, truthful durable-save confirmation, a safe return path, and a deliberate share-to-unlock choice.

The timing is a design target, not a limit imposed on human emotion or accessibility needs. Guidance repeats during the first few uses, becomes lighter with confidence, remains skippable, and can be replayed through Muse Help.

## Alternatives considered

### Begin with account setup and a product tour

Rejected because it delays emotional value and teaches software before helping someone preserve a memory.

### Begin with a broad multi-application scaffold

Rejected because the approved platform foundation is one React Router v8, TypeScript, Vite, Cloudflare Workers PWA and the first outcome is one complete solo Memory Story.

### Build solo capture, albums, sharing, and Memory Circles simultaneously

Rejected because the shared experiences depend on a truthful, durable Memory Story record and a proven solo preservation path.

## Affected Product Invariants

- I-01 Real voice is never optional in a completed Memory Story.
- I-03 The platform never editorially corrects a memory.
- I-04 The storyteller controls the truth state.
- I-06 Originals are immutable.
- I-07 History is additive and attributable.
- I-08 “Saved” means durably confirmed.
- I-11 Technology stays in the background.
- I-12 Muse listens before asking.
- I-13 Guidance remains available without becoming a barrier.
- I-14 Accessibility and global readiness begin at the first screen.
- I-18 Generated artifacts remain separate from testimony.
- I-24 The first five free Memory Stories use share-to-unlock.

## Evidence required

- End-to-end acceptance on a representative phone-sized viewport.
- Physical-photo capture with quality guidance and manual override.
- Interrupted image, audio, sign-in, and network recovery.
- Original photograph and audio provenance.
- Playback of the original voice after durable preservation.
- Mixed English and Spanish behavior.
- Assistive-technology review.
- A qualifying private or public share that unlocks the next free Memory Story without assuming public consent.

## Consequences and follow-up

- Foundation Phase 0 is complete.
- Phase 1 is the solo first-five-minute vertical slice.
- React Router routes, server actions/loaders, D1 records, R2 objects, Workers AI transcription, and background work must be designed around this acceptance contract.
- Preserve Together and Remember Together begin only after the solo Memory Story record and preservation path are proven.
