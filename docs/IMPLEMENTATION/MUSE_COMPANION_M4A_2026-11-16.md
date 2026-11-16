# Talk with Muse M4a — the open conversation, server side

**Result:** PARTIAL — the server route is implemented and proven with fakes and an in-memory database. There is no screen yet (M4c), no voice or saving into a Living Memory yet (M4b), and no real people have used it.
**Base:** `main` `a3b0181` (PR #82, M3).
**Authority:** `docs/DECISIONS/2026-11-16-talk-with-muse.md` (packet M4; owner: "layer 4 i think we should start with it").

## Change

**Route** (`worker/muse-talk.ts`, `migrations/0042_muse_talk.sql`):

| Request | What it does |
| --- | --- |
| `GET`/`POST /resources/muse/talk/consent` | One-time confirmation that the person is an adult and understands Muse is an AI, kept with its wording version (`museTalkDisclosureVersion`) |
| `POST /resources/muse/talks` | Starts a conversation; refused until the person has confirmed |
| `GET /resources/muse/talks` | Lists the person's recent conversations |
| `GET`/`DELETE /resources/muse/talks/:id` | Reads or deletes one conversation |
| `POST /resources/muse/talks/:id/messages` | Adds the person's words and Muse's answer |

Every write needs `X-Memories-Request: muse-talk-v1`. Someone else's conversation answers 404.

**Opening.** Fixed wording, with no model call:
- Muse says it is an AI and that the conversation is private unless the person shares it.
- It then makes one invitation built from the person's own archive: their unfinished memory first, otherwise someone they named in a Living Memory, otherwise "What would you like to remember today?". English or Spanish.

**Replies:**
- The person's words are kept exactly as given, apart from collapsed spaces. Turns are append-only, enforced by a trigger.
- Muse answers with one question. The same invented-name guard applies: names and numbers must come from the person's own words in this conversation or their confirmed Living Memories. Otherwise the reply becomes "What else comes back to you?".
- When no model answers, Muse uses that same fixed question.

**Safeguards:**
- **Danger first:** the M1 support message, with no model call; the conversation stays open.
- **AI reminder:** "I'm Muse, an AI, not a person" after 180 minutes of continued conversation.
- **Family:** after 45 minutes, a single suggestion to share a story with family, instead of another question.
- No streaks, rewards or come-back nudges exist anywhere.

**Order:** each message names the turn it answers. An out-of-turn send gets 409; a retried send returns the conversation unchanged.

**Limits:** messages count against the Muse conversation daily ceiling and the costly rate limit.

## Evidence

| Check | Result |
| --- | --- |
| `tests/integration/muse-talk.test.ts` (7) | Confirmation is required, its wording version is checked, and both statements must be true. The opening states that Muse is an AI, with no model call. It invites from an unfinished memory or a named person, in Spanish when asked. Words are kept and the database refuses edits. An invented name is replaced by the fixed question. A Spanish message of danger gets 988 and 911 with no model call, and the talk continues. The family suggestion appears once after 45 minutes and the AI reminder after 3 hours. Out-of-turn 409, retry unchanged, a stranger gets 404, a wrong header 400, and delete removes every turn. Ceiling and rate-limit classes are checked |

## Open

- **M4b:** voice in and out, and "Save this as a Living Memory" with the person's own recording.
- **M4c:** the screen, including the confirmation wording, which needs owner and legal review (D2).
- A model-based second safety check.
- Conversations are not yet in the archive export.

**Reversible:** yes. The tables are additive. **Migration:** 0042. **Production deployed:** no.
