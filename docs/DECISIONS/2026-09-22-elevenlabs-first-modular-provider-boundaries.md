# Decision: ElevenLabs First, Modular Provider Boundaries

**Date:** 2026-09-22
**Status:** approved
**Supersedes:** earlier Phase 1 implementation assumptions that selected Cloudflare Workers AI / Whisper as the first transcription provider.

## Decision

Memories: My Story starts with **ElevenLabs** for transcription. The launch speech-to-text model is **Scribe v2**.

Provider choice is an implementation detail behind a narrow boundary. The Living Memory domain, queue messages, persistence model, user experience, Muse behavior rules, completion semantics, and archive must not depend on ElevenLabs request or response shapes.

The same rule applies to other real change boundaries:
- transcription provider;
- Muse text-model provider;
- future sharing-channel adapters;
- future delivery/render providers when more than one real implementation exists.

Do not create speculative abstraction layers for components that have no credible replacement boundary.

## Transcription boundary

The application passes a provider-neutral input containing the preserved audio bytes, content type, and filename.

The provider adapter returns only:
- transcript text;
- detected language when available;
- language confidence when available.

ElevenLabs-specific authentication, multipart fields, endpoint paths, model identifiers, errors, and raw response fields remain inside the ElevenLabs adapter.

For the solo Living Memory proof:
- use Scribe v2;
- allow automatic language detection so English/Spanish code-switching is not forced into one language;
- diarization is off because the proof has one storyteller;
- the original audio remains canonical regardless of transcription output or provider failure.

## Muse boundary

Storyteller Sovereignty and the remembering prompt belong to Memories: My Story, not to any AI vendor.

Muse orchestration supplies provider-neutral text-generation instructions. The first implementation uses Cloudflare Workers AI, but a future model/provider change must not alter:
- no fact-checking;
- no judgment;
- no invented testimony;
- one warm question at a time;
- storyteller control of context.

## Secret and configuration rule

- `ELEVENLABS_API_KEY` is a runtime secret and never enters Git, prompts, receipts, or logs.
- Provider and model IDs live in centralized configuration.
- Staging acceptance must prove the selected provider with synthetic/non-family audio before release-candidate lock.

## Reason

We expect providers and model quality/cost to change over the life of the product. The product promise should survive those changes without a rewrite. Modularity therefore belongs at provider seams, while the domain remains stable.
