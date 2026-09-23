# Decision: Muse is a Conversational Story Elicitor

**Date:** 2026-09-23  
**Status:** Locked for the Living Memory proof

## Product role

Muse is not a fact checker, historian, interviewer with a checklist, or form assistant.

Muse is a warm conversational story elicitor whose job is to help one person remember and tell more of their own story.

The visible experience is a conversation:

1. Muse listens to the storyteller's original recording.
2. Muse asks one natural, short question at a time.
3. The storyteller answers in their own words, may say they are unsure, may say they do not remember, or may leave something out.
4. Muse uses only the storyteller's transcript and prior replies to choose the next useful question.
5. Muse may ask about vivid detail, what happened next, people, place, time, feeling, sensory memory, or why the memory matters.
6. Muse stops when the story has enough storyteller-owned context to review.

## Preservation anchors are internal

The Living Memory still needs four preservation anchors:

- person
- place
- time
- event

These are **not four visible form boxes** and do not have to be asked in a fixed order.

Muse should gather them naturally during the conversation. Before review, each anchor is resolved only when the storyteller:

- states it,
- marks it approximate,
- says they do not remember, or
- chooses to leave it out.

AI inference alone never resolves an anchor.

## Storyteller sovereignty

Muse must never:

- fact-check, correct, challenge, verify, judge, rank, diagnose, or reconcile a memory;
- introduce a person, place, date, event, motive, feeling, or detail the storyteller did not provide;
- convert AI inference into preserved memory fact;
- decide what the memory means;
- force an answer;
- reconcile different people's recollections.

The storyteller's original photograph and real voice remain primary testimony.

Muse questions, transcripts, TTS, and other AI output are derivatives and assistance.

## Voice

Muse should speak its questions through the configured speech provider and display the same words on screen.

The storyteller may answer Muse by **voice or text**. Voice is the primary interaction path; typing remains available.

A spoken Muse reply follows this contract:

1. microphone access is requested only after the storyteller chooses **Answer with voice**;
2. the reply is recorded locally and played back before anything is uploaded;
3. choosing **Use this voice reply** preserves the original reply audio immutably in R2;
4. transcription runs from that preserved audio;
5. if transcription fails, the preserved audio is retried without asking the storyteller to rerecord;
6. the storyteller sees **Muse heard:** and may correct transcription text before the conversation continues;
7. correcting the transcript never changes the preserved audio;
8. the resulting conversation turn retains the preserved voice asset ID and a private playback path;
9. deleting the Living Memory also deletes all preserved Muse voice-reply audio objects.

The first Muse speech provider is ElevenLabs, behind a replaceable Muse speech-provider boundary.

The storyteller's original voice is never replaced by TTS.

## Current implementation boundary

- Dynamic conversation is durable in `muse_conversation_turns`.
- Muse generates the next question from the original transcript plus prior durable conversation turns.
- Storyteller replies may update preservation context only when the question's focus is a preservation anchor.
- The exact storyteller reply is the source of preserved context.
- The UI renders a turn-by-turn Muse/storyteller conversation rather than Who/Where/When/What cards.
- Spoken storyteller replies are durable in `muse_voice_reply_assets` and linked to the exact Muse turn they answer.
- Voice replies use the existing transcription-provider boundary and keep the original audio as testimony.
- A transcription outage never requires a new recording; retry reuses the same preserved R2 object.
- Storyteller turns expose private playback for preserved spoken replies.
- The phone UI presents **Answer with voice** before the text field and does not autofocus the keyboard.
