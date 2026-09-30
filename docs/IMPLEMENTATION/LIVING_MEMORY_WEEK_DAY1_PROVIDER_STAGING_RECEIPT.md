# Living Memory Week — Day 1 Provider + Staging Receipt

**Date:** 2026-09-22
**Scope:** one-week Living Memory product proof
**Branch:** `integration/lm-week-one`

## Decisions locked

- ElevenLabs is the first transcription provider across the product family.
- Memories: My Story uses ElevenLabs **Scribe v2** for the first Living Memory proof.
- Transcription is behind a narrow `TranscriptionProvider` contract.
- Muse model invocation is behind a separate `MuseTextProvider` contract.
- Product/domain behavior does not depend on vendor request/response shapes.
- Storyteller Sovereignty remains the governing Muse rule: Muse helps the individual remember and never judges, fact-checks, corrects, ranks, or reconciles the person's recollection.
- Sharing remains voluntary and never changes entitlement.

## Code evidence

- `worker/providers/transcription-provider.ts`
  - provider-neutral input/output;
  - ElevenLabs multipart/auth/model details contained in adapter;
  - automatic language detection by omitting a forced language code;
  - diarization disabled for the solo proof.
- `worker/providers/muse-provider.ts`
  - isolates text-model invocation from Muse behavior/prompt rules.
- `worker/transcription.ts`
  - queue/idempotency/persistence remain provider-neutral.
- `worker/muse.ts`
  - Storyteller Sovereignty prompt remains application-owned.
- `config/phase-1.ts`
  - transcription provider `elevenlabs`;
  - model `scribe_v2`.
- `scripts/preflight-living-memory-staging.mjs`
  - redacted presence/configuration checks for the proof.

## Focused verification

- Application TypeScript compile: pass.
- Worker TypeScript compile: pass.
- Five focused test files: pass.
- Fifteen focused tests: pass.
- Covered:
  - provider adapter contract;
  - missing provider secret fails closed;
  - idempotent queue/transcript processing;
  - duplicate delivery converges to one transcript;
  - provider failure leaves durable originals unchanged;
  - Muse one-question behavior;
  - Muse Storyteller Sovereignty;
  - centralized provider configuration;
  - secret-name readiness contract.

## Staging preflight

Present:
- isolated staging D1 identifier;
- isolated staging R2 bucket identifier;
- isolated staging Worker identifier;
- `AI` binding for Muse;
- `PROCESSING_QUEUE` binding contract;
- ElevenLabs/Scribe v2 selected provider configuration;
- email + Google identity staging configuration from the earlier identity preflight.

Blocked:
1. `ELEVENLABS_API_KEY` is not yet present in the Memories staging secret configuration.
2. `MEMORIES_STAGING_QUEUE_NAME` is not yet recorded.
3. Queue provisioning was attempted once using the existing staging Cloudflare API token. Cloudflare returned authentication error 10000 / invalid access token 9109. Per the campaign stop rule, no blind retry was performed.

## Next local action

Continue product implementation without waiting on external credentials:
- completion/playback lane;
- voluntary bounded family-share lane;
- merge-safe UI integration against the frozen transcript/Muse contracts.

## Next operator action before live staging

- load the approved ElevenLabs workspace API key into the Memories staging secret store as `ELEVENLABS_API_KEY`;
- refresh the Cloudflare staging API token with the permissions required for staging Worker/D1/R2/Queue operations;
- provision or verify `memoriesmystory-processing-staging`;
- set `MEMORIES_STAGING_QUEUE_NAME=memoriesmystory-processing-staging`;
- rerun `npm run preflight:living-memory:staging`;
- only then run live English and Spanish/mixed transcription evidence.


## Updated acceptance status after customer-journey integration

Local staging configuration now contains, without committing values:
- a cryptographically random `SHARE_TOKEN_PEPPER`;
- `MEMORIES_STAGING_QUEUE_NAME=memoriesmystory-processing-staging`.

The redacted Living Memory preflight now reports exactly one missing configuration value:
- `ELEVENLABS_API_KEY`.

Important distinction:
- the Queue **name is configured**, but the Queue is **not yet proven provisioned**;
- the existing Cloudflare staging API token previously returned authentication error 10000 / invalid access token 9109;
- therefore live Queue provisioning/deployment remains blocked until that Cloudflare token is refreshed;
- the preflight is configuration-shape evidence only and does not replace live provider/Queue receipts.

The current integration checkpoint also includes the human journey through processing, Muse, storyteller-owned context, durable completion/playback, keep-private, share preview, and bounded family sharing.
