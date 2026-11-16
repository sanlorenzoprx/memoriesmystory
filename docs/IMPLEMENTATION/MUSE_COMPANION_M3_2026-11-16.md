# Talk with Muse M3 — Muse looks at the photograph

**Result:** PARTIAL — implemented and proven with fakes and an in-memory database and storage. No model has looked at a real photograph yet.
**Base:** `main` `d06c0d2` (PR #81, M2 and the direct Gemini call).
**Authority:** `docs/DECISIONS/2026-11-16-talk-with-muse.md` (packet M3; owner: "muse can look at the photo to help with questions").

## Change

- **Photo note** (`worker/muse-photo.ts`, `migrations/0041_muse_photo_notes.sql`):
  - When a Muse conversation starts, Muse sends the memory's own original photograph to Gemini once, directly or through AI Gateway.
  - Gemini is asked to describe only what can be seen. The prompt forbids names, ages, dates, years, place names, relationships, occasions and feelings.
  - A description containing any digit (a year or an age) is discarded.
  - The note is stored as `muse_generated`, tied by a trigger to the memory's own original photograph, and removed with the memory.
- **What gets sent:**
  - JPEG, PNG and WebP originals up to 7 MB are sent as they are.
  - HEIC or larger originals are sent only as a JPEG copy made by the optional Images binding.
  - Otherwise nothing is sent and Muse asks from the words alone.
  - The original is never changed.
- **Questions** (`worker/muse-conversation.ts`, prompt `story-elicitor-v2`):
  - The note is offered as "Muse's own observation, not the storyteller's words; ask about it, never state it". The system prompt allows a question about something visible, never saying who, when, where or why.
  - Later questions reuse the stored note without sending the photograph again.
  - The invented-name guard is unchanged, so a name can still only come from the storyteller.
- **Providers** (`worker/providers/muse-provider.ts`):
  - A request can carry an image in the OpenAI-compatible shape both Gemini routes accept.
  - The text-only Workers AI fallback refuses a photograph without being called.
- **Threat model:** T15 added: family words and photographs at model providers.

## Evidence

| Check | Result |
| --- | --- |
| `tests/integration/muse-photo.test.ts` (8) | The memory's own photograph is sent once as an inline image, with the visible-only prompt. The note is stored as Muse-generated and shapes the question "Who is the woman in the white dress?". The second question reuses the note without the photograph. A description with a year or an age is discarded. During a vision outage Muse still asks, and the photograph never reaches the fallback. HEIC and oversized originals are not sent without a JPEG copy; with the Images binding the copy is sent and the original bytes are unchanged. A note for a non-photo asset is refused by the database |
| `tests/unit/muse-provider.test.ts` | A photograph is sent inline on the direct route; the gateway route never passes it to Workers AI |
| `npm run verify:core` | Pass — 400 tests in 87 files |

## Not yet proven

- Real descriptions from Gemini, and whether they stay within what can be seen across many photographs: this needs the owner's key and a synthetic photo set in the evaluation.
- Spanish descriptions.
- How often the name guard replaces a question that mentions a visible capitalized object (for example a holiday name). This is a safe failure, but it should be measured.

**Reversible:** yes. The table is additive. **Migration:** 0041. **Production deployed:** no.
