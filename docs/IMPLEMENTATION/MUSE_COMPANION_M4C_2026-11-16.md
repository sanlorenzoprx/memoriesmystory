# Talk with Muse M4c — the screen (typed conversation)

**Result:** PARTIAL — the screen is implemented and proven in phone-sized browser runs against a stubbed server, plus the automated accessibility scan. Voice and saving into a Living Memory (M4b) are not built. The confirmation wording is a **draft awaiting owner and legal review (D2)**. Not deployed.
**Base:** `main` `99091e3` (PR #83, M4a).
**Authority:** `docs/DECISIONS/2026-11-16-talk-with-muse.md` (packet M4).

## Change

- **`/muse`** (`app/features/muse/TalkWithMuse.tsx`, `app/services/muse-talk.ts`). The page loads on demand and is reached from **Talk with Muse** in the archive. It is never part of a new person's first five minutes.
- **First visit:** a short plain statement, followed by two checkboxes. **Start talking with Muse** stays disabled until both are ticked. The confirmation is saved with its wording version and is not asked again.
  - The statement: Muse is an AI, not a person, gives no advice, keeps the conversation private unless the person shares it, and lets the person delete a conversation.
  - The checkboxes: "I am 18 or older" and "I understand Muse is an AI, not a person".
- **The conversation:**
  - A conversation touched in the last 12 hours is picked up again; otherwise a new one starts with Muse's opening, which says it is an AI.
  - The person's words and Muse's answers appear only after the server confirms them, in a live region for screen readers.
  - A support message shows one-tap Call, Text and Emergency links.
  - Muse's family suggestion links to **Choose a story to share**.
  - **Delete this conversation** asks first, says Living Memories are not affected, and then starts a fresh conversation.
- **Copy:** English and Spanish in `catalog/muse.ts`, including friendly messages for every server error code.
- **Fix found by the test:** newer Chromium returns a promise from `scrollIntoView`. A one-line effect returned it to React as a cleanup function and crashed the page. The effect now has a body. The only other `scrollIntoView` in the app was checked and is already safe.

## Evidence

| Check | Result |
| --- | --- |
| `tests/e2e/muse-talk.spec.ts` (EN, ES) | The button is disabled until both boxes are ticked, and the exact confirmation is sent. The opening appears. A reply is sent with the turn it answers, Muse's question appears, and the box clears. A danger message shows `tel:988` and `tel:911`. The family suggestion links to the archive. Delete asks, then a fresh conversation opens |
| `tests/e2e/accessibility.spec.ts` | The confirmation screen is scanned in EN and ES; 16 screens pass |

## Waiting on the owner

- Approve, or change, the confirmation wording above, then legal review (D2).
- Speaking with Muse (M4b) uses ElevenLabs (O4) for transcription and Muse's voice.

**Reversible:** yes. **Migration:** none. **Production deployed:** no.
