# Muse Voice Conversation — Local Implementation Receipt

**Date:** 2026-09-23  
**Branch:** `integration/lm-week-one`  
**Status:** local implementation complete; staging deployment intentionally held

## Implemented

- Muse is a dynamic conversational story elicitor, not a fixed Who/Where/When/What form.
- Storyteller can answer the current Muse question by voice or text.
- Voice is presented first; the text field does not autofocus.
- Microphone access is requested only after **Answer with voice**.
- Voice reply is reviewed locally before upload.
- **Use this voice reply** preserves the original reply audio in private R2 storage.
- Voice reply transcription uses the existing ElevenLabs transcription-provider boundary.
- Transcription failure leaves the voice reply durable and retryable without rerecording.
- Storyteller reviews **Muse heard:** and may correct transcript text without altering the preserved audio.
- Conversation turn stores the exact Muse question relation and the preserved voice-reply asset ID.
- Reloaded conversation exposes private audio playback for spoken storyteller turns.
- Living Memory deletion removes primary originals and all preserved Muse voice replies from R2.
- Internal person/place/time/event anchors remain storyteller-owned and invisible as form fields.

## Data additions

- `0006_muse_conversation.sql` — durable Muse/storyteller conversation turns.
- `0007_muse_voice_replies.sql` — durable spoken reply assets and conversation provenance.

## Focused verification

- Muse conversation / sovereignty / TTS boundary / deletion / spoken-reply recovery: **7/7 passed**.
- D1 schema: **29 required objects**, integrity PASS, foreign keys PASS.
- Client TypeScript: PASS.
- Worker TypeScript: PASS.
- Staging-env Vite production build: PASS.
- Phone-width intercepted API smoke:
  - Answer with voice visible: PASS
  - microphone requests before voice choice: 0
  - microphone requests after voice choice: 1
  - recorded upload body present: PASS
  - preserved voice asset ID forwarded into conversation: PASS
  - corrected transcript forwarded into conversation: PASS
  - storyteller reply bubble rendered: PASS
  - preserved reply playback control rendered: PASS
  - final result: `VOICE_REPLY_SMOKE=PASS`

## External blocker before staging deploy

The existing ElevenLabs key can transcribe but still returns HTTP 401 `missing_permissions` for:

- `voices_read`
- `text_to_speech`

Muse speech is therefore not yet live. The voice-reply path itself uses the already-authorized STT permission and is implemented/tested.

Do not deploy the new conversational-Muse slice until Muse TTS is configured, so staging does not expose a knowingly partial voice experience.
